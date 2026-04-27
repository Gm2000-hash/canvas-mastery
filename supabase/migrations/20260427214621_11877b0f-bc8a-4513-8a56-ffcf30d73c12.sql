
-- 1. teacher_settings: new prefs
ALTER TABLE public.teacher_settings
  ADD COLUMN IF NOT EXISTS pseudonym_style text NOT NULL DEFAULT 'numeric',
  ADD COLUMN IF NOT EXISTS reveal_default boolean NOT NULL DEFAULT false;

-- 2. students: pseudonym fields
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS pseudonym_seq integer,
  ADD COLUMN IF NOT EXISTS pseudonym text;

-- 3. student_identities (locked-down PII vault)
CREATE TABLE IF NOT EXISTS public.student_identities (
  student_id uuid PRIMARY KEY,
  teacher_id uuid NOT NULL,
  real_name text NOT NULL,
  real_sortable_name text,
  email text,
  canvas_user_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_identities ENABLE ROW LEVEL SECURITY;

-- Deny-by-default. Only edge functions (service role) bypass RLS.
-- The reveal RPC is SECURITY DEFINER and reads with elevated rights.
-- No SELECT/INSERT/UPDATE/DELETE policies are created for client roles.

CREATE INDEX IF NOT EXISTS student_identities_teacher_idx
  ON public.student_identities(teacher_id);

CREATE TRIGGER student_identities_set_updated_at
  BEFORE UPDATE ON public.student_identities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. identity_reveals (audit log)
CREATE TABLE IF NOT EXISTS public.identity_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  course_id uuid,
  revealed_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  student_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.identity_reveals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view own reveal logs"
  ON public.identity_reveals FOR SELECT
  USING (teacher_id = auth.uid());

-- Inserts happen via the SECURITY DEFINER RPC; no client INSERT policy needed.

CREATE INDEX IF NOT EXISTS identity_reveals_teacher_idx
  ON public.identity_reveals(teacher_id, revealed_at DESC);

-- 5. Backfill: copy current real names into student_identities, then pseudonymize students
INSERT INTO public.student_identities (student_id, teacher_id, real_name, real_sortable_name, email, canvas_user_id)
SELECT s.id, s.teacher_id, s.name, s.sortable_name, s.email, s.canvas_user_id
FROM public.students s
ON CONFLICT (student_id) DO NOTHING;

-- Assign per-teacher pseudonym sequences based on existing sortable_name then name
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY teacher_id
    ORDER BY COALESCE(sortable_name, name), id
  ) AS rn
  FROM public.students
  WHERE pseudonym_seq IS NULL
)
UPDATE public.students s
SET pseudonym_seq = o.rn,
    pseudonym = 'Student ' || lpad(o.rn::text, 3, '0')
FROM ordered o
WHERE s.id = o.id;

-- Replace name/sortable_name with pseudonym; null out email
UPDATE public.students
SET name = pseudonym,
    sortable_name = pseudonym,
    email = NULL
WHERE pseudonym IS NOT NULL;

-- 6. RPC: reveal_student_identities
CREATE OR REPLACE FUNCTION public.reveal_student_identities(_course_id uuid, _reason text DEFAULT NULL)
RETURNS TABLE(student_id uuid, real_name text, real_sortable_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  -- Authorize: caller must be the teacher who owns the course
  IF NOT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id AND c.teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this course';
  END IF;

  SELECT COUNT(*) INTO _count
  FROM public.students st
  WHERE st.course_id = _course_id AND st.teacher_id = auth.uid();

  INSERT INTO public.identity_reveals (teacher_id, course_id, reason, student_count)
  VALUES (auth.uid(), _course_id, NULLIF(_reason, ''), _count);

  RETURN QUERY
  SELECT si.student_id, si.real_name, si.real_sortable_name, si.email
  FROM public.student_identities si
  JOIN public.students st ON st.id = si.student_id
  WHERE st.course_id = _course_id
    AND st.teacher_id = auth.uid()
    AND si.teacher_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_student_identities(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reveal_student_identities(uuid, text) TO authenticated;
