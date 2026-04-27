-- Add optional email to students for CSV roster matching
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_students_teacher_email_lower
  ON public.students (teacher_id, lower(email))
  WHERE email IS NOT NULL;