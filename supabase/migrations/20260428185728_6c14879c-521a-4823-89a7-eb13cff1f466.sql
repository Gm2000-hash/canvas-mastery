CREATE OR REPLACE FUNCTION public.analytics_backfill_report(_course_ids uuid[])
RETURNS TABLE(
  course_id uuid,
  course_name text,
  school_year text,
  subject text,
  grade text,
  framework text,
  student_count integer,
  assignment_count integer,
  submission_count integer,
  question_response_count integer,
  mastery_record_count integer,
  district_standard_count integer,
  district_standards_with_mastery integer,
  district_standards_missing integer,
  missing_standard_codes text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH scoped AS (
    SELECT c.id, c.name,
           public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) AS school_year,
           td.subject, td.grade, COALESCE(td.framework, 'STATE') AS framework
    FROM public.courses c
    LEFT JOIN public.teacher_disciplines td ON td.id = c.discipline_id
    WHERE c.teacher_id = auth.uid()
      AND c.id = ANY(_course_ids)
  ),
  counts AS (
    SELECT
      s.id AS course_id,
      (SELECT COUNT(*)::int FROM public.students st
         WHERE st.course_id = s.id AND st.merged_into IS NULL) AS student_count,
      (SELECT COUNT(*)::int FROM public.assignments a
         WHERE a.course_id = s.id) AS assignment_count,
      (SELECT COUNT(*)::int FROM public.submissions sub
         JOIN public.assignments a ON a.id = sub.assignment_id
         WHERE a.course_id = s.id) AS submission_count,
      (SELECT COUNT(*)::int FROM public.question_responses r
         JOIN public.quiz_questions q ON q.id = r.question_id
         JOIN public.assignments a ON a.id = q.assignment_id
         WHERE a.course_id = s.id) AS question_response_count,
      (SELECT COUNT(*)::int FROM public.mastery_snapshots ms
         JOIN public.students st ON st.id = ms.student_id
         WHERE st.course_id = s.id) AS mastery_record_count
    FROM scoped s
  ),
  district AS (
    SELECT s.id AS course_id,
           std.id AS standard_id,
           std.code AS standard_code
    FROM scoped s
    JOIN public.standards std
      ON (std.teacher_id = auth.uid() OR std.teacher_id IS NULL)
     AND (s.subject IS NULL OR std.subject = s.subject)
     AND (s.grade IS NULL OR std.grade = s.grade)
     AND COALESCE(std.framework, 'STATE') = s.framework
  ),
  covered AS (
    SELECT DISTINCT d.course_id, d.standard_id, d.standard_code
    FROM district d
    JOIN public.students st ON st.course_id = d.course_id
    JOIN public.mastery_snapshots ms
      ON ms.student_id = st.id AND ms.standard_id = d.standard_id
  ),
  district_summary AS (
    SELECT d.course_id,
           COUNT(DISTINCT d.standard_id)::int AS district_standard_count,
           COUNT(DISTINCT cv.standard_id)::int AS district_standards_with_mastery,
           ARRAY(
             SELECT DISTINCT d2.standard_code
             FROM district d2
             WHERE d2.course_id = d.course_id
               AND d2.standard_id NOT IN (
                 SELECT cv2.standard_id FROM covered cv2 WHERE cv2.course_id = d.course_id
               )
             ORDER BY d2.standard_code
             LIMIT 25
           ) AS missing_standard_codes,
           (COUNT(DISTINCT d.standard_id) - COUNT(DISTINCT cv.standard_id))::int AS district_standards_missing
    FROM district d
    LEFT JOIN covered cv ON cv.course_id = d.course_id AND cv.standard_id = d.standard_id
    GROUP BY d.course_id
  )
  SELECT
    s.id, s.name, s.school_year, s.subject, s.grade, s.framework,
    co.student_count, co.assignment_count, co.submission_count,
    co.question_response_count, co.mastery_record_count,
    COALESCE(ds.district_standard_count, 0),
    COALESCE(ds.district_standards_with_mastery, 0),
    COALESCE(ds.district_standards_missing, 0),
    COALESCE(ds.missing_standard_codes, ARRAY[]::text[])
  FROM scoped s
  LEFT JOIN counts co ON co.course_id = s.id
  LEFT JOIN district_summary ds ON ds.course_id = s.id
  ORDER BY s.name;
$function$;

REVOKE EXECUTE ON FUNCTION public.analytics_backfill_report(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analytics_backfill_report(uuid[]) TO authenticated;