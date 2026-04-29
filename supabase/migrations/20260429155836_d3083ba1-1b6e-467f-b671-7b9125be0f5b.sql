-- Enable trigram similarity for fuzzy name matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. assignment_groups table
CREATE TABLE public.assignment_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  name text NOT NULL,
  kind public.assignment_kind NOT NULL DEFAULT 'assignment',
  subject text,
  grade text,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assignment_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own assignment groups"
ON public.assignment_groups
FOR ALL
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER trg_assignment_groups_updated_at
BEFORE UPDATE ON public.assignment_groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. assignments link + normalized name
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assignment_group_id uuid NULL REFERENCES public.assignment_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name_normalized text;

-- Normalization function: lowercase, strip tags, collapse whitespace, drop trailing punctuation
CREATE OR REPLACE FUNCTION public.normalize_assignment_name(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(BOTH ' .,:;!?-' FROM
    lower(
      regexp_replace(
        regexp_replace(coalesce(_name, ''), '<[^>]*>', ' ', 'g'),
        '\s+', ' ', 'g'
      )
    )
  );
$$;

-- Trigger to keep name_normalized in sync
CREATE OR REPLACE FUNCTION public.assignments_set_name_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.name_normalized := public.normalize_assignment_name(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignments_name_normalized ON public.assignments;
CREATE TRIGGER trg_assignments_name_normalized
BEFORE INSERT OR UPDATE OF name ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.assignments_set_name_normalized();

-- Backfill
UPDATE public.assignments
SET name_normalized = public.normalize_assignment_name(name)
WHERE name_normalized IS NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_teacher_name_norm
  ON public.assignments (teacher_id, name_normalized);
CREATE INDEX IF NOT EXISTS idx_assignments_group
  ON public.assignments (teacher_id, assignment_group_id);
CREATE INDEX IF NOT EXISTS idx_assignments_name_trgm
  ON public.assignments USING gin (name_normalized gin_trgm_ops);

-- 3. RPC: suggest groups (no writes)
CREATE OR REPLACE FUNCTION public.suggest_assignment_groups()
RETURNS TABLE(
  cluster_key text,
  suggested_name text,
  kind public.assignment_kind,
  subject text,
  grade text,
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
  WITH base AS (
    SELECT
      a.id,
      a.name,
      a.name_normalized,
      a.kind,
      a.course_id,
      c.name AS course_name,
      td.subject,
      td.grade
    FROM public.assignments a
    JOIN public.courses c ON c.id = a.course_id
    LEFT JOIN public.teacher_disciplines td ON td.id = c.discipline_id
    WHERE a.teacher_id = auth.uid()
      AND a.assignment_group_id IS NULL
      AND a.name_normalized IS NOT NULL
      AND length(a.name_normalized) >= 3
  ),
  clustered AS (
    SELECT
      (b.kind::text || '|' ||
       coalesce(b.subject,'') || '|' ||
       coalesce(b.grade,'') || '|' ||
       b.name_normalized) AS cluster_key,
      b.*
    FROM base b
  )
  SELECT
    cluster_key,
    (array_agg(name ORDER BY name))[1] AS suggested_name,
    (array_agg(kind))[1] AS kind,
    (array_agg(subject))[1] AS subject,
    (array_agg(grade))[1] AS grade,
    COUNT(*)::int AS member_count,
    COUNT(DISTINCT course_id)::int AS course_count,
    array_agg(id) AS assignment_ids,
    array_agg(DISTINCT course_id) AS course_ids,
    array_agg(DISTINCT course_name) AS course_names
  FROM clustered
  GROUP BY cluster_key
  HAVING COUNT(DISTINCT course_id) >= 2
  ORDER BY COUNT(DISTINCT course_id) DESC, member_count DESC, suggested_name;
$$;

-- 4. RPC: apply (create or extend) a group
CREATE OR REPLACE FUNCTION public.apply_assignment_group(
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
  _subject text;
  _grade text;
BEGIN
  IF _assignment_ids IS NULL OR array_length(_assignment_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No assignments provided';
  END IF;

  -- Validate ownership of every assignment
  IF EXISTS (
    SELECT 1 FROM public.assignments
    WHERE id = ANY(_assignment_ids) AND teacher_id <> auth.uid()
  ) THEN
    RAISE EXCEPTION 'Cannot group assignments you do not own';
  END IF;

  -- Pick representative kind/subject/grade from members
  SELECT a.kind,
         (SELECT td.subject FROM public.courses c
            LEFT JOIN public.teacher_disciplines td ON td.id = c.discipline_id
            WHERE c.id = a.course_id),
         (SELECT td.grade FROM public.courses c
            LEFT JOIN public.teacher_disciplines td ON td.id = c.discipline_id
            WHERE c.id = a.course_id)
  INTO _kind, _subject, _grade
  FROM public.assignments a
  WHERE a.id = ANY(_assignment_ids)
  ORDER BY a.created_at
  LIMIT 1;

  IF _group_id IS NULL THEN
    INSERT INTO public.assignment_groups (teacher_id, name, kind, subject, grade, confirmed)
    VALUES (auth.uid(), _name, COALESCE(_kind,'assignment'), _subject, _grade, true)
    RETURNING id INTO _gid;
  ELSE
    -- Ensure ownership
    IF NOT EXISTS (
      SELECT 1 FROM public.assignment_groups WHERE id = _group_id AND teacher_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Group not found';
    END IF;
    UPDATE public.assignment_groups
       SET name = COALESCE(_name, name), confirmed = true, updated_at = now()
     WHERE id = _group_id;
    _gid := _group_id;
  END IF;

  UPDATE public.assignments
     SET assignment_group_id = _gid
   WHERE id = ANY(_assignment_ids)
     AND teacher_id = auth.uid();

  RETURN _gid;
END;
$$;

-- 5. RPC: remove an assignment from its group
CREATE OR REPLACE FUNCTION public.unlink_assignment_from_group(_assignment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.assignments
     SET assignment_group_id = NULL
   WHERE id = _assignment_id AND teacher_id = auth.uid();
  RETURN FOUND;
END;
$$;

-- 6. RPC: list confirmed groups with members
CREATE OR REPLACE FUNCTION public.list_assignment_groups()
RETURNS TABLE(
  group_id uuid,
  name text,
  kind public.assignment_kind,
  subject text,
  grade text,
  confirmed boolean,
  member_count integer,
  course_count integer,
  assignment_ids uuid[],
  course_names text[],
  total_submissions integer,
  avg_percentage numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.name,
    g.kind,
    g.subject,
    g.grade,
    g.confirmed,
    COUNT(a.id)::int,
    COUNT(DISTINCT a.course_id)::int,
    array_agg(a.id) FILTER (WHERE a.id IS NOT NULL),
    array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL),
    (SELECT COUNT(*)::int FROM public.submissions sub
       WHERE sub.teacher_id = auth.uid()
         AND sub.assignment_id IN (
           SELECT id FROM public.assignments WHERE assignment_group_id = g.id AND teacher_id = auth.uid()
         )),
    (SELECT ROUND(AVG(sub.percentage)::numeric, 2) FROM public.submissions sub
       WHERE sub.teacher_id = auth.uid()
         AND sub.percentage IS NOT NULL
         AND sub.assignment_id IN (
           SELECT id FROM public.assignments WHERE assignment_group_id = g.id AND teacher_id = auth.uid()
         ))
  FROM public.assignment_groups g
  LEFT JOIN public.assignments a ON a.assignment_group_id = g.id AND a.teacher_id = auth.uid()
  LEFT JOIN public.courses c ON c.id = a.course_id
  WHERE g.teacher_id = auth.uid()
  GROUP BY g.id
  ORDER BY g.updated_at DESC;
$$;

-- 7. Replace analytics_compare_classes to support _assignment_group_id
DROP FUNCTION IF EXISTS public.analytics_compare_classes(uuid[], uuid, uuid);

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
  WITH group_assignments AS (
    SELECT a.id
    FROM public.assignments a
    WHERE _assignment_group_id IS NOT NULL
      AND a.teacher_id = auth.uid()
      AND a.assignment_group_id = _assignment_group_id
  ),
  source AS (
    -- Single assignment
    SELECT st.course_id,
           c.name AS course_name,
           sub.student_id,
           (sub.percentage / 100.0)::numeric AS score
    FROM public.submissions sub
    JOIN public.students st ON st.id = sub.student_id
    JOIN public.courses c ON c.id = st.course_id
    WHERE _assignment_id IS NOT NULL
      AND sub.teacher_id = auth.uid()
      AND sub.assignment_id = _assignment_id
      AND sub.percentage IS NOT NULL
      AND st.course_id = ANY(_course_ids)
      AND st.merged_into IS NULL

    UNION ALL

    -- Assignment group: any member assignment counts
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