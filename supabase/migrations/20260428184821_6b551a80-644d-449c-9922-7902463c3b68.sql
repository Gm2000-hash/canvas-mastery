CREATE OR REPLACE FUNCTION public.search_students_history(
  _query text,
  _subject text DEFAULT NULL,
  _grade text DEFAULT NULL,
  _trimester text DEFAULT NULL,
  _school_year text DEFAULT NULL
)
RETURNS TABLE(
  student_id uuid,
  display_name text,
  real_name text,
  course_id uuid,
  course_name text,
  course_archived boolean,
  school_year text,
  last_activity timestamp with time zone,
  subject text,
  grade text,
  term text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH last_act AS (
    SELECT student_id, MAX(created_at) AS last_at
    FROM public.question_responses
    WHERE teacher_id = auth.uid()
    GROUP BY student_id
    UNION ALL
    SELECT student_id, MAX(COALESCE(graded_at, submitted_at, created_at)) AS last_at
    FROM public.submissions
    WHERE teacher_id = auth.uid()
    GROUP BY student_id
  ),
  agg_act AS (
    SELECT student_id, MAX(last_at) AS last_at FROM last_act GROUP BY student_id
  )
  SELECT
    s.id,
    s.name,
    si.real_name,
    s.course_id,
    c.name,
    (c.archived_at IS NOT NULL OR NOT public.is_within_active_school_year(c.id)),
    public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)),
    aa.last_at,
    td.subject,
    td.grade,
    c.term
  FROM public.students s
  JOIN public.courses c ON c.id = s.course_id
  LEFT JOIN public.teacher_disciplines td ON td.id = c.discipline_id
  LEFT JOIN public.student_identities si
    ON si.student_id = s.id AND si.teacher_id = auth.uid()
  LEFT JOIN agg_act aa ON aa.student_id = s.id
  WHERE s.teacher_id = auth.uid()
    AND s.merged_into IS NULL
    AND (
      _query IS NULL
      OR _query = ''
      OR s.name ILIKE '%' || _query || '%'
      OR s.sortable_name ILIKE '%' || _query || '%'
      OR (si.real_name IS NOT NULL AND si.real_name ILIKE '%' || _query || '%')
      OR (si.real_sortable_name IS NOT NULL AND si.real_sortable_name ILIKE '%' || _query || '%')
    )
    AND (_subject IS NULL OR _subject = '' OR td.subject = _subject)
    AND (_grade IS NULL OR _grade = '' OR td.grade = _grade)
    AND (_trimester IS NULL OR _trimester = '' OR c.term ILIKE '%' || _trimester || '%')
    AND (_school_year IS NULL OR _school_year = '' OR public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) = _school_year)
  ORDER BY aa.last_at DESC NULLS LAST, s.name;
$function$;

REVOKE EXECUTE ON FUNCTION public.search_students_history(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_students_history(text, text, text, text, text) TO authenticated;