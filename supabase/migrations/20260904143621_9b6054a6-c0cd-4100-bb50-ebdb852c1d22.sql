-- Google credentials (server-only)
CREATE TABLE public.google_credentials (
  teacher_id uuid PRIMARY KEY,
  email text,
  refresh_token_ciphertext text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.google_credentials TO service_role;
ALTER TABLE public.google_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_credentials_no_direct_select ON public.google_credentials FOR SELECT TO authenticated USING (false);
CREATE POLICY google_credentials_no_direct_write ON public.google_credentials FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.get_google_connection_status()
RETURNS TABLE (connected boolean, email text, connected_at timestamptz, scopes text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT true, gc.email, gc.connected_at, gc.scopes
  FROM public.google_credentials gc
  WHERE gc.teacher_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_google_connection_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_google_connection_status() TO authenticated;

-- Where each resource lives on external platforms
CREATE TABLE public.resource_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  library_item_id uuid REFERENCES public.library_items(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE,
  question_set_key text,
  platform text NOT NULL CHECK (platform IN ('canvas','google_classroom','google_drive')),
  external_course_id text,
  external_course_name text,
  external_item_id text NOT NULL,
  external_type text NOT NULL,
  url text,
  direction text NOT NULL CHECK (direction IN ('imported','exported')),
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_links TO authenticated;
GRANT ALL ON public.resource_links TO service_role;
ALTER TABLE public.resource_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY resource_links_own ON public.resource_links FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE UNIQUE INDEX resource_links_ext_uniq ON public.resource_links (teacher_id, platform, external_type, external_item_id);
CREATE INDEX resource_links_item_idx ON public.resource_links (library_item_id);
CREATE INDEX resource_links_assignment_idx ON public.resource_links (assignment_id);

INSERT INTO public.resource_links (teacher_id, library_item_id, platform, external_course_id, external_item_id, external_type, direction, synced_at)
SELECT teacher_id, id, 'canvas', canvas_course_id::text, canvas_item_id::text, canvas_item_type, 'imported', updated_at
FROM public.library_items
WHERE canvas_item_id IS NOT NULL AND canvas_item_type IS NOT NULL
ON CONFLICT DO NOTHING;

-- Library source may be google
ALTER TABLE public.library_items DROP CONSTRAINT IF EXISTS library_items_source_check;
ALTER TABLE public.library_items ADD CONSTRAINT library_items_source_check CHECK (source IN ('upload','created','ai','canvas','google'));

-- Platform-aware classes / assignments / questions
ALTER TABLE public.courses
  ALTER COLUMN canvas_course_id DROP NOT NULL,
  ADD COLUMN platform text NOT NULL DEFAULT 'canvas' CHECK (platform IN ('canvas','google_classroom')),
  ADD COLUMN google_course_id text;
CREATE UNIQUE INDEX courses_google_uniq ON public.courses (teacher_id, google_course_id) WHERE google_course_id IS NOT NULL;

ALTER TABLE public.assignments
  ALTER COLUMN canvas_assignment_id DROP NOT NULL,
  ADD COLUMN google_coursework_id text,
  ADD COLUMN google_form_id text;
CREATE UNIQUE INDEX assignments_google_uniq ON public.assignments (teacher_id, google_coursework_id) WHERE google_coursework_id IS NOT NULL;

ALTER TABLE public.quiz_questions
  ALTER COLUMN canvas_question_id DROP NOT NULL,
  ADD COLUMN google_item_id text;
CREATE UNIQUE INDEX quiz_questions_google_uniq ON public.quiz_questions (assignment_id, google_item_id) WHERE google_item_id IS NOT NULL;

ALTER TABLE public.teacher_settings
  ADD COLUMN google_quiz_target text NOT NULL DEFAULT 'form' CHECK (google_quiz_target IN ('form','doc'));