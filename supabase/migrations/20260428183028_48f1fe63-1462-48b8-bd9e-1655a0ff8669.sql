-- =========================================================================
-- PART A: New columns on existing tables
-- =========================================================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS canvas_workflow_state text,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_courses_archived_at ON public.courses(archived_at);
CREATE INDEX IF NOT EXISTS idx_courses_teacher_archived ON public.courses(teacher_id, archived_at);

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS enrollment_state text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.students(id);

CREATE INDEX IF NOT EXISTS idx_students_archived_at ON public.students(archived_at);
CREATE INDEX IF NOT EXISTS idx_students_merged_into ON public.students(merged_into) WHERE merged_into IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_teacher_archived ON public.students(teacher_id, archived_at);

ALTER TABLE public.teacher_settings
  ADD COLUMN IF NOT EXISTS auto_archive_enabled boolean NOT NULL DEFAULT true;

-- =========================================================================
-- PART B: app_role enum + user_roles table + has_role()
-- =========================================================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "View own roles" ON public.user_roles;
CREATE POLICY "View own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies => only service role / migrations can grant.

-- Bootstrap: grant admin to gregmarsden2000
INSERT INTO public.user_roles (user_id, role)
VALUES ('2f82531f-7d3a-459d-9a5b-7e2d4e0430a4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- =========================================================================
-- PART C: historical_access_log
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.historical_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  course_id uuid,
  student_ids uuid[] NOT NULL DEFAULT '{}',
  reason text,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hist_log_teacher ON public.historical_access_log(teacher_id, accessed_at DESC);

ALTER TABLE public.historical_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers view own access logs" ON public.historical_access_log;
CREATE POLICY "Teachers view own access logs" ON public.historical_access_log
  FOR SELECT USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers create own access logs" ON public.historical_access_log;
CREATE POLICY "Teachers create own access logs" ON public.historical_access_log
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all access logs" ON public.historical_access_log;
CREATE POLICY "Admins view all access logs" ON public.historical_access_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- PART D: School-year + visibility helpers
-- =========================================================================

-- Returns the school-year cutoff date (June 9 of the year the course's school year ends).
-- School year runs July 1 -> June 9 of next calendar year.
-- Anchor: prefer end_at, then last_synced_at, then created_at.
CREATE OR REPLACE FUNCTION public.school_year_end_for(_anchor timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
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

-- Returns the school-year label "YYYY-YYYY" for a timestamp (e.g. 2024-2025)
CREATE OR REPLACE FUNCTION public.school_year_label(_anchor timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
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

-- Is the course still inside its active school year window?
CREATE OR REPLACE FUNCTION public.is_within_active_school_year(_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN c.id IS NULL THEN false
      ELSE now()::date <= public.school_year_end_for(
        COALESCE(c.end_at, c.last_synced_at, c.created_at)
      )
    END
  FROM public.courses c
  WHERE c.id = _course_id;
$$;

-- Should this course be considered "active" in the UI for the given teacher?
-- Honors archived_at AND the school-year guarantee.
CREATE OR REPLACE FUNCTION public.is_course_active(_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.archived_at IS NULL
    AND public.is_within_active_school_year(c.id)
  FROM public.courses c
  WHERE c.id = _course_id;
$$;

-- =========================================================================
-- PART E: Auto-archive helper (called by canvas-sync)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.run_auto_archive(_teacher_id uuid)
RETURNS TABLE(courses_archived int, students_archived int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enabled boolean;
  _c int := 0;
  _s int := 0;
BEGIN
  IF _teacher_id IS NULL THEN
    RAISE EXCEPTION 'teacher_id required';
  END IF;

  SELECT COALESCE(auto_archive_enabled, true) INTO _enabled
  FROM public.teacher_settings
  WHERE teacher_id = _teacher_id;

  IF _enabled IS NULL THEN _enabled := true; END IF;
  IF NOT _enabled THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- Archive courses where Canvas says completed AND school year cutoff has passed
  WITH updated AS (
    UPDATE public.courses
    SET archived_at = now()
    WHERE teacher_id = _teacher_id
      AND archived_at IS NULL
      AND (
        canvas_workflow_state = 'completed'
        OR (end_at IS NOT NULL AND end_at < now())
      )
      AND now()::date > public.school_year_end_for(
        COALESCE(end_at, last_synced_at, created_at)
      )
    RETURNING id
  )
  SELECT COUNT(*)::int INTO _c FROM updated;

  -- Archive students with non-active enrollment whose course's school year has passed
  WITH updated AS (
    UPDATE public.students st
    SET archived_at = now()
    FROM public.courses c
    WHERE st.teacher_id = _teacher_id
      AND st.archived_at IS NULL
      AND st.course_id = c.id
      AND st.enrollment_state IN ('completed', 'inactive')
      AND now()::date > public.school_year_end_for(
        COALESCE(c.end_at, c.last_synced_at, c.created_at)
      )
    RETURNING st.id
  )
  SELECT COUNT(*)::int INTO _s FROM updated;

  RETURN QUERY SELECT _c, _s;
END;
$$;

-- =========================================================================
-- PART F: Longitudinal student history
-- =========================================================================

CREATE OR REPLACE FUNCTION public.search_students_history(_query text)
RETURNS TABLE(
  student_id uuid,
  display_name text,
  real_name text,
  course_id uuid,
  course_name text,
  course_archived boolean,
  school_year text,
  last_activity timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    aa.last_at
  FROM public.students s
  JOIN public.courses c ON c.id = s.course_id
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
  ORDER BY aa.last_at DESC NULLS LAST, s.name;
$$;

CREATE OR REPLACE FUNCTION public.analytics_student_history(_student_id uuid)
RETURNS TABLE(
  school_year text,
  course_id uuid,
  course_name text,
  course_archived boolean,
  framework text,
  subject text,
  grade text,
  standard_id uuid,
  standard_code text,
  standard_description text,
  mastery_score numeric,
  mastered boolean,
  attempts int,
  last_assessed timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT s.id, s.course_id, s.teacher_id
    FROM public.students s
    WHERE s.id = _student_id
      AND s.teacher_id = auth.uid()
      AND s.merged_into IS NULL
  ),
  latest_ms AS (
    SELECT DISTINCT ON (ms.standard_id)
      ms.standard_id, ms.mastery_score, ms.mastered, ms.attempts, ms.computed_at
    FROM public.mastery_snapshots ms
    JOIN target t ON t.id = ms.student_id
    WHERE ms.teacher_id = auth.uid()
    ORDER BY ms.standard_id, ms.computed_at DESC
  )
  SELECT
    public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)),
    c.id,
    c.name,
    (c.archived_at IS NOT NULL OR NOT public.is_within_active_school_year(c.id)),
    COALESCE(s.framework, 'STATE'),
    s.subject,
    s.grade,
    s.id,
    s.code,
    s.description,
    lm.mastery_score,
    lm.mastered,
    lm.attempts,
    lm.computed_at
  FROM target t
  JOIN public.courses c ON c.id = t.course_id
  JOIN latest_ms lm ON true
  JOIN public.standards s ON s.id = lm.standard_id
  ORDER BY lm.computed_at DESC NULLS LAST, s.code;
$$;

-- =========================================================================
-- PART G: Cross-Canvas student merge
-- =========================================================================

CREATE OR REPLACE FUNCTION public.merge_student_records(_from uuid, _to uuid)
RETURNS TABLE(reassigned_snapshots int, reassigned_responses int, reassigned_submissions int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ms int := 0; _qr int := 0; _sub int := 0;
BEGIN
  IF _from = _to THEN
    RAISE EXCEPTION 'Cannot merge a student into itself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = _from AND teacher_id = auth.uid() AND merged_into IS NULL) THEN
    RAISE EXCEPTION 'Source student not found or not yours';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = _to AND teacher_id = auth.uid() AND merged_into IS NULL) THEN
    RAISE EXCEPTION 'Target student not found or not yours';
  END IF;

  WITH u AS (
    UPDATE public.mastery_snapshots SET student_id = _to
    WHERE student_id = _from AND teacher_id = auth.uid()
    RETURNING 1
  ) SELECT COUNT(*)::int INTO _ms FROM u;

  WITH u AS (
    UPDATE public.question_responses SET student_id = _to
    WHERE student_id = _from AND teacher_id = auth.uid()
    RETURNING 1
  ) SELECT COUNT(*)::int INTO _qr FROM u;

  WITH u AS (
    UPDATE public.submissions SET student_id = _to
    WHERE student_id = _from AND teacher_id = auth.uid()
    RETURNING 1
  ) SELECT COUNT(*)::int INTO _sub FROM u;

  UPDATE public.student_identities SET student_id = _to
  WHERE student_id = _from AND teacher_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.student_identities
      WHERE student_id = _to AND teacher_id = auth.uid()
    );

  DELETE FROM public.student_identities
  WHERE student_id = _from AND teacher_id = auth.uid();

  UPDATE public.students
  SET merged_into = _to
  WHERE id = _from AND teacher_id = auth.uid();

  INSERT INTO public.identity_reveals (teacher_id, course_id, reason, student_count)
  VALUES (
    auth.uid(),
    (SELECT course_id FROM public.students WHERE id = _to),
    '[merge-students from=' || _from::text || ' to=' || _to::text || ']',
    1
  );

  RETURN QUERY SELECT _ms, _qr, _sub;
END;
$$;

-- =========================================================================
-- PART H: Admin override for archive state
-- =========================================================================

CREATE OR REPLACE FUNCTION public.force_archive_state(_course_id uuid, _archive boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  UPDATE public.courses
  SET archived_at = CASE WHEN _archive THEN now() ELSE NULL END
  WHERE id = _course_id;

  RETURN FOUND;
END;
$$;

-- =========================================================================
-- PART I: Update existing analytics RPCs to skip merged students + accept school year
-- =========================================================================

CREATE OR REPLACE FUNCTION public.analytics_student_breakdown(
  _course_id uuid DEFAULT NULL::uuid,
  _school_year text DEFAULT NULL::text,
  _include_archived boolean DEFAULT false
)
RETURNS TABLE(student_id uuid, student_name text, course_id uuid, course_name text, standards_assessed integer, standards_mastered integer, avg_mastery numeric, last_activity timestamp with time zone)
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
  )
  SELECT st.id, st.name, c.id, c.name,
    COUNT(DISTINCT lms.standard_id)::int,
    COUNT(DISTINCT CASE WHEN lms.mastered THEN lms.standard_id END)::int,
    ROUND(AVG(lms.mastery_score)::numeric, 4),
    MAX(lms.computed_at)
  FROM public.students st
  JOIN public.courses c ON c.id = st.course_id
  LEFT JOIN latest_ms lms ON lms.student_id = st.id
  WHERE st.teacher_id = auth.uid()
    AND st.merged_into IS NULL
    AND (_course_id IS NULL OR st.course_id = _course_id)
    AND (_include_archived OR (st.archived_at IS NULL AND public.is_within_active_school_year(c.id)))
  GROUP BY st.id, st.name, st.sortable_name, c.id, c.name
  ORDER BY st.sortable_name NULLS LAST, st.name;
$function$;

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
  disc AS (
    SELECT c.id AS course_id, c.name AS course_name, c.archived_at,
           td.subject, COALESCE(td.framework, 'STATE') AS framework
    FROM public.courses c
    LEFT JOIN public.teacher_disciplines td ON td.id = c.discipline_id
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
