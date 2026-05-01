-- Helper: generate a unique 6-digit student code (100000–999999), retrying on collision.
CREATE OR REPLACE FUNCTION public.generate_unique_student_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
  _tries integer := 0;
BEGIN
  LOOP
    _code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE pseudonym = _code);
    _tries := _tries + 1;
    IF _tries > 50 THEN
      RAISE EXCEPTION 'Unable to allocate unique student code after 50 attempts';
    END IF;
  END LOOP;
  RETURN _code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_unique_student_code() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_unique_student_code() TO authenticated, service_role;

-- Backfill: assign every student a globally-unique random 6-digit code.
DO $$
DECLARE
  _row record;
  _code text;
  _tries integer;
BEGIN
  -- Clear pseudonym fields so the loop assigns fresh codes without colliding
  -- with the old "Student 001" style values.
  UPDATE public.students SET pseudonym = NULL;

  FOR _row IN SELECT id FROM public.students ORDER BY random() LOOP
    _tries := 0;
    LOOP
      _code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
      BEGIN
        UPDATE public.students
        SET pseudonym = _code,
            name = _code,
            sortable_name = _code
        WHERE id = _row.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        _tries := _tries + 1;
        IF _tries > 50 THEN RAISE; END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Enforce global uniqueness so codes can never repeat going forward.
CREATE UNIQUE INDEX IF NOT EXISTS students_pseudonym_unique
  ON public.students (pseudonym)
  WHERE pseudonym IS NOT NULL;

-- Update the re-anonymize function to use the new 6-digit scheme.
CREATE OR REPLACE FUNCTION public.repseudonymize_course(_course_id uuid)
RETURNS TABLE(student_id uuid, old_pseudonym text, new_pseudonym text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _renamed integer := 0;
  _row record;
  _code text;
  _tries integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id AND c.teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this course';
  END IF;

  CREATE TEMP TABLE _old_pseudo ON COMMIT DROP AS
    SELECT s.id, s.pseudonym AS old_pseudonym
    FROM public.students s
    WHERE s.course_id = _course_id AND s.teacher_id = auth.uid();

  FOR _row IN
    SELECT id FROM public.students
    WHERE course_id = _course_id AND teacher_id = auth.uid()
    ORDER BY random()
  LOOP
    _tries := 0;
    LOOP
      _code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
      BEGIN
        UPDATE public.students
        SET pseudonym = _code,
            name = _code,
            sortable_name = _code
        WHERE id = _row.id;
        _renamed := _renamed + 1;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        _tries := _tries + 1;
        IF _tries > 50 THEN RAISE; END IF;
      END;
    END LOOP;
  END LOOP;

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