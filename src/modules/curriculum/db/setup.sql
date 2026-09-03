-- =====================================================================
-- Curriculum Creative Suite — complete database setup
-- =====================================================================
-- Idempotent-ish, single-shot schema for a fresh project. Run this as ONE
-- migration in a new Lovable project instead of replaying migration history.
--
-- Contains: units, curriculum lessons, lesson plans + assignments,
-- standards join tables, question bank, quizzes, activities (H5P),
-- reading library, notes, ISAT exams + review materials, profiles.
-- Row Level Security is user-scoped via auth.uid(); public share paths are
-- exposed only through SECURITY DEFINER functions at the bottom.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9




--
-- Name: curriculum_lesson_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.curriculum_lesson_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_id uuid NOT NULL,
    ngss_code text NOT NULL,
    ngss_description text NOT NULL,
    matched_terms text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: curriculum_lessons; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: custom_quizzes; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: exam_review_materials; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: h5p_activities; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: h5p_activity_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.h5p_activity_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_id uuid NOT NULL,
    ngss_code text NOT NULL,
    ngss_description text NOT NULL,
    matched_terms text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: isat_exams; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: lesson_assignments; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: lesson_plan_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_plan_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_plan_id uuid NOT NULL,
    ngss_code text NOT NULL,
    ngss_description text NOT NULL
);


--
-- Name: lesson_plans; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: library_books; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: note_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_note_id uuid NOT NULL,
    target_note_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    subjects text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text DEFAULT ''::text,
    bio text DEFAULT ''::text,
    phone text DEFAULT ''::text,
    website text DEFAULT ''::text,
    grade_levels text[] DEFAULT '{}'::text[] NOT NULL,
    ai_preferences jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: question_bank; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: question_bank_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_bank_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_bank_id uuid NOT NULL,
    ngss_code text NOT NULL,
    ngss_description text NOT NULL
);


--
-- Name: standard_key_terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standard_key_terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    standard_code text NOT NULL,
    key_terms text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: curriculum_lesson_standards curriculum_lesson_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_lesson_standards
    ADD CONSTRAINT curriculum_lesson_standards_pkey PRIMARY KEY (id);


--
-- Name: curriculum_lessons curriculum_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_lessons
    ADD CONSTRAINT curriculum_lessons_pkey PRIMARY KEY (id);


--
-- Name: custom_quizzes custom_quizzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_quizzes
    ADD CONSTRAINT custom_quizzes_pkey PRIMARY KEY (id);


--
-- Name: exam_review_materials exam_review_materials_exam_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_review_materials
    ADD CONSTRAINT exam_review_materials_exam_id_key UNIQUE (exam_id);


--
-- Name: exam_review_materials exam_review_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_review_materials
    ADD CONSTRAINT exam_review_materials_pkey PRIMARY KEY (id);


--
-- Name: h5p_activities h5p_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.h5p_activities
    ADD CONSTRAINT h5p_activities_pkey PRIMARY KEY (id);


--
-- Name: h5p_activity_standards h5p_activity_standards_activity_id_ngss_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.h5p_activity_standards
    ADD CONSTRAINT h5p_activity_standards_activity_id_ngss_code_key UNIQUE (activity_id, ngss_code);


--
-- Name: h5p_activity_standards h5p_activity_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.h5p_activity_standards
    ADD CONSTRAINT h5p_activity_standards_pkey PRIMARY KEY (id);


--
-- Name: isat_exams isat_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.isat_exams
    ADD CONSTRAINT isat_exams_pkey PRIMARY KEY (id);


--
-- Name: lesson_assignments lesson_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_assignments
    ADD CONSTRAINT lesson_assignments_pkey PRIMARY KEY (id);


--
-- Name: lesson_plan_standards lesson_plan_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plan_standards
    ADD CONSTRAINT lesson_plan_standards_pkey PRIMARY KEY (id);


--
-- Name: lesson_plans lesson_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plans
    ADD CONSTRAINT lesson_plans_pkey PRIMARY KEY (id);


--
-- Name: library_books library_books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_books
    ADD CONSTRAINT library_books_pkey PRIMARY KEY (id);


--
-- Name: library_books library_books_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_books
    ADD CONSTRAINT library_books_share_token_key UNIQUE (share_token);


--
-- Name: note_links note_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_links
    ADD CONSTRAINT note_links_pkey PRIMARY KEY (id);


--
-- Name: note_links note_links_source_note_id_target_note_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_links
    ADD CONSTRAINT note_links_source_note_id_target_note_id_key UNIQUE (source_note_id, target_note_id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: notes notes_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_share_token_key UNIQUE (share_token);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: question_bank question_bank_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank
    ADD CONSTRAINT question_bank_pkey PRIMARY KEY (id);


--
-- Name: question_bank_standards question_bank_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank_standards
    ADD CONSTRAINT question_bank_standards_pkey PRIMARY KEY (id);


--
-- Name: standard_key_terms standard_key_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_key_terms
    ADD CONSTRAINT standard_key_terms_pkey PRIMARY KEY (id);


--
-- Name: standard_key_terms standard_key_terms_user_id_standard_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_key_terms
    ADD CONSTRAINT standard_key_terms_user_id_standard_code_key UNIQUE (user_id, standard_code);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: idx_lesson_assignments_lesson_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lesson_assignments_lesson_plan ON public.lesson_assignments USING btree (lesson_plan_id);


--
-- Name: idx_lesson_assignments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lesson_assignments_user ON public.lesson_assignments USING btree (user_id);


--
-- Name: idx_note_links_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_links_source ON public.note_links USING btree (source_note_id);


--
-- Name: idx_note_links_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_links_target ON public.note_links USING btree (target_note_id);


--
-- Name: idx_notes_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_parent_id ON public.notes USING btree (parent_id);


--
-- Name: idx_notes_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_search ON public.notes USING gin (search_vector);


--
-- Name: idx_notes_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_tags ON public.notes USING gin (tags);


--
-- Name: idx_notes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_user_id ON public.notes USING btree (user_id);


--
-- Name: idx_question_bank_standards_qid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_bank_standards_qid ON public.question_bank_standards USING btree (question_bank_id);


--
-- Name: idx_question_bank_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_bank_user ON public.question_bank USING btree (user_id);


--
-- Name: notes notes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notes_set_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lesson_assignments update_lesson_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lesson_assignments_updated_at BEFORE UPDATE ON public.lesson_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: curriculum_lesson_standards curriculum_lesson_standards_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_lesson_standards
    ADD CONSTRAINT curriculum_lesson_standards_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.curriculum_lessons(id) ON DELETE CASCADE;


--
-- Name: curriculum_lessons curriculum_lessons_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curriculum_lessons
    ADD CONSTRAINT curriculum_lessons_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;


--
-- Name: exam_review_materials exam_review_materials_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_review_materials
    ADD CONSTRAINT exam_review_materials_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.isat_exams(id) ON DELETE CASCADE;


--
-- Name: h5p_activities h5p_activities_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.h5p_activities
    ADD CONSTRAINT h5p_activities_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;


--
-- Name: h5p_activity_standards h5p_activity_standards_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.h5p_activity_standards
    ADD CONSTRAINT h5p_activity_standards_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.h5p_activities(id) ON DELETE CASCADE;


--
-- Name: lesson_assignments lesson_assignments_lesson_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_assignments
    ADD CONSTRAINT lesson_assignments_lesson_plan_id_fkey FOREIGN KEY (lesson_plan_id) REFERENCES public.lesson_plans(id) ON DELETE CASCADE;


--
-- Name: lesson_plan_standards lesson_plan_standards_lesson_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plan_standards
    ADD CONSTRAINT lesson_plan_standards_lesson_plan_id_fkey FOREIGN KEY (lesson_plan_id) REFERENCES public.lesson_plans(id) ON DELETE CASCADE;


--
-- Name: lesson_plans lesson_plans_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plans
    ADD CONSTRAINT lesson_plans_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;


--
-- Name: library_books library_books_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.library_books
    ADD CONSTRAINT library_books_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: note_links note_links_source_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_links
    ADD CONSTRAINT note_links_source_note_id_fkey FOREIGN KEY (source_note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: note_links note_links_target_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_links
    ADD CONSTRAINT note_links_target_note_id_fkey FOREIGN KEY (target_note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: notes notes_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: question_bank_standards question_bank_standards_question_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank_standards
    ADD CONSTRAINT question_bank_standards_question_bank_id_fkey FOREIGN KEY (question_bank_id) REFERENCES public.question_bank(id) ON DELETE CASCADE;


--
-- Name: question_bank question_bank_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank
    ADD CONSTRAINT question_bank_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: library_books Admins can delete books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete books" ON public.library_books FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: library_books Admins can insert books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert books" ON public.library_books FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: library_books Admins can update books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update books" ON public.library_books FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: library_books Admins can view all books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all books" ON public.library_books FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: h5p_activities Users can delete own activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own activities" ON public.h5p_activities FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: h5p_activity_standards Users can delete own activity standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own activity standards" ON public.h5p_activity_standards FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.h5p_activities
  WHERE ((h5p_activities.id = h5p_activity_standards.activity_id) AND (h5p_activities.user_id = auth.uid())))));


--
-- Name: curriculum_lesson_standards Users can delete own curriculum lesson standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own curriculum lesson standards" ON public.curriculum_lesson_standards FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.curriculum_lessons
  WHERE ((curriculum_lessons.id = curriculum_lesson_standards.lesson_id) AND (curriculum_lessons.user_id = auth.uid())))));


--
-- Name: curriculum_lessons Users can delete own curriculum lessons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own curriculum lessons" ON public.curriculum_lessons FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: isat_exams Users can delete own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own exams" ON public.isat_exams FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: standard_key_terms Users can delete own key terms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own key terms" ON public.standard_key_terms FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: lesson_plans Users can delete own lesson plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own lesson plans" ON public.lesson_plans FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: lesson_plan_standards Users can delete own lesson standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own lesson standards" ON public.lesson_plan_standards FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lesson_plans
  WHERE ((lesson_plans.id = lesson_plan_standards.lesson_plan_id) AND (lesson_plans.user_id = auth.uid())))));


--
-- Name: note_links Users can delete own note links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own note links" ON public.note_links FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.notes
  WHERE ((notes.id = note_links.source_note_id) AND (notes.user_id = auth.uid())))));


--
-- Name: notes Users can delete own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own notes" ON public.notes FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: question_bank Users can delete own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own questions" ON public.question_bank FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: custom_quizzes Users can delete own quizzes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own quizzes" ON public.custom_quizzes FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: exam_review_materials Users can delete own review materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own review materials" ON public.exam_review_materials FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: question_bank_standards Users can delete own standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own standards" ON public.question_bank_standards FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.question_bank
  WHERE ((question_bank.id = question_bank_standards.question_bank_id) AND (question_bank.user_id = auth.uid())))));


--
-- Name: units Users can delete own units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own units" ON public.units FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: h5p_activities Users can insert own activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own activities" ON public.h5p_activities FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: h5p_activity_standards Users can insert own activity standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own activity standards" ON public.h5p_activity_standards FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.h5p_activities
  WHERE ((h5p_activities.id = h5p_activity_standards.activity_id) AND (h5p_activities.user_id = auth.uid())))));


--
-- Name: curriculum_lesson_standards Users can insert own curriculum lesson standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own curriculum lesson standards" ON public.curriculum_lesson_standards FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.curriculum_lessons
  WHERE ((curriculum_lessons.id = curriculum_lesson_standards.lesson_id) AND (curriculum_lessons.user_id = auth.uid())))));


--
-- Name: curriculum_lessons Users can insert own curriculum lessons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own curriculum lessons" ON public.curriculum_lessons FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: isat_exams Users can insert own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own exams" ON public.isat_exams FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: standard_key_terms Users can insert own key terms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own key terms" ON public.standard_key_terms FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: lesson_plans Users can insert own lesson plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own lesson plans" ON public.lesson_plans FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: lesson_plan_standards Users can insert own lesson standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own lesson standards" ON public.lesson_plan_standards FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lesson_plans
  WHERE ((lesson_plans.id = lesson_plan_standards.lesson_plan_id) AND (lesson_plans.user_id = auth.uid())))));


--
-- Name: note_links Users can insert own note links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own note links" ON public.note_links FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.notes
  WHERE ((notes.id = note_links.source_note_id) AND (notes.user_id = auth.uid())))));


--
-- Name: notes Users can insert own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own notes" ON public.notes FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: question_bank Users can insert own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own questions" ON public.question_bank FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: custom_quizzes Users can insert own quizzes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own quizzes" ON public.custom_quizzes FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: exam_review_materials Users can insert own review materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own review materials" ON public.exam_review_materials FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: question_bank_standards Users can insert own standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own standards" ON public.question_bank_standards FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.question_bank
  WHERE ((question_bank.id = question_bank_standards.question_bank_id) AND (question_bank.user_id = auth.uid())))));


--
-- Name: units Users can insert own units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own units" ON public.units FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: h5p_activities Users can update own activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own activities" ON public.h5p_activities FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: h5p_activity_standards Users can update own activity standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own activity standards" ON public.h5p_activity_standards FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.h5p_activities
  WHERE ((h5p_activities.id = h5p_activity_standards.activity_id) AND (h5p_activities.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.h5p_activities
  WHERE ((h5p_activities.id = h5p_activity_standards.activity_id) AND (h5p_activities.user_id = auth.uid())))));


--
-- Name: curriculum_lesson_standards Users can update own curriculum lesson standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own curriculum lesson standards" ON public.curriculum_lesson_standards FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.curriculum_lessons
  WHERE ((curriculum_lessons.id = curriculum_lesson_standards.lesson_id) AND (curriculum_lessons.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.curriculum_lessons
  WHERE ((curriculum_lessons.id = curriculum_lesson_standards.lesson_id) AND (curriculum_lessons.user_id = auth.uid())))));


--
-- Name: curriculum_lessons Users can update own curriculum lessons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own curriculum lessons" ON public.curriculum_lessons FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: isat_exams Users can update own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own exams" ON public.isat_exams FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: standard_key_terms Users can update own key terms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own key terms" ON public.standard_key_terms FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: lesson_plans Users can update own lesson plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own lesson plans" ON public.lesson_plans FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: lesson_plan_standards Users can update own lesson standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own lesson standards" ON public.lesson_plan_standards FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lesson_plans
  WHERE ((lesson_plans.id = lesson_plan_standards.lesson_plan_id) AND (lesson_plans.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lesson_plans
  WHERE ((lesson_plans.id = lesson_plan_standards.lesson_plan_id) AND (lesson_plans.user_id = auth.uid())))));


--
-- Name: notes Users can update own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notes" ON public.notes FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: question_bank Users can update own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own questions" ON public.question_bank FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: custom_quizzes Users can update own quizzes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own quizzes" ON public.custom_quizzes FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: exam_review_materials Users can update own review materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own review materials" ON public.exam_review_materials FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: question_bank_standards Users can update own standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own standards" ON public.question_bank_standards FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.question_bank
  WHERE ((question_bank.id = question_bank_standards.question_bank_id) AND (question_bank.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.question_bank
  WHERE ((question_bank.id = question_bank_standards.question_bank_id) AND (question_bank.user_id = auth.uid())))));


--
-- Name: units Users can update own units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own units" ON public.units FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: h5p_activities Users can view own activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own activities" ON public.h5p_activities FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: h5p_activity_standards Users can view own activity standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own activity standards" ON public.h5p_activity_standards FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.h5p_activities
  WHERE ((h5p_activities.id = h5p_activity_standards.activity_id) AND (h5p_activities.user_id = auth.uid())))));


--
-- Name: library_books Users can view own books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own books" ON public.library_books FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: curriculum_lesson_standards Users can view own curriculum lesson standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own curriculum lesson standards" ON public.curriculum_lesson_standards FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.curriculum_lessons
  WHERE ((curriculum_lessons.id = curriculum_lesson_standards.lesson_id) AND (curriculum_lessons.user_id = auth.uid())))));


--
-- Name: curriculum_lessons Users can view own curriculum lessons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own curriculum lessons" ON public.curriculum_lessons FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: isat_exams Users can view own exams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own exams" ON public.isat_exams FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: standard_key_terms Users can view own key terms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own key terms" ON public.standard_key_terms FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: lesson_plans Users can view own lesson plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own lesson plans" ON public.lesson_plans FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: lesson_plan_standards Users can view own lesson standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own lesson standards" ON public.lesson_plan_standards FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.lesson_plans
  WHERE ((lesson_plans.id = lesson_plan_standards.lesson_plan_id) AND (lesson_plans.user_id = auth.uid())))));


--
-- Name: note_links Users can view own note links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own note links" ON public.note_links FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.notes
  WHERE ((notes.id = note_links.source_note_id) AND (notes.user_id = auth.uid())))));


--
-- Name: notes Users can view own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notes" ON public.notes FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: question_bank Users can view own questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own questions" ON public.question_bank FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: custom_quizzes Users can view own quizzes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own quizzes" ON public.custom_quizzes FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: exam_review_materials Users can view own review materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own review materials" ON public.exam_review_materials FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: question_bank_standards Users can view own standards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own standards" ON public.question_bank_standards FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.question_bank
  WHERE ((question_bank.id = question_bank_standards.question_bank_id) AND (question_bank.user_id = auth.uid())))));


--
-- Name: units Users can view own units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own units" ON public.units FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: library_books Users can view published books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view published books" ON public.library_books FOR SELECT TO authenticated USING ((is_published = true));


--
-- Name: lesson_assignments Users delete own lesson assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own lesson assignments" ON public.lesson_assignments FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: lesson_assignments Users insert own lesson assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own lesson assignments" ON public.lesson_assignments FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: lesson_assignments Users update own lesson assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own lesson assignments" ON public.lesson_assignments FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: lesson_assignments Users view own lesson assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own lesson assignments" ON public.lesson_assignments FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: curriculum_lesson_standards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.curriculum_lesson_standards ENABLE ROW LEVEL SECURITY;

--
-- Name: curriculum_lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.curriculum_lessons ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_quizzes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_quizzes ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_review_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exam_review_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: h5p_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.h5p_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: h5p_activity_standards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.h5p_activity_standards ENABLE ROW LEVEL SECURITY;

--
-- Name: isat_exams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.isat_exams ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_plan_standards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_plan_standards ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: library_books; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

--
-- Name: note_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;

--
-- Name: notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: question_bank; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

--
-- Name: question_bank_standards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.question_bank_standards ENABLE ROW LEVEL SECURITY;

--
-- Name: standard_key_terms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.standard_key_terms ENABLE ROW LEVEL SECURITY;

--
-- Name: units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




-- =====================================================================
-- Supporting functions (updated_at, new-user profile, public share reads)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_public_exam(_exam_id uuid)
 RETURNS TABLE(id uuid, title text, grade_level text, question_count integer, questions jsonb, hints_enabled boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
$function$
;
CREATE OR REPLACE FUNCTION public.get_public_review(_exam_id uuid)
 RETURNS TABLE(id uuid, exam_id uuid, exam_title text, study_guide jsonb, flashcards jsonb, review_lesson jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT r.id, r.exam_id, e.title as exam_title, r.study_guide, r.flashcards, r.review_lesson
  FROM public.exam_review_materials r
  JOIN public.isat_exams e ON e.id = r.exam_id
  WHERE r.exam_id = _exam_id;
$function$
;
CREATE OR REPLACE FUNCTION public.get_published_books()
 RETURNS TABLE(id uuid, title text, file_path text, file_size bigint, source_discipline text, cover_url text, is_published boolean, page_count integer, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, title, file_path, file_size, source_discipline, cover_url, is_published, page_count, created_at, updated_at
  FROM library_books WHERE is_published = true;
$function$
;
CREATE OR REPLACE FUNCTION public.get_shared_book(_share_token text)
 RETURNS TABLE(id uuid, title text, file_path text, source_discipline text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT lb.id, lb.title, lb.file_path, lb.source_discipline
  FROM public.library_books lb
  WHERE lb.share_token = _share_token AND lb.is_published = true
  LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.get_shared_note(_token text)
 RETURNS TABLE(id uuid, title text, icon text, content jsonb, tags text[], updated_at timestamp with time zone, author_display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT n.id, n.title, n.icon, n.content, n.tags, n.updated_at, coalesce(p.display_name, '')
  FROM public.notes n
  LEFT JOIN public.profiles p ON p.user_id = n.user_id
  WHERE n.share_token = _token AND n.is_public = true
  LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.email, ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;


-- New user -> profile row
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- Data API grants (required — RLS alone is not enough)
-- =====================================================================

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.isat_exams TO authenticated;
GRANT ALL ON public.isat_exams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_review_materials TO authenticated;
GRANT ALL ON public.exam_review_materials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standard_key_terms TO authenticated;
GRANT ALL ON public.standard_key_terms TO service_role;

-- Public share reads go through SECURITY DEFINER functions only.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shared_note(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_book(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_published_books() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_exam(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_review(uuid) TO anon, authenticated;
