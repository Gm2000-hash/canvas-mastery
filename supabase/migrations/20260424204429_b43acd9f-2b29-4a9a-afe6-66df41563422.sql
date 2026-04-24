
-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  state TEXT,
  default_grade TEXT,
  default_subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- STANDARDS
-- =========================
CREATE TABLE public.standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = shared/seeded
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_standards_lookup ON public.standards(state, subject, grade);
CREATE INDEX idx_standards_teacher ON public.standards(teacher_id);

ALTER TABLE public.standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View shared or own standards" ON public.standards
  FOR SELECT USING (teacher_id IS NULL OR teacher_id = auth.uid());
CREATE POLICY "Insert own standards" ON public.standards
  FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Update own standards" ON public.standards
  FOR UPDATE USING (teacher_id = auth.uid());
CREATE POLICY "Delete own standards" ON public.standards
  FOR DELETE USING (teacher_id = auth.uid());

-- =========================
-- CANVAS CREDENTIALS (sensitive)
-- =========================
CREATE TABLE public.canvas_credentials (
  teacher_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.canvas_credentials ENABLE ROW LEVEL SECURITY;

-- Teachers can write/update their token but NOT read it back (only edge functions with service role can)
CREATE POLICY "Insert own canvas credentials" ON public.canvas_credentials
  FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Update own canvas credentials" ON public.canvas_credentials
  FOR UPDATE USING (teacher_id = auth.uid());
CREATE POLICY "Delete own canvas credentials" ON public.canvas_credentials
  FOR DELETE USING (teacher_id = auth.uid());

-- Safe view: lets teachers check IF a token exists & last_sync_at, without reading the token itself
CREATE OR REPLACE VIEW public.canvas_connection_status
WITH (security_invoker = true) AS
SELECT
  teacher_id,
  base_url,
  last_sync_at,
  (api_token IS NOT NULL AND length(api_token) > 0) AS connected,
  updated_at
FROM public.canvas_credentials;

CREATE TRIGGER canvas_creds_updated_at BEFORE UPDATE ON public.canvas_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- COURSES
-- =========================
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canvas_course_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  course_code TEXT,
  term TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, canvas_course_id)
);

CREATE INDEX idx_courses_teacher ON public.courses(teacher_id);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own courses" ON public.courses
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- =========================
-- STUDENTS
-- =========================
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  canvas_user_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  sortable_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, canvas_user_id)
);

CREATE INDEX idx_students_course ON public.students(course_id);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own students" ON public.students
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- =========================
-- ASSIGNMENTS
-- =========================
CREATE TYPE assignment_kind AS ENUM ('assignment', 'quiz');

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  canvas_assignment_id BIGINT NOT NULL,
  canvas_quiz_id BIGINT,
  kind assignment_kind NOT NULL DEFAULT 'assignment',
  name TEXT NOT NULL,
  description TEXT,
  points_possible NUMERIC,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, canvas_assignment_id)
);

CREATE INDEX idx_assignments_course ON public.assignments(course_id);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own assignments" ON public.assignments
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- =========================
-- QUIZ QUESTIONS
-- =========================
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  canvas_question_id BIGINT NOT NULL,
  position INT,
  question_text TEXT,
  points_possible NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, canvas_question_id)
);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own quiz questions" ON public.quiz_questions
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- =========================
-- ASSIGNMENT <-> STANDARD
-- =========================
CREATE TABLE public.assignment_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  standard_id UUID NOT NULL REFERENCES public.standards(id) ON DELETE CASCADE,
  ai_suggested BOOLEAN NOT NULL DEFAULT false,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confidence NUMERIC,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, standard_id)
);

CREATE INDEX idx_as_assignment ON public.assignment_standards(assignment_id);
CREATE INDEX idx_as_standard ON public.assignment_standards(standard_id);

ALTER TABLE public.assignment_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own assignment_standards" ON public.assignment_standards
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- =========================
-- QUESTION <-> STANDARD
-- =========================
CREATE TABLE public.question_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  standard_id UUID NOT NULL REFERENCES public.standards(id) ON DELETE CASCADE,
  ai_suggested BOOLEAN NOT NULL DEFAULT false,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confidence NUMERIC,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, standard_id)
);

ALTER TABLE public.question_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own question_standards" ON public.question_standards
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- =========================
-- SUBMISSIONS
-- =========================
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score NUMERIC,
  points_possible NUMERIC,
  percentage NUMERIC,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  workflow_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX idx_submissions_student ON public.submissions(student_id);
CREATE INDEX idx_submissions_assignment ON public.submissions(assignment_id);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own submissions" ON public.submissions
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- =========================
-- QUESTION RESPONSES (per-student per-question)
-- =========================
CREATE TABLE public.question_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  points NUMERIC,
  points_possible NUMERIC,
  correct BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, student_id)
);

ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own question responses" ON public.question_responses
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- =========================
-- MASTERY SNAPSHOTS
-- =========================
CREATE TABLE public.mastery_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  standard_id UUID NOT NULL REFERENCES public.standards(id) ON DELETE CASCADE,
  mastery_score NUMERIC NOT NULL,        -- 0..1
  attempts INT NOT NULL DEFAULT 0,
  mastered BOOLEAN NOT NULL DEFAULT false,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mastery_student_standard ON public.mastery_snapshots(student_id, standard_id, computed_at DESC);
CREATE INDEX idx_mastery_teacher ON public.mastery_snapshots(teacher_id);

ALTER TABLE public.mastery_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own mastery snapshots" ON public.mastery_snapshots
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- =========================
-- TEACHER SETTINGS
-- =========================
CREATE TABLE public.teacher_settings (
  teacher_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mastery_threshold NUMERIC NOT NULL DEFAULT 0.80,
  attempt_window INT NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own settings" ON public.teacher_settings
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER teacher_settings_updated_at BEFORE UPDATE ON public.teacher_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
