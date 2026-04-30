CREATE OR REPLACE FUNCTION public.analytics_compare_classes_students(
  _course_ids uuid[],
  _assignment_id uuid DEFAULT NULL,
  _standard_id uuid DEFAULT NULL,
  _assignment_group_id uuid DEFAULT NULL
)
RETURNS TABLE(
  course_id uuid,
  course_name text,
  student_id uuid,
  student_name text,
  band text,
  score numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH picked AS (
    SELECT a.id, a.name_normalized, a.assignment_group_id
    FROM public.assignments a
    WHERE _assignment_id IS NOT NULL
      AND a.teacher_id = auth.uid()
      AND a.id = _assignment_id
  ),
  equivalent_assignments AS (
    SELECT a.id
    FROM public.assignments a, picked p
    WHERE a.teacher_id = auth.uid()
      AND a.course_id = ANY(_course_ids)
      AND (
        (p.assignment_group_id IS NOT NULL AND a.assignment_group_id = p.assignment_group_id)
        OR (p.name_normalized IS NOT NULL AND a.name_normalized = p.name_normalized)
        OR a.id = p.id
      )
  ),
  group_assignments AS (
    SELECT a.id
    FROM public.assignments a
    WHERE _assignment_group_id IS NOT NULL
      AND a.teacher_id = auth.uid()
      AND a.assignment_group_id = _assignment_group_id
  ),
  source AS (
    SELECT st.course_id,
           c.name AS course_name,
           sub.student_id,
           st.name AS student_name,
           (sub.percentage / 100.0)::numeric AS score
    FROM public.submissions sub
    JOIN public.students st ON st.id = sub.student_id
    JOIN public.courses c ON c.id = st.course_id
    WHERE _assignment_id IS NOT NULL
      AND sub.teacher_id = auth.uid()
      AND sub.assignment_id IN (SELECT id FROM equivalent_assignments)
      AND sub.percentage IS NOT NULL
      AND st.course_id = ANY(_course_ids)
      AND st.merged_into IS NULL

    UNION ALL

    SELECT st.course_id,
           c.name AS course_name,
           sub.student_id,
           st.name AS student_name,
           (sub.percentage / 100.0)::numeric AS score
    FROM public.submissions sub
    JOIN public.students st ON st.id = sub.student_id
    JOIN public.courses c ON c.id = st.course_id
    WHERE _assignment_group_id IS NOT NULL
      AND sub.teacher_id = auth.uid()
      AND sub.assignment_id IN (SELECT id FROM group_assignments)
      AND sub.percentage IS NOT NULL
      AND st.course_id = ANY(_course_ids)
      AND st.merged_into IS NULL

    UNION ALL

    SELECT st.course_id,
           c.name AS course_name,
           lms.student_id,
           st.name AS student_name,
           lms.mastery_score AS score
    FROM (
      SELECT DISTINCT ON (ms.student_id)
        ms.student_id, ms.mastery_score, ms.computed_at
      FROM public.mastery_snapshots ms
      WHERE _standard_id IS NOT NULL
        AND ms.teacher_id = auth.uid()
        AND ms.standard_id = _standard_id
      ORDER BY ms.student_id, ms.computed_at DESC
    ) lms
    JOIN public.students st ON st.id = lms.student_id
    JOIN public.courses c ON c.id = st.course_id
    WHERE st.course_id = ANY(_course_ids)
      AND st.merged_into IS NULL
  )
  SELECT
    s.course_id,
    s.course_name,
    s.student_id,
    s.student_name,
    CASE
      WHEN s.score < 0.60 THEN 'below'
      WHEN s.score < 0.80 THEN 'approaching'
      ELSE 'mastered'
    END AS band,
    s.score
  FROM source s
  ORDER BY s.course_name, s.student_name;
$$;