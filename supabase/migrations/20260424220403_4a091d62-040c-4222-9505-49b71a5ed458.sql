CREATE OR REPLACE FUNCTION public.analytics_class_matrix(
  _course_id uuid
)
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
  computed_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH course_assignments AS (
    SELECT id FROM public.assignments
    WHERE teacher_id = auth.uid() AND course_id = _course_id
  ),
  course_standards AS (
    SELECT DISTINCT s.*
    FROM public.assignment_standards asg
    JOIN public.standards s ON s.id = asg.standard_id
    WHERE asg.confirmed = true
      AND asg.teacher_id = auth.uid()
      AND asg.assignment_id IN (SELECT id FROM course_assignments)
  ),
  course_students AS (
    SELECT id, name, sortable_name
    FROM public.students
    WHERE teacher_id = auth.uid() AND course_id = _course_id
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
    ms.mastery_score,
    ms.mastered,
    ms.attempts,
    ms.computed_at
  FROM course_students st
  CROSS JOIN course_standards cs
  LEFT JOIN public.mastery_snapshots ms
    ON ms.student_id = st.id
   AND ms.standard_id = cs.id
   AND ms.teacher_id = auth.uid()
  ORDER BY st.sortable_name NULLS LAST, st.name, cs.code;
$$;