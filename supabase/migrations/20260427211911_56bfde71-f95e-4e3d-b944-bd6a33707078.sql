ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_courses_hidden ON public.courses (teacher_id, hidden);