CREATE OR REPLACE FUNCTION public.analytics_class_matrix(_course_id uuid)
RETURNS TABLE(
  student_id uuid,
  student_name text,
  student_sortable text,
  standard_id uuid,
  code text,
  parent_code text,
  description text,
  subject text,
  grade text,
  framework text,
  mastery_score numeric,
  mastered boolean,
  attempts integer,
  computed_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH course_students AS (
    SELECT id, name, sortable_name
    FROM public.students
    WHERE teacher_id = auth.uid() AND course_id = _course_id
  ),
  course_assignments AS (
    SELECT id
    FROM public.assignments
    WHERE teacher_id = auth.uid() AND course_id = _course_id
  ),
  course_standards AS (
    SELECT DISTINCT s.*
    FROM public.assignment_standards asg
    JOIN public.standards s ON s.id = asg.standard_id
    WHERE asg.teacher_id = auth.uid()
      AND (asg.confirmed = true OR asg.ai_suggested = true)
      AND asg.assignment_id IN (SELECT id FROM course_assignments)

    UNION

    SELECT DISTINCT s.*
    FROM public.question_standards qs
    JOIN public.quiz_questions q ON q.id = qs.question_id
    JOIN public.standards s ON s.id = qs.standard_id
    WHERE qs.teacher_id = auth.uid()
      AND (qs.confirmed = true OR qs.ai_suggested = true)
      AND q.assignment_id IN (SELECT id FROM course_assignments)

    UNION

    SELECT DISTINCT s.*
    FROM public.mastery_snapshots ms
    JOIN public.standards s ON s.id = ms.standard_id
    WHERE ms.teacher_id = auth.uid()
      AND ms.student_id IN (SELECT id FROM course_students)
  ),
  latest_snapshots AS (
    SELECT DISTINCT ON (ms.student_id, ms.standard_id)
      ms.student_id,
      ms.standard_id,
      ms.mastery_score,
      ms.mastered,
      ms.attempts,
      ms.computed_at
    FROM public.mastery_snapshots ms
    WHERE ms.teacher_id = auth.uid()
      AND ms.student_id IN (SELECT id FROM course_students)
    ORDER BY ms.student_id, ms.standard_id, ms.computed_at DESC
  )
  SELECT
    st.id AS student_id,
    st.name AS student_name,
    st.sortable_name AS student_sortable,
    cs.id AS standard_id,
    cs.code,
    CASE
      WHEN cs.code ~ '[-.][^-.]+$'
        THEN regexp_replace(cs.code, '[-.][^-.]+$', '')
      ELSE cs.code
    END AS parent_code,
    cs.description,
    cs.subject,
    cs.grade,
    COALESCE(cs.framework, 'STATE') AS framework,
    ls.mastery_score,
    ls.mastered,
    ls.attempts,
    ls.computed_at
  FROM course_students st
  CROSS JOIN course_standards cs
  LEFT JOIN latest_snapshots ls
    ON ls.student_id = st.id
   AND ls.standard_id = cs.id
  ORDER BY st.sortable_name NULLS LAST, st.name, cs.code;
$$;