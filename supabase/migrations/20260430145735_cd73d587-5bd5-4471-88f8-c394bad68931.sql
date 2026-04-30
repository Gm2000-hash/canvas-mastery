
-- ============================================================
-- Class groups: user-defined groups of classes
-- ============================================================

CREATE TABLE public.class_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own class groups" ON public.class_groups
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE TRIGGER trg_class_groups_updated_at
  BEFORE UPDATE ON public.class_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.class_group_courses (
  class_group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_group_id, course_id)
);
ALTER TABLE public.class_group_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own class group courses" ON public.class_group_courses
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE INDEX idx_cgc_teacher_course ON public.class_group_courses (teacher_id, course_id);
CREATE INDEX idx_cgc_group ON public.class_group_courses (class_group_id);

-- Link assignment_groups to a class_group (nullable for legacy rows)
ALTER TABLE public.assignment_groups
  ADD COLUMN IF NOT EXISTS class_group_id uuid NULL
  REFERENCES public.class_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_groups_class_group
  ON public.assignment_groups (teacher_id, class_group_id);

-- ============================================================
-- AI suggestion storage
-- ============================================================
CREATE TABLE public.assessment_match_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  -- Each suggestion is a cluster of assignment ids the AI thinks represent the same assessment
  assignment_ids uuid[] NOT NULL,
  suggested_name text NOT NULL,
  confidence numeric,         -- 0..1
  rationale text,
  dismissed_at timestamptz,
  applied_group_id uuid NULL REFERENCES public.assignment_groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assessment_match_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own assessment suggestions" ON public.assessment_match_suggestions
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE INDEX idx_ams_group ON public.assessment_match_suggestions (teacher_id, class_group_id);
CREATE TRIGGER trg_ams_updated_at
  BEFORE UPDATE ON public.assessment_match_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RPCs
-- ============================================================

-- Create a class group with an initial set of classes
CREATE OR REPLACE FUNCTION public.create_class_group(
  _name text,
  _course_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _gid uuid;
BEGIN
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Name required';
  END IF;

  INSERT INTO public.class_groups (teacher_id, name)
  VALUES (auth.uid(), trim(_name))
  RETURNING id INTO _gid;

  IF _course_ids IS NOT NULL AND array_length(_course_ids, 1) > 0 THEN
    -- Validate ownership
    IF EXISTS (
      SELECT 1 FROM public.courses
      WHERE id = ANY(_course_ids) AND teacher_id <> auth.uid()
    ) THEN
      RAISE EXCEPTION 'Cannot add classes you do not own';
    END IF;

    INSERT INTO public.class_group_courses (class_group_id, course_id, teacher_id)
    SELECT _gid, c, auth.uid() FROM unnest(_course_ids) AS c
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN _gid;
END;
$$;

-- Update name / membership of a class group (replaces full membership set)
CREATE OR REPLACE FUNCTION public.update_class_group(
  _id uuid,
  _name text,
  _course_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.class_groups WHERE id = _id AND teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Class group not found';
  END IF;

  IF _name IS NOT NULL AND length(trim(_name)) > 0 THEN
    UPDATE public.class_groups SET name = trim(_name), updated_at = now() WHERE id = _id;
  END IF;

  IF _course_ids IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.courses
      WHERE id = ANY(_course_ids) AND teacher_id <> auth.uid()
    ) THEN
      RAISE EXCEPTION 'Cannot add classes you do not own';
    END IF;

    DELETE FROM public.class_group_courses
     WHERE class_group_id = _id
       AND teacher_id = auth.uid()
       AND course_id <> ALL(COALESCE(_course_ids, ARRAY[]::uuid[]));

    INSERT INTO public.class_group_courses (class_group_id, course_id, teacher_id)
    SELECT _id, c, auth.uid() FROM unnest(_course_ids) AS c
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

-- List class groups with summary info
CREATE OR REPLACE FUNCTION public.list_class_groups()
RETURNS TABLE (
  id uuid,
  name text,
  course_count integer,
  course_ids uuid[],
  course_names text[],
  assessment_group_count integer,
  pending_suggestion_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.name,
    COALESCE(cc.course_count, 0)::int,
    COALESCE(cc.course_ids, ARRAY[]::uuid[]),
    COALESCE(cc.course_names, ARRAY[]::text[]),
    COALESCE(ag.cnt, 0)::int,
    COALESCE(sg.cnt, 0)::int,
    g.created_at,
    g.updated_at
  FROM public.class_groups g
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS course_count,
           array_agg(cgc.course_id ORDER BY c.name) AS course_ids,
           array_agg(c.name ORDER BY c.name) AS course_names
    FROM public.class_group_courses cgc
    JOIN public.courses c ON c.id = cgc.course_id
    WHERE cgc.class_group_id = g.id
  ) cc ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.assignment_groups
    WHERE class_group_id = g.id AND teacher_id = auth.uid()
  ) ag ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.assessment_match_suggestions
    WHERE class_group_id = g.id AND teacher_id = auth.uid()
      AND dismissed_at IS NULL AND applied_group_id IS NULL
  ) sg ON true
  WHERE g.teacher_id = auth.uid()
  ORDER BY g.updated_at DESC;
$$;

-- Suggest groups (trigram-based) restricted to one class group's classes
CREATE OR REPLACE FUNCTION public.suggest_assignment_groups_in_class_group(
  _class_group_id uuid
)
RETURNS TABLE (
  cluster_key text,
  suggested_name text,
  kind public.assignment_kind,
  member_count integer,
  course_count integer,
  assignment_ids uuid[],
  course_ids uuid[],
  course_names text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH class_courses AS (
    SELECT course_id FROM public.class_group_courses
    WHERE class_group_id = _class_group_id AND teacher_id = auth.uid()
  ),
  base AS (
    SELECT
      a.id, a.name, a.name_normalized, a.kind, a.course_id,
      c.name AS course_name
    FROM public.assignments a
    JOIN public.courses c ON c.id = a.course_id
    WHERE a.teacher_id = auth.uid()
      AND a.assignment_group_id IS NULL
      AND a.name_normalized IS NOT NULL
      AND length(a.name_normalized) >= 3
      AND a.course_id IN (SELECT course_id FROM class_courses)
  ),
  clustered AS (
    SELECT (b.kind::text || '|' || b.name_normalized) AS cluster_key, b.*
    FROM base b
  )
  SELECT
    cluster_key,
    (array_agg(name ORDER BY name))[1] AS suggested_name,
    (array_agg(kind))[1] AS kind,
    COUNT(*)::int,
    COUNT(DISTINCT course_id)::int,
    array_agg(id),
    array_agg(DISTINCT course_id),
    array_agg(DISTINCT course_name)
  FROM clustered
  GROUP BY cluster_key
  HAVING COUNT(DISTINCT course_id) >= 2
  ORDER BY COUNT(DISTINCT course_id) DESC, COUNT(*) DESC, suggested_name;
$$;

-- Apply assignment group scoped to a class group
CREATE OR REPLACE FUNCTION public.apply_assignment_group_in_class_group(
  _class_group_id uuid,
  _name text,
  _assignment_ids uuid[],
  _group_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _gid uuid;
  _kind public.assignment_kind;
BEGIN
  IF _assignment_ids IS NULL OR array_length(_assignment_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No assignments provided';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.class_groups
    WHERE id = _class_group_id AND teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Class group not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.assignments
    WHERE id = ANY(_assignment_ids) AND teacher_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'Cannot group assignments you do not own';
  END IF;

  SELECT a.kind INTO _kind
  FROM public.assignments a WHERE a.id = ANY(_assignment_ids)
  ORDER BY a.created_at LIMIT 1;

  IF _group_id IS NULL THEN
    INSERT INTO public.assignment_groups (teacher_id, name, kind, confirmed, class_group_id)
    VALUES (auth.uid(), _name, COALESCE(_kind, 'assignment'), true, _class_group_id)
    RETURNING id INTO _gid;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.assignment_groups WHERE id = _group_id AND teacher_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Group not found';
    END IF;
    UPDATE public.assignment_groups
       SET name = COALESCE(_name, name),
           confirmed = true,
           class_group_id = _class_group_id,
           updated_at = now()
     WHERE id = _group_id;
    _gid := _group_id;
  END IF;

  UPDATE public.assignments
     SET assignment_group_id = _gid
   WHERE id = ANY(_assignment_ids) AND teacher_id = auth.uid();

  RETURN _gid;
END;
$$;
