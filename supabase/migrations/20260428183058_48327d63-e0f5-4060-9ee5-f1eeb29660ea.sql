-- Pin search_path on the two IMMUTABLE helpers
CREATE OR REPLACE FUNCTION public.school_year_end_for(_anchor timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN _anchor IS NULL THEN NULL
      WHEN EXTRACT(MONTH FROM _anchor) >= 7
        THEN make_date((EXTRACT(YEAR FROM _anchor)::int) + 1, 6, 9)
      ELSE
        make_date(EXTRACT(YEAR FROM _anchor)::int, 6, 9)
    END
$$;

CREATE OR REPLACE FUNCTION public.school_year_label(_anchor timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN _anchor IS NULL THEN NULL
      WHEN EXTRACT(MONTH FROM _anchor) >= 7
        THEN (EXTRACT(YEAR FROM _anchor)::int)::text || '-' || ((EXTRACT(YEAR FROM _anchor)::int) + 1)::text
      ELSE
        ((EXTRACT(YEAR FROM _anchor)::int) - 1)::text || '-' || (EXTRACT(YEAR FROM _anchor)::int)::text
    END
$$;

-- Revoke anon EXECUTE on every SECURITY DEFINER function we created or replaced.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_within_active_school_year(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.is_within_active_school_year(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_course_active(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.is_course_active(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.run_auto_archive(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.run_auto_archive(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.search_students_history(text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.search_students_history(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.analytics_student_history(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.analytics_student_history(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.merge_student_records(uuid, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.merge_student_records(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.force_archive_state(uuid, boolean) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.force_archive_state(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.analytics_student_breakdown(uuid, text, boolean) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.analytics_student_breakdown(uuid, text, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.analytics_class_breakdown(text, boolean) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.analytics_class_breakdown(text, boolean) TO authenticated;
