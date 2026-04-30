-- Harden department_membership: only authenticated sessions may execute it.
-- The function relies on auth.uid() and is SECURITY DEFINER, so an anon caller
-- already gets an empty result, but revoking EXECUTE from public/anon prevents
-- the function from being part of the unauthenticated API surface at all.
REVOKE ALL ON FUNCTION public.department_membership(text, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.department_membership(text, text[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.department_membership(text, text[], text) TO authenticated;

-- Also reject calls that arrive without an authenticated user, as a defense-in-depth
-- guard in case the function is ever exposed via a different role in the future.
CREATE OR REPLACE FUNCTION public.department_membership(
  _subject text,
  _grades  text[] DEFAULT NULL,
  _school_year text DEFAULT NULL
)
RETURNS TABLE(teacher_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Only members of the subject (i.e. callers who have a matching
  -- teacher_disciplines row themselves) may enumerate peers. This stops a
  -- random authenticated user from probing other subjects' rosters.
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_disciplines td
    WHERE td.teacher_id = auth.uid()
      AND td.subject = _subject
  ) THEN
    RETURN;  -- empty result: caller is not part of this department
  END IF;

  RETURN QUERY
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
END;
$$;

-- Reapply grants to the recreated function (CREATE OR REPLACE preserves them, but
-- be explicit so this migration is self-contained).
REVOKE ALL ON FUNCTION public.department_membership(text, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.department_membership(text, text[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.department_membership(text, text[], text) TO authenticated;