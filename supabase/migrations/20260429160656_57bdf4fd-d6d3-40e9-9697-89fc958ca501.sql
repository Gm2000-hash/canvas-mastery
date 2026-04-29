-- Make analytics_compare_classes treat an individual assignment selection as
-- "this assignment AND all sibling assignments with the same normalized name"
-- across the selected courses, so equivalent assignments in parallel sections
-- are aggregated together (Canvas-style).

DROP FUNCTION IF EXISTS public.analytics_compare_classes(uuid[], uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.analytics_compare_classes(
  _course_ids uuid[],
  _assignment_id uuid DEFAULT NULL,
  _standard_id uuid DEFAULT NULL,
  _assignment_group_id uuid DEFAULT NULL
)
RETURNS TABLE(course_id uuid, course_name text, band text, count integer, avg_score numeric, total_n integer)
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
  -- All assignments equivalent to the picked one:
  --   * same explicit group, OR
  --   * same normalized name (Canvas-style copy detection)
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
    -- Single assignment (auto-expanded to equivalents via name_normalized)
    SELECT st.course_id,
           c.name AS course_name,
           sub.student_id,
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

    -- Explicit assignment group
    SELECT st.course_id,
           c.name AS course_name,
           sub.student_id,
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

    -- Standard scope: latest mastery snapshot
    SELECT st.course_id,
           c.name AS course_name,
           lms.student_id,
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
  ),
  banded AS (
    SELECT course_id, course_name, score,
      CASE
        WHEN score < 0.60 THEN 'below'
        WHEN score < 0.80 THEN 'approaching'
        ELSE 'mastered'
      END AS band
    FROM source
  ),
  totals AS (
    SELECT course_id, COUNT(*)::int AS total_n, ROUND(AVG(score)::numeric, 4) AS avg_score
    FROM banded
    GROUP BY course_id
  ),
  bands AS (
    SELECT unnest(ARRAY['below','approaching','mastered']) AS band
  ),
  scoped AS (
    SELECT DISTINCT course_id, course_name FROM banded
  )
  SELECT s.course_id, s.course_name, b.band,
    COALESCE((SELECT COUNT(*)::int FROM banded bd WHERE bd.course_id = s.course_id AND bd.band = b.band), 0),
    t.avg_score,
    t.total_n
  FROM scoped s
  CROSS JOIN bands b
  LEFT JOIN totals t ON t.course_id = s.course_id
  ORDER BY s.course_name,
    CASE b.band WHEN 'below' THEN 1 WHEN 'approaching' THEN 2 ELSE 3 END;
$$;