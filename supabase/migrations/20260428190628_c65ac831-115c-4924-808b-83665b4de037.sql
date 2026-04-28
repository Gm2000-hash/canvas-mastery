ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS quiz_engine text;
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS item_type text;
CREATE INDEX IF NOT EXISTS idx_assignments_quiz_engine ON public.assignments(quiz_engine) WHERE quiz_engine IS NOT NULL;