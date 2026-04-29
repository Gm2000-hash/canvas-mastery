
-- mc_settings
CREATE TABLE public.mc_settings (
  teacher_id uuid PRIMARY KEY,
  default_mc_org_id text,
  last_export_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mc_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own mc_settings" ON public.mc_settings
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE TRIGGER mc_settings_updated_at BEFORE UPDATE ON public.mc_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- mc_standard_mappings
CREATE TABLE public.mc_standard_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  standard_id uuid NOT NULL,
  mc_code text NOT NULL,
  mc_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, standard_id)
);
ALTER TABLE public.mc_standard_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own mc_standard_mappings" ON public.mc_standard_mappings
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE INDEX mc_standard_mappings_teacher_idx ON public.mc_standard_mappings(teacher_id);
CREATE TRIGGER mc_standard_mappings_updated_at BEFORE UPDATE ON public.mc_standard_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- mc_assessment_mappings (assignment OR assignment_group, not both)
CREATE TABLE public.mc_assessment_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  assignment_id uuid,
  assignment_group_id uuid,
  mc_assessment_id text NOT NULL,
  mc_assessment_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mc_assessment_one_target CHECK (
    (assignment_id IS NOT NULL)::int + (assignment_group_id IS NOT NULL)::int = 1
  )
);
CREATE UNIQUE INDEX mc_assessment_mappings_assignment_uq
  ON public.mc_assessment_mappings(teacher_id, assignment_id) WHERE assignment_id IS NOT NULL;
CREATE UNIQUE INDEX mc_assessment_mappings_group_uq
  ON public.mc_assessment_mappings(teacher_id, assignment_group_id) WHERE assignment_group_id IS NOT NULL;
ALTER TABLE public.mc_assessment_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own mc_assessment_mappings" ON public.mc_assessment_mappings
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE TRIGGER mc_assessment_mappings_updated_at BEFORE UPDATE ON public.mc_assessment_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- mc_student_mappings
CREATE TABLE public.mc_student_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  mc_student_id text,
  mc_sis_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id)
);
ALTER TABLE public.mc_student_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own mc_student_mappings" ON public.mc_student_mappings
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE INDEX mc_student_mappings_teacher_idx ON public.mc_student_mappings(teacher_id);
CREATE TRIGGER mc_student_mappings_updated_at BEFORE UPDATE ON public.mc_student_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- mc_course_mappings
CREATE TABLE public.mc_course_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  course_id uuid NOT NULL,
  mc_tracker_id text NOT NULL,
  mc_tracker_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, course_id)
);
ALTER TABLE public.mc_course_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own mc_course_mappings" ON public.mc_course_mappings
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE TRIGGER mc_course_mappings_updated_at BEFORE UPDATE ON public.mc_course_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- mc_export_log
CREATE TABLE public.mc_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  export_type text NOT NULL,
  course_id uuid,
  row_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mc_export_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert own mc_export_log" ON public.mc_export_log
  FOR INSERT WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "View own mc_export_log" ON public.mc_export_log
  FOR SELECT USING (teacher_id = auth.uid());
