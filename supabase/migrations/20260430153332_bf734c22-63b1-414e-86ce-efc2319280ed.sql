-- Reveal real student names for all responders to a single question.
-- Authorizes via question ownership (teacher_id), logs one reveal entry per
-- distinct course touched, and returns identities for the responding students.
CREATE OR REPLACE FUNCTION public.reveal_question_identities(_question_id uuid, _reason text DEFAULT NULL)
RETURNS TABLE(student_id uuid, real_name text, real_sortable_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Caller must own the question
  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_questions q
    WHERE q.id = _question_id AND q.teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this question';
  END IF;

  -- Log one reveal entry per distinct course among responders
  FOR _course IN
    SELECT DISTINCT s.course_id AS course_id, COUNT(DISTINCT qr.student_id) AS cnt
    FROM public.question_responses qr
    JOIN public.students s ON s.id = qr.student_id
    WHERE qr.question_id = _question_id
      AND qr.teacher_id = auth.uid()
      AND s.teacher_id = auth.uid()
    GROUP BY s.course_id
  LOOP
    INSERT INTO public.identity_reveals (teacher_id, course_id, reason, student_count)
    VALUES (auth.uid(), _course.course_id, NULLIF(_reason, ''), _course.cnt);
  END LOOP;

  RETURN QUERY
  SELECT DISTINCT si.student_id, si.real_name, si.real_sortable_name, si.email
  FROM public.student_identities si
  WHERE si.teacher_id = auth.uid()
    AND si.student_id IN (
      SELECT qr.student_id FROM public.question_responses qr
      WHERE qr.question_id = _question_id AND qr.teacher_id = auth.uid()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_question_identities(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reveal_question_identities(uuid, text) TO authenticated;