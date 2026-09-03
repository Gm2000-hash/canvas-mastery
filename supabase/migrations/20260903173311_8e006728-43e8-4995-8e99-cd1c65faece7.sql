CREATE OR REPLACE FUNCTION public.default_framework_for_subject(_subject text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN _subject = 'Science' THEN 'NGSS' ELSE 'STATE' END;
$$;

CREATE OR REPLACE FUNCTION public.analytics_class_breakdown(
  _school_year text DEFAULT NULL::text,
  _include_archived boolean DEFAULT false
)
RETURNS TABLE(course_id uuid, course_name text, subject text, framework text, student_count integer, assessment_count integer, avg_mastery numeric, pct_mastered numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH latest_ms AS (
    SELECT DISTINCT ON (ms.student_id, ms.standard_id)
      ms.student_id, ms.standard_id, ms.mastery_score, ms.mastered, ms.computed_at
    FROM public.mastery_snapshots ms
    WHERE ms.teacher_id = auth.uid()
      AND (_school_year IS NULL OR public.school_year_label(ms.computed_at) = _school_year)
    ORDER BY ms.student_id, ms.standard_id, ms.computed_at DESC
  ),
  default_disc AS (
    SELECT td.subject, td.framework
    FROM public.teacher_disciplines td
    WHERE td.teacher_id = auth.uid()
    ORDER BY td.is_default DESC, td.created_at
    LIMIT 1
  ),
  prof AS (
    SELECT p.default_subject FROM public.profiles p WHERE p.id = auth.uid()
  ),
  disc AS (
    SELECT c.id AS course_id, c.name AS course_name, c.archived_at,
           COALESCE(td.subject, pr.default_subject, dd.subject) AS subject,
           CASE
             WHEN td.id IS NOT NULL THEN COALESCE(td.framework, public.default_framework_for_subject(td.subject))
             ELSE public.default_framework_for_subject(COALESCE(pr.default_subject, dd.subject))
           END AS framework
    FROM public.courses c
    LEFT JOIN public.teacher_disciplines td ON td.id = c.discipline_id
    LEFT JOIN default_disc dd ON true
    LEFT JOIN prof pr ON true
    WHERE c.teacher_id = auth.uid()
      AND (_include_archived OR (c.archived_at IS NULL AND public.is_within_active_school_year(c.id)))
  )
  SELECT d.course_id, d.course_name, d.subject, d.framework,
    (SELECT COUNT(*)::int FROM public.students st WHERE st.course_id = d.course_id AND st.merged_into IS NULL),
    (SELECT COUNT(*)::int FROM public.assignments a WHERE a.course_id = d.course_id),
    ROUND(AVG(lms.mastery_score)::numeric, 4) AS avg_mastery,
    ROUND(AVG(CASE WHEN lms.mastered THEN 1 ELSE 0 END)::numeric, 4) AS pct_mastered
  FROM disc d
  LEFT JOIN public.students st ON st.course_id = d.course_id AND st.merged_into IS NULL
  LEFT JOIN latest_ms lms ON lms.student_id = st.id
  GROUP BY d.course_id, d.course_name, d.subject, d.framework
  ORDER BY d.course_name;
$function$;