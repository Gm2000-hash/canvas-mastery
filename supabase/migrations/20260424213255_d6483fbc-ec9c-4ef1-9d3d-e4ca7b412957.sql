-- 1. Add framework column to teacher_disciplines
ALTER TABLE public.teacher_disciplines
  ADD COLUMN IF NOT EXISTS framework text;

UPDATE public.teacher_disciplines
  SET framework = 'STATE'
  WHERE framework IS NULL;

-- 2. Add framework column to standards
ALTER TABLE public.standards
  ADD COLUMN IF NOT EXISTS framework text;

UPDATE public.standards
  SET framework = 'STATE'
  WHERE framework IS NULL;

-- 3. Prevent duplicate disciplines for the same (teacher, framework, state, subject, grade)
CREATE UNIQUE INDEX IF NOT EXISTS teacher_disciplines_unique_combo
  ON public.teacher_disciplines (
    teacher_id,
    COALESCE(framework, 'STATE'),
    state,
    subject,
    grade
  );

-- 4. Index for fast lookup of standards by (framework, state, subject, grade)
CREATE INDEX IF NOT EXISTS standards_framework_lookup
  ON public.standards (state, subject, grade, framework);

-- 5. Drop and recreate get_effective_discipline (return type changed → can't CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.get_effective_discipline(uuid);

CREATE FUNCTION public.get_effective_discipline(_course_id uuid)
RETURNS TABLE(id uuid, teacher_id uuid, state text, subject text, grade text, framework text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT td.id, td.teacher_id, td.state, td.subject, td.grade, td.framework
  FROM public.courses c
  LEFT JOIN public.teacher_disciplines td_course ON td_course.id = c.discipline_id
  LEFT JOIN public.teacher_disciplines td_default
    ON td_default.teacher_id = c.teacher_id AND td_default.is_default = true
  CROSS JOIN LATERAL (
    SELECT COALESCE(td_course.id, td_default.id) AS id,
           COALESCE(td_course.teacher_id, td_default.teacher_id) AS teacher_id,
           COALESCE(td_course.state, td_default.state) AS state,
           COALESCE(td_course.subject, td_default.subject) AS subject,
           COALESCE(td_course.grade, td_default.grade) AS grade,
           COALESCE(td_course.framework, td_default.framework, 'STATE') AS framework
  ) td
  WHERE c.id = _course_id AND td.id IS NOT NULL;
$function$;