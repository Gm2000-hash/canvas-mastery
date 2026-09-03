CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE public.curriculum_lesson_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_id uuid NOT NULL,
    ngss_code text NOT NULL,
    ngss_description text NOT NULL,
    matched_terms text[] DEFAULT '{}'::text[] NOT NULL
);
CREATE TABLE public.curriculum_lessons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unit_id uuid NOT NULL,
    user_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    title text NOT NULL,
    objectives jsonb DEFAULT '[]'::jsonb NOT NULL,
    intro jsonb DEFAULT '[]'::jsonb NOT NULL,
    explanation jsonb DEFAULT '[]'::jsonb NOT NULL,
    key_terms jsonb DEFAULT '[]'::jsonb NOT NULL,
    reading_title text,
    reading_paragraphs jsonb DEFAULT '[]'::jsonb,
    interactive_activities jsonb DEFAULT '[]'::jsonb,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.custom_quizzes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text,
    question_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.exam_review_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    user_id uuid NOT NULL,
    study_guide jsonb DEFAULT '[]'::jsonb NOT NULL,
    flashcards jsonb DEFAULT '[]'::jsonb NOT NULL,
    review_lesson jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.h5p_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    unit_id uuid,
    title text NOT NULL,
    activity_type text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.h5p_activity_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_id uuid NOT NULL,
    ngss_code text NOT NULL,
    ngss_description text NOT NULL,
    matched_terms text[] DEFAULT '{}'::text[] NOT NULL
);
CREATE TABLE public.isat_exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    grade_level text DEFAULT '6th'::text NOT NULL,
    question_count integer DEFAULT 30 NOT NULL,
    questions jsonb DEFAULT '[]'::jsonb NOT NULL,
    answers jsonb,
    score numeric,
    total_points numeric,
    hints_used integer DEFAULT 0 NOT NULL,
    hints_enabled boolean DEFAULT true NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.lesson_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    lesson_plan_id uuid NOT NULL,
    title text DEFAULT 'Untitled assignment'::text NOT NULL,
    assignment_type text DEFAULT 'worksheet'::text NOT NULL,
    instructions text DEFAULT ''::text NOT NULL,
    points_possible numeric DEFAULT 100 NOT NULL,
    due_in_days integer,
    materials jsonb DEFAULT '[]'::jsonb NOT NULL,
    rubric jsonb DEFAULT '[]'::jsonb NOT NULL,
    ai_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    canvas_assignment_id bigint,
    canvas_course_id bigint,
    google_doc_url text,
    google_sheet_url text,
    google_slides_url text,
    quiz_questions jsonb DEFAULT '[]'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.lesson_plan_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_plan_id uuid NOT NULL,
    ngss_code text NOT NULL,
    ngss_description text NOT NULL
);
CREATE TABLE public.lesson_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    unit_id uuid,
    title text NOT NULL,
    lesson_date date,
    duration_minutes integer DEFAULT 50,
    objectives text DEFAULT ''::text,
    activities jsonb DEFAULT '[]'::jsonb,
    materials text DEFAULT ''::text,
    assessment text DEFAULT ''::text,
    differentiation text DEFAULT ''::text,
    notes text DEFAULT ''::text,
    vocabulary jsonb DEFAULT '[]'::jsonb,
    resources jsonb DEFAULT '[]'::jsonb,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    embedded_activities jsonb DEFAULT '[]'::jsonb,
    udl_supports jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE TABLE public.library_books (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    file_path text NOT NULL,
    file_size bigint DEFAULT 0 NOT NULL,
    page_count integer DEFAULT 0,
    cover_url text,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_discipline text,
    share_token text
);
CREATE TABLE public.note_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_note_id uuid NOT NULL,
    target_note_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    title text DEFAULT 'Untitled'::text NOT NULL,
    icon text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    content_text text DEFAULT ''::text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    share_token text,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS ((setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(content_text, ''::text)), 'B'::"char"))) STORED
);
CREATE TABLE public.question_bank (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    canvas_question_id integer,
    question_text text NOT NULL,
    question_type text NOT NULL,
    points_possible numeric DEFAULT 0,
    answers jsonb DEFAULT '[]'::jsonb,
    source_course text,
    source_quiz text,
    dok_level smallint,
    blooms_level text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.question_bank_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_bank_id uuid NOT NULL,
    ngss_code text NOT NULL,
    ngss_description text NOT NULL
);
CREATE TABLE public.standard_key_terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    standard_code text NOT NULL,
    key_terms text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text,
    grade_level text DEFAULT ''::text,
    discipline text DEFAULT ''::text,
    date_start date,
    date_end date,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.curriculum_lesson_standards ADD CONSTRAINT curriculum_lesson_standards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.curriculum_lessons ADD CONSTRAINT curriculum_lessons_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.custom_quizzes ADD CONSTRAINT custom_quizzes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exam_review_materials ADD CONSTRAINT exam_review_materials_exam_id_key UNIQUE (exam_id);
ALTER TABLE ONLY public.exam_review_materials ADD CONSTRAINT exam_review_materials_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.h5p_activities ADD CONSTRAINT h5p_activities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.h5p_activity_standards ADD CONSTRAINT h5p_activity_standards_activity_id_ngss_code_key UNIQUE (activity_id, ngss_code);
ALTER TABLE ONLY public.h5p_activity_standards ADD CONSTRAINT h5p_activity_standards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.isat_exams ADD CONSTRAINT isat_exams_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.lesson_assignments ADD CONSTRAINT lesson_assignments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.lesson_plan_standards ADD CONSTRAINT lesson_plan_standards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.lesson_plans ADD CONSTRAINT lesson_plans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.library_books ADD CONSTRAINT library_books_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.library_books ADD CONSTRAINT library_books_share_token_key UNIQUE (share_token);
ALTER TABLE ONLY public.note_links ADD CONSTRAINT note_links_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.note_links ADD CONSTRAINT note_links_source_note_id_target_note_id_key UNIQUE (source_note_id, target_note_id);
ALTER TABLE ONLY public.notes ADD CONSTRAINT notes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notes ADD CONSTRAINT notes_share_token_key UNIQUE (share_token);
ALTER TABLE ONLY public.question_bank ADD CONSTRAINT question_bank_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.question_bank_standards ADD CONSTRAINT question_bank_standards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.standard_key_terms ADD CONSTRAINT standard_key_terms_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.standard_key_terms ADD CONSTRAINT standard_key_terms_user_id_standard_code_key UNIQUE (user_id, standard_code);
ALTER TABLE ONLY public.units ADD CONSTRAINT units_pkey PRIMARY KEY (id);
CREATE INDEX idx_lesson_assignments_lesson_plan ON public.lesson_assignments USING btree (lesson_plan_id);
CREATE INDEX idx_lesson_assignments_user ON public.lesson_assignments USING btree (user_id);
CREATE INDEX idx_note_links_source ON public.note_links USING btree (source_note_id);
CREATE INDEX idx_note_links_target ON public.note_links USING btree (target_note_id);
CREATE INDEX idx_notes_parent_id ON public.notes USING btree (parent_id);
CREATE INDEX idx_notes_search ON public.notes USING gin (search_vector);
CREATE INDEX idx_notes_tags ON public.notes USING gin (tags);
CREATE INDEX idx_notes_user_id ON public.notes USING btree (user_id);
CREATE INDEX idx_question_bank_standards_qid ON public.question_bank_standards USING btree (question_bank_id);
CREATE INDEX idx_question_bank_user ON public.question_bank USING btree (user_id);
CREATE TRIGGER notes_set_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_lesson_assignments_updated_at BEFORE UPDATE ON public.lesson_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE ONLY public.curriculum_lesson_standards ADD CONSTRAINT curriculum_lesson_standards_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.curriculum_lessons(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.curriculum_lessons ADD CONSTRAINT curriculum_lessons_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_review_materials ADD CONSTRAINT exam_review_materials_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.isat_exams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.h5p_activities ADD CONSTRAINT h5p_activities_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.h5p_activity_standards ADD CONSTRAINT h5p_activity_standards_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.h5p_activities(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lesson_assignments ADD CONSTRAINT lesson_assignments_lesson_plan_id_fkey FOREIGN KEY (lesson_plan_id) REFERENCES public.lesson_plans(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lesson_plan_standards ADD CONSTRAINT lesson_plan_standards_lesson_plan_id_fkey FOREIGN KEY (lesson_plan_id) REFERENCES public.lesson_plans(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lesson_plans ADD CONSTRAINT lesson_plans_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.note_links ADD CONSTRAINT note_links_source_note_id_fkey FOREIGN KEY (source_note_id) REFERENCES public.notes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.note_links ADD CONSTRAINT note_links_target_note_id_fkey FOREIGN KEY (target_note_id) REFERENCES public.notes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notes ADD CONSTRAINT notes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.notes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.question_bank_standards ADD CONSTRAINT question_bank_standards_question_bank_id_fkey FOREIGN KEY (question_bank_id) REFERENCES public.question_bank(id) ON DELETE CASCADE;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_lessons TO authenticated;
GRANT ALL ON public.curriculum_lessons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_lesson_standards TO authenticated;
GRANT ALL ON public.curriculum_lesson_standards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plans TO authenticated;
GRANT ALL ON public.lesson_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plan_standards TO authenticated;
GRANT ALL ON public.lesson_plan_standards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_assignments TO authenticated;
GRANT ALL ON public.lesson_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank TO authenticated;
GRANT ALL ON public.question_bank TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank_standards TO authenticated;
GRANT ALL ON public.question_bank_standards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_quizzes TO authenticated;
GRANT ALL ON public.custom_quizzes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.h5p_activities TO authenticated;
GRANT ALL ON public.h5p_activities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.h5p_activity_standards TO authenticated;
GRANT ALL ON public.h5p_activity_standards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_links TO authenticated;
GRANT ALL ON public.note_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.isat_exams TO authenticated;
GRANT ALL ON public.isat_exams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_review_materials TO authenticated;
GRANT ALL ON public.exam_review_materials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standard_key_terms TO authenticated;
GRANT ALL ON public.standard_key_terms TO service_role;
ALTER TABLE public.curriculum_lesson_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_review_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.h5p_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.h5p_activity_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.isat_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plan_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_key_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can delete books" ON public.library_books FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert books" ON public.library_books FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update books" ON public.library_books FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can view all books" ON public.library_books FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users can insert own books" ON public.library_books FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own books" ON public.library_books FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can delete own books" ON public.library_books FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can view own books" ON public.library_books FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can view published books" ON public.library_books FOR SELECT TO authenticated USING ((is_published = true));
CREATE POLICY "Users can delete own activities" ON public.h5p_activities FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert own activities" ON public.h5p_activities FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own activities" ON public.h5p_activities FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view own activities" ON public.h5p_activities FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can delete own activity standards" ON public.h5p_activity_standards FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.h5p_activities WHERE ((h5p_activities.id = h5p_activity_standards.activity_id) AND (h5p_activities.user_id = auth.uid())))));
CREATE POLICY "Users can insert own activity standards" ON public.h5p_activity_standards FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM public.h5p_activities WHERE ((h5p_activities.id = h5p_activity_standards.activity_id) AND (h5p_activities.user_id = auth.uid())))));
CREATE POLICY "Users can update own activity standards" ON public.h5p_activity_standards FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.h5p_activities WHERE ((h5p_activities.id = h5p_activity_standards.activity_id) AND (h5p_activities.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM public.h5p_activities WHERE ((h5p_activities.id = h5p_activity_standards.activity_id) AND (h5p_activities.user_id = auth.uid())))));
CREATE POLICY "Users can view own activity standards" ON public.h5p_activity_standards FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.h5p_activities WHERE ((h5p_activities.id = h5p_activity_standards.activity_id) AND (h5p_activities.user_id = auth.uid())))));
CREATE POLICY "Users can delete own curriculum lesson standards" ON public.curriculum_lesson_standards FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.curriculum_lessons WHERE ((curriculum_lessons.id = curriculum_lesson_standards.lesson_id) AND (curriculum_lessons.user_id = auth.uid())))));
CREATE POLICY "Users can insert own curriculum lesson standards" ON public.curriculum_lesson_standards FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM public.curriculum_lessons WHERE ((curriculum_lessons.id = curriculum_lesson_standards.lesson_id) AND (curriculum_lessons.user_id = auth.uid())))));
CREATE POLICY "Users can update own curriculum lesson standards" ON public.curriculum_lesson_standards FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.curriculum_lessons WHERE ((curriculum_lessons.id = curriculum_lesson_standards.lesson_id) AND (curriculum_lessons.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM public.curriculum_lessons WHERE ((curriculum_lessons.id = curriculum_lesson_standards.lesson_id) AND (curriculum_lessons.user_id = auth.uid())))));
CREATE POLICY "Users can view own curriculum lesson standards" ON public.curriculum_lesson_standards FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.curriculum_lessons WHERE ((curriculum_lessons.id = curriculum_lesson_standards.lesson_id) AND (curriculum_lessons.user_id = auth.uid())))));
CREATE POLICY "Users can delete own curriculum lessons" ON public.curriculum_lessons FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert own curriculum lessons" ON public.curriculum_lessons FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own curriculum lessons" ON public.curriculum_lessons FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view own curriculum lessons" ON public.curriculum_lessons FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can delete own exams" ON public.isat_exams FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert own exams" ON public.isat_exams FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own exams" ON public.isat_exams FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view own exams" ON public.isat_exams FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can delete own key terms" ON public.standard_key_terms FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert own key terms" ON public.standard_key_terms FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own key terms" ON public.standard_key_terms FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view own key terms" ON public.standard_key_terms FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can delete own lesson plans" ON public.lesson_plans FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own lesson plans" ON public.lesson_plans FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own lesson plans" ON public.lesson_plans FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own lesson plans" ON public.lesson_plans FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete own lesson standards" ON public.lesson_plan_standards FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.lesson_plans WHERE ((lesson_plans.id = lesson_plan_standards.lesson_plan_id) AND (lesson_plans.user_id = auth.uid())))));
CREATE POLICY "Users can insert own lesson standards" ON public.lesson_plan_standards FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM public.lesson_plans WHERE ((lesson_plans.id = lesson_plan_standards.lesson_plan_id) AND (lesson_plans.user_id = auth.uid())))));
CREATE POLICY "Users can update own lesson standards" ON public.lesson_plan_standards FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.lesson_plans WHERE ((lesson_plans.id = lesson_plan_standards.lesson_plan_id) AND (lesson_plans.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM public.lesson_plans WHERE ((lesson_plans.id = lesson_plan_standards.lesson_plan_id) AND (lesson_plans.user_id = auth.uid())))));
CREATE POLICY "Users can view own lesson standards" ON public.lesson_plan_standards FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.lesson_plans WHERE ((lesson_plans.id = lesson_plan_standards.lesson_plan_id) AND (lesson_plans.user_id = auth.uid())))));
CREATE POLICY "Users can delete own note links" ON public.note_links FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.notes WHERE ((notes.id = note_links.source_note_id) AND (notes.user_id = auth.uid())))));
CREATE POLICY "Users can insert own note links" ON public.note_links FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM public.notes WHERE ((notes.id = note_links.source_note_id) AND (notes.user_id = auth.uid())))));
CREATE POLICY "Users can view own note links" ON public.note_links FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.notes WHERE ((notes.id = note_links.source_note_id) AND (notes.user_id = auth.uid())))));
CREATE POLICY "Users can delete own notes" ON public.notes FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert own notes" ON public.notes FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own notes" ON public.notes FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view own notes" ON public.notes FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can delete own questions" ON public.question_bank FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own questions" ON public.question_bank FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own questions" ON public.question_bank FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own questions" ON public.question_bank FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete own quizzes" ON public.custom_quizzes FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert own quizzes" ON public.custom_quizzes FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own quizzes" ON public.custom_quizzes FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view own quizzes" ON public.custom_quizzes FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can delete own review materials" ON public.exam_review_materials FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert own review materials" ON public.exam_review_materials FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own review materials" ON public.exam_review_materials FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view own review materials" ON public.exam_review_materials FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can delete own standards" ON public.question_bank_standards FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.question_bank WHERE ((question_bank.id = question_bank_standards.question_bank_id) AND (question_bank.user_id = auth.uid())))));
CREATE POLICY "Users can insert own standards" ON public.question_bank_standards FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1 FROM public.question_bank WHERE ((question_bank.id = question_bank_standards.question_bank_id) AND (question_bank.user_id = auth.uid())))));
CREATE POLICY "Users can update own standards" ON public.question_bank_standards FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1 FROM public.question_bank WHERE ((question_bank.id = question_bank_standards.question_bank_id) AND (question_bank.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1 FROM public.question_bank WHERE ((question_bank.id = question_bank_standards.question_bank_id) AND (question_bank.user_id = auth.uid())))));
CREATE POLICY "Users can view own standards" ON public.question_bank_standards FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1 FROM public.question_bank WHERE ((question_bank.id = question_bank_standards.question_bank_id) AND (question_bank.user_id = auth.uid())))));
CREATE POLICY "Users can delete own units" ON public.units FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own units" ON public.units FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own units" ON public.units FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own units" ON public.units FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users delete own lesson assignments" ON public.lesson_assignments FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users insert own lesson assignments" ON public.lesson_assignments FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users update own lesson assignments" ON public.lesson_assignments FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users view own lesson assignments" ON public.lesson_assignments FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE OR REPLACE FUNCTION public.get_public_exam(_exam_id uuid)
 RETURNS TABLE(id uuid, title text, grade_level text, question_count integer, questions jsonb, hints_enabled boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT e.id, e.title, e.grade_level, e.question_count,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'question_number', q->>'question_number',
          'question_type', q->>'question_type',
          'question_text', q->>'question_text',
          'standard_code', q->>'standard_code',
          'standard_description', q->>'standard_description',
          'points_possible', CASE WHEN jsonb_typeof(q->'points_possible') IN ('number', 'string') THEN (q->>'points_possible')::numeric ELSE NULL END,
          'dok_level', CASE WHEN jsonb_typeof(q->'dok_level') IN ('number', 'string') THEN (q->>'dok_level')::integer ELSE NULL END,
          'blooms_level', q->>'blooms_level',
          'hint', q->>'hint',
          'image_url', q->>'image_url',
          'media', q->'media',
          'answers', CASE
            WHEN jsonb_typeof(q->'answers') = 'array' THEN (SELECT jsonb_agg(a - 'weight' - 'correct') FROM jsonb_array_elements(q->'answers') a)
            ELSE q->'answers'
          END
        )
      )
      FROM jsonb_array_elements(e.questions) q
    ),
    e.hints_enabled
  FROM public.isat_exams e
  WHERE e.id = _exam_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_public_review(_exam_id uuid)
 RETURNS TABLE(id uuid, exam_id uuid, exam_title text, study_guide jsonb, flashcards jsonb, review_lesson jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT r.id, r.exam_id, e.title as exam_title, r.study_guide, r.flashcards, r.review_lesson
  FROM public.exam_review_materials r
  JOIN public.isat_exams e ON e.id = r.exam_id
  WHERE r.exam_id = _exam_id;
$function$;
CREATE OR REPLACE FUNCTION public.get_published_books()
 RETURNS TABLE(id uuid, title text, file_path text, file_size bigint, source_discipline text, cover_url text, is_published boolean, page_count integer, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT id, title, file_path, file_size, source_discipline, cover_url, is_published, page_count, created_at, updated_at
  FROM library_books WHERE is_published = true;
$function$;
CREATE OR REPLACE FUNCTION public.get_shared_book(_share_token text)
 RETURNS TABLE(id uuid, title text, file_path text, source_discipline text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT lb.id, lb.title, lb.file_path, lb.source_discipline
  FROM public.library_books lb
  WHERE lb.share_token = _share_token AND lb.is_published = true
  LIMIT 1;
$function$;
CREATE OR REPLACE FUNCTION public.get_shared_note(_token text)
 RETURNS TABLE(id uuid, title text, icon text, content jsonb, tags text[], updated_at timestamp with time zone, author_display_name text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT n.id, n.title, n.icon, n.content, n.tags, n.updated_at, coalesce(p.display_name, '')
  FROM public.notes n
  LEFT JOIN public.profiles p ON p.id = n.user_id
  WHERE n.share_token = _token AND n.is_public = true
  LIMIT 1;
$function$;
GRANT EXECUTE ON FUNCTION public.get_shared_note(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_book(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_published_books() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_exam(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_review(uuid) TO anon, authenticated;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subjects text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS grade_levels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS ai_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['library-pdfs','book-covers','activity-media'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'curr_'||b||'_select');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L)', 'curr_'||b||'_select', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'curr_'||b||'_insert');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)', 'curr_'||b||'_insert', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'curr_'||b||'_update');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)', 'curr_'||b||'_update', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'curr_'||b||'_delete');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L AND (storage.foldername(name))[1] = auth.uid()::text)', 'curr_'||b||'_delete', b);
  END LOOP;
END $$;
DROP POLICY IF EXISTS curr_avatars_select ON storage.objects;
CREATE POLICY curr_avatars_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS curr_avatars_insert ON storage.objects;
CREATE POLICY curr_avatars_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
DROP POLICY IF EXISTS curr_avatars_update ON storage.objects;
CREATE POLICY curr_avatars_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Update own canvas credentials" ON public.canvas_credentials;
CREATE POLICY "Update own canvas credentials" ON public.canvas_credentials FOR UPDATE TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());