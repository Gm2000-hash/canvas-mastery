
CREATE OR REPLACE FUNCTION public.repseudonymize_course(_course_id uuid)
RETURNS TABLE(student_id uuid, old_pseudonym text, new_pseudonym text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max_seq integer;
  _renamed integer;
BEGIN
  -- Authorize: caller must own the course
  IF NOT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id AND c.teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this course';
  END IF;

  -- Snapshot current pseudonyms so we can return a before/after diff
  CREATE TEMP TABLE _old_pseudo ON COMMIT DROP AS
    SELECT s.id, s.pseudonym AS old_pseudonym
    FROM public.students s
    WHERE s.course_id = _course_id AND s.teacher_id = auth.uid();

  -- Find current highest pseudonym_seq across this teacher's roster so the
  -- new numbers never collide with pseudonyms in other courses.
  SELECT COALESCE(MAX(pseudonym_seq), 0) INTO _max_seq
  FROM public.students
  WHERE teacher_id = auth.uid();

  -- Assign fresh sequence numbers to this course's students in random order.
  -- We update by id only, so every primary key (and every FK that points at
  -- it: mastery_snapshots, submissions, question_responses, …) stays intact.
  WITH shuffled AS (
    SELECT id,
           _max_seq + ROW_NUMBER() OVER (ORDER BY random()) AS new_seq
    FROM public.students
    WHERE course_id = _course_id AND teacher_id = auth.uid()
  )
  UPDATE public.students s
  SET pseudonym_seq = sh.new_seq,
      pseudonym = 'Student ' || lpad(sh.new_seq::text, 3, '0'),
      name = 'Student ' || lpad(sh.new_seq::text, 3, '0'),
      sortable_name = 'Student ' || lpad(sh.new_seq::text, 3, '0')
  FROM shuffled sh
  WHERE s.id = sh.id;

  GET DIAGNOSTICS _renamed = ROW_COUNT;

  -- Audit: log this admin action in identity_reveals (no real names exposed)
  INSERT INTO public.identity_reveals (teacher_id, course_id, reason, student_count)
  VALUES (auth.uid(), _course_id, '[re-pseudonymize]', _renamed);

  RETURN QUERY
  SELECT s.id, op.old_pseudonym, s.pseudonym
  FROM public.students s
  JOIN _old_pseudo op ON op.id = s.id
  WHERE s.course_id = _course_id AND s.teacher_id = auth.uid()
  ORDER BY s.pseudonym;
END;
$$;

REVOKE ALL ON FUNCTION public.repseudonymize_course(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.repseudonymize_course(uuid) TO authenticated;
