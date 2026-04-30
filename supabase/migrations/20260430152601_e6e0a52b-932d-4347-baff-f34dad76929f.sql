CREATE OR REPLACE FUNCTION public.department_membership(
  _subject text,
  _grades  text[] DEFAULT NULL,
  _school_year text DEFAULT NULL
)
RETURNS TABLE(teacher_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- A teacher belongs to a subject's department if they have a matching
  -- teacher_disciplines row. The optional course/school-year filter only
  -- applies when grades or a school year are explicitly provided.
  SELECT DISTINCT td.teacher_id
  FROM public.teacher_disciplines td
  WHERE td.subject = _subject
    AND (_grades IS NULL OR array_length(_grades,1) IS NULL OR td.grade = ANY(_grades))
    AND (
      _school_year IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.teacher_id = td.teacher_id
          AND c.discipline_id = td.id
          AND c.archived_at IS NULL
          AND public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) = _school_year
      )
    );
$$;