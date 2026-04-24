-- 1) teacher_disciplines table
CREATE TABLE public.teacher_disciplines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL,
  state text NOT NULL,
  subject text NOT NULL,
  grade text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, state, subject, grade)
);

ALTER TABLE public.teacher_disciplines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own disciplines"
  ON public.teacher_disciplines
  FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- One default per teacher
CREATE UNIQUE INDEX teacher_disciplines_one_default_per_teacher
  ON public.teacher_disciplines (teacher_id)
  WHERE is_default;

CREATE INDEX teacher_disciplines_teacher_idx
  ON public.teacher_disciplines (teacher_id);

CREATE TRIGGER teacher_disciplines_updated_at
  BEFORE UPDATE ON public.teacher_disciplines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Add discipline_id to courses
ALTER TABLE public.courses
  ADD COLUMN discipline_id uuid REFERENCES public.teacher_disciplines(id) ON DELETE SET NULL;

CREATE INDEX courses_discipline_idx ON public.courses (discipline_id);

-- 3) Backfill: create a default discipline per teacher whose profile has all three fields
INSERT INTO public.teacher_disciplines (teacher_id, state, subject, grade, is_default)
SELECT p.id, p.state, p.default_subject, p.default_grade, true
FROM public.profiles p
WHERE p.state IS NOT NULL
  AND p.default_subject IS NOT NULL
  AND p.default_grade IS NOT NULL
ON CONFLICT (teacher_id, state, subject, grade) DO NOTHING;

-- 4) Backfill: link existing courses to the teacher's default discipline
UPDATE public.courses c
SET discipline_id = td.id
FROM public.teacher_disciplines td
WHERE td.teacher_id = c.teacher_id
  AND td.is_default = true
  AND c.discipline_id IS NULL;

-- 5) Helper: get effective discipline (course-level OR teacher default) used by tag-standards
CREATE OR REPLACE FUNCTION public.get_effective_discipline(_course_id uuid)
RETURNS TABLE (id uuid, teacher_id uuid, state text, subject text, grade text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT td.id, td.teacher_id, td.state, td.subject, td.grade
  FROM public.courses c
  LEFT JOIN public.teacher_disciplines td_course ON td_course.id = c.discipline_id
  LEFT JOIN public.teacher_disciplines td_default
    ON td_default.teacher_id = c.teacher_id AND td_default.is_default = true
  CROSS JOIN LATERAL (
    SELECT COALESCE(td_course.id, td_default.id) AS id,
           COALESCE(td_course.teacher_id, td_default.teacher_id) AS teacher_id,
           COALESCE(td_course.state, td_default.state) AS state,
           COALESCE(td_course.subject, td_default.subject) AS subject,
           COALESCE(td_course.grade, td_default.grade) AS grade
  ) td
  WHERE c.id = _course_id AND td.id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_effective_discipline(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_discipline(uuid) TO authenticated;