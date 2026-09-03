-- ============ Admin guard ============
CREATE OR REPLACE FUNCTION public.guard_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'admin' AND NEW.user_id <> '2f82531f-7d3a-459d-9a5b-7e2d4e0430a4'::uuid THEN
    RAISE EXCEPTION 'The admin role is reserved for the workspace owner' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS user_roles_guard_admin ON public.user_roles;
CREATE TRIGGER user_roles_guard_admin BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_admin_role();

-- Owner's admin role must never be deleted
CREATE OR REPLACE FUNCTION public.guard_admin_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.user_id = '2f82531f-7d3a-459d-9a5b-7e2d4e0430a4'::uuid THEN
    RAISE EXCEPTION 'Cannot remove the owner admin role' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS user_roles_guard_admin_delete ON public.user_roles;
CREATE TRIGGER user_roles_guard_admin_delete BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_admin_delete();

-- ============ Schools ============
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_key text GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name_key)
);
GRANT SELECT ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view schools" ON public.schools FOR SELECT TO authenticated USING (true);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school text;

CREATE OR REPLACE FUNCTION public.profiles_sync_school()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.school IS NOT NULL AND btrim(NEW.school) <> '' THEN
    NEW.school := btrim(NEW.school);
    INSERT INTO public.schools (name) VALUES (NEW.school) ON CONFLICT (name_key) DO NOTHING;
  ELSE
    NEW.school := NULL;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS profiles_sync_school ON public.profiles;
CREATE TRIGGER profiles_sync_school BEFORE INSERT OR UPDATE OF school ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_sync_school();

-- ============ Principal requests ============
CREATE TABLE IF NOT EXISTS public.principal_requests (
  user_id uuid PRIMARY KEY,
  school text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.principal_requests TO authenticated;
GRANT ALL ON public.principal_requests TO service_role;
ALTER TABLE public.principal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own principal request" ON public.principal_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view principal requests" ON public.principal_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS principal_requests_updated_at ON public.principal_requests;
CREATE TRIGGER principal_requests_updated_at BEFORE UPDATE ON public.principal_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ New-user handling ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role text := lower(coalesce(NEW.raw_user_meta_data->>'requested_role', 'teacher'));
  _school text := nullif(btrim(coalesce(NEW.raw_user_meta_data->>'school','')), '');
BEGIN
  INSERT INTO public.profiles (id, display_name, school)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), _school);

  IF _role = 'principal' THEN
    INSERT INTO public.principal_requests (user_id, school) VALUES (NEW.id, _school)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- ============ Admin functions ============
CREATE OR REPLACE FUNCTION public.approve_principal(_user_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501'; END IF;
  UPDATE public.principal_requests
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'declined' END,
         decided_by = auth.uid(), decided_at = now()
   WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.principal_requests (user_id, school, status, decided_by, decided_at)
    SELECT _user_id, p.school, CASE WHEN _approve THEN 'approved' ELSE 'declined' END, auth.uid(), now()
    FROM public.profiles p WHERE p.id = _user_id;
  END IF;
  IF _approve THEN
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'teacher';
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'principal') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'principal';
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'teacher') ON CONFLICT DO NOTHING;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.approve_principal(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_principal(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501'; END IF;
  IF _role NOT IN ('teacher','principal') THEN RAISE EXCEPTION 'Role must be teacher or principal'; END IF;
  IF _user_id = '2f82531f-7d3a-459d-9a5b-7e2d4e0430a4'::uuid THEN RAISE EXCEPTION 'Cannot change the owner role'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role IN ('teacher','principal');
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role::public.app_role) ON CONFLICT DO NOTHING;
  IF _role = 'principal' THEN
    INSERT INTO public.principal_requests (user_id, school, status, decided_by, decided_at)
    SELECT _user_id, p.school, 'approved', auth.uid(), now() FROM public.profiles p WHERE p.id = _user_id
    ON CONFLICT (user_id) DO UPDATE SET status='approved', decided_by=auth.uid(), decided_at=now();
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_school(_user_id uuid, _school text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin role required' USING ERRCODE='42501'; END IF;
  UPDATE public.profiles SET school = nullif(btrim(coalesce(_school,'')),'') WHERE id = _user_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_user_school(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_school(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, display_name text, email text, created_at timestamptz, roles app_role[], school text, principal_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  RETURN QUERY
  SELECT p.id, p.display_name, u.email::text, p.created_at,
         COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::app_role[]),
         p.school, pr.status
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.principal_requests pr ON pr.user_id = p.id
  GROUP BY p.id, p.display_name, u.email, p.created_at, p.school, pr.status
  ORDER BY (pr.status = 'pending') DESC NULLS LAST, p.created_at DESC;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ============ Principal helpers ============
CREATE OR REPLACE FUNCTION public.principal_school()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(btrim(p.school)) FROM public.profiles p
  WHERE p.id = auth.uid() AND public.has_role(auth.uid(),'principal') AND p.school IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.principal_school() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.principal_school() TO authenticated;

-- Resolve filters to the set of courses a principal may see.
CREATE OR REPLACE FUNCTION public.building_scope_courses(
  _teachers uuid[] DEFAULT NULL, _subjects text[] DEFAULT NULL, _grades text[] DEFAULT NULL,
  _courses uuid[] DEFAULT NULL, _school_year text DEFAULT NULL)
RETURNS TABLE(course_id uuid, teacher_id uuid, teacher_name text, course_name text, subject text, grade text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sch AS (SELECT public.principal_school() AS key),
  staff AS (
    SELECT p.id, COALESCE(NULLIF(p.display_name,''), split_part(u.email,'@',1)) AS name, p.default_subject, p.default_grade
    FROM public.profiles p JOIN sch ON lower(btrim(p.school)) = sch.key
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE sch.key IS NOT NULL
      AND p.id <> auth.uid()
      AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'teacher')
  ),
  base AS (
    SELECT c.id AS course_id, c.teacher_id, s.name AS teacher_name, c.name AS course_name,
           COALESCE(td.subject, tdd.subject, s.default_subject) AS subject,
           COALESCE(td.grade, tdd.grade, s.default_grade) AS grade
    FROM public.courses c
    JOIN staff s ON s.id = c.teacher_id
    LEFT JOIN public.teacher_disciplines td ON td.id = c.discipline_id
    LEFT JOIN LATERAL (
      SELECT t.subject, t.grade FROM public.teacher_disciplines t
      WHERE t.teacher_id = c.teacher_id ORDER BY t.is_default DESC, t.created_at LIMIT 1
    ) tdd ON c.discipline_id IS NULL
    WHERE c.archived_at IS NULL AND c.hidden = false
      AND (_school_year IS NULL OR public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) = _school_year)
  )
  SELECT * FROM base b
  WHERE (_teachers IS NULL OR cardinality(_teachers) = 0 OR b.teacher_id = ANY(_teachers))
    AND (_subjects IS NULL OR cardinality(_subjects) = 0 OR b.subject = ANY(_subjects))
    AND (_grades   IS NULL OR cardinality(_grades)   = 0 OR b.grade   = ANY(_grades))
    AND (_courses  IS NULL OR cardinality(_courses)  = 0 OR b.course_id = ANY(_courses));
$$;
REVOKE ALL ON FUNCTION public.building_scope_courses(uuid[], text[], text[], uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.building_scope_courses(uuid[], text[], text[], uuid[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.building_filter_options(_school_year text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sc AS (SELECT * FROM public.building_scope_courses(NULL,NULL,NULL,NULL,_school_year))
  SELECT jsonb_build_object(
    'school', (SELECT p.school FROM public.profiles p WHERE p.id = auth.uid()),
    'teachers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.teacher_id, 'name', t.teacher_name) ORDER BY t.teacher_name)
                  FROM (SELECT DISTINCT teacher_id, teacher_name FROM sc) t), '[]'::jsonb),
    'subjects', COALESCE((SELECT jsonb_agg(DISTINCT subject) FROM sc WHERE subject IS NOT NULL), '[]'::jsonb),
    'grades',   COALESCE((SELECT jsonb_agg(DISTINCT grade) FROM sc WHERE grade IS NOT NULL), '[]'::jsonb),
    'courses',  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', course_id, 'name', course_name, 'teacher_id', teacher_id,
                           'teacher_name', teacher_name, 'subject', subject, 'grade', grade) ORDER BY teacher_name, course_name) FROM sc), '[]'::jsonb),
    'school_years', COALESCE((SELECT jsonb_agg(DISTINCT public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)))
                      FROM public.courses c WHERE c.teacher_id IN (SELECT DISTINCT teacher_id FROM public.building_scope_courses())), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.building_filter_options(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.building_filter_options(text) TO authenticated;

-- Flat fact rows: latest mastery per (student, standard) within scope.
CREATE OR REPLACE FUNCTION public.building_facts(
  _teachers uuid[] DEFAULT NULL, _subjects text[] DEFAULT NULL, _grades text[] DEFAULT NULL,
  _courses uuid[] DEFAULT NULL, _school_year text DEFAULT NULL, _student_search text DEFAULT NULL)
RETURNS TABLE(student_id uuid, student_label text, teacher_id uuid, teacher_name text, course_id uuid, course_name text,
              subject text, grade text, standard_id uuid, standard_code text, standard_description text,
              mastery_score numeric, mastered boolean, computed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sc AS (SELECT * FROM public.building_scope_courses(_teachers,_subjects,_grades,_courses,_school_year)),
  ss AS (
    SELECT st.id AS student_id, COALESCE(NULLIF(st.pseudonym,''), st.name) AS student_label, st.teacher_id, st.course_id
    FROM public.students st JOIN sc ON sc.course_id = st.course_id
    WHERE st.merged_into IS NULL AND st.archived_at IS NULL
      AND (_student_search IS NULL OR btrim(_student_search) = '' OR st.name ILIKE '%'||btrim(_student_search)||'%' OR st.pseudonym ILIKE '%'||btrim(_student_search)||'%')
  ),
  latest AS (
    SELECT DISTINCT ON (ms.student_id, ms.standard_id) ms.student_id, ms.standard_id, ms.mastery_score, ms.mastered, ms.computed_at
    FROM public.mastery_snapshots ms JOIN ss ON ss.student_id = ms.student_id AND ss.teacher_id = ms.teacher_id
    WHERE (_school_year IS NULL OR public.school_year_label(ms.computed_at) = _school_year)
    ORDER BY ms.student_id, ms.standard_id, ms.computed_at DESC
  )
  SELECT ss.student_id, ss.student_label, sc.teacher_id, sc.teacher_name, sc.course_id, sc.course_name, sc.subject, sc.grade,
         l.standard_id, s.code, s.description, l.mastery_score, l.mastered, l.computed_at
  FROM ss JOIN sc ON sc.course_id = ss.course_id
  LEFT JOIN latest l ON l.student_id = ss.student_id
  LEFT JOIN public.standards s ON s.id = l.standard_id;
$$;
REVOKE ALL ON FUNCTION public.building_facts(uuid[], text[], text[], uuid[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.building_facts(uuid[], text[], text[], uuid[], text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.building_overview(
  _teachers uuid[] DEFAULT NULL, _subjects text[] DEFAULT NULL, _grades text[] DEFAULT NULL,
  _courses uuid[] DEFAULT NULL, _school_year text DEFAULT NULL, _student_search text DEFAULT NULL)
RETURNS TABLE(teacher_count int, class_count int, student_count int, standards_assessed int, avg_mastery numeric, pct_mastered numeric,
              basic int, proficient int, advanced int, trend jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH f AS (SELECT * FROM public.building_facts(_teachers,_subjects,_grades,_courses,_school_year,_student_search)),
  scored AS (SELECT * FROM f WHERE mastery_score IS NOT NULL),
  per_student AS (SELECT student_id, AVG(mastery_score) AS avg FROM scored GROUP BY student_id),
  trend AS (
    SELECT to_char(date_trunc('week', computed_at), 'IYYY-"W"IW') AS label, date_trunc('week', computed_at) AS ts,
           ROUND(AVG(mastery_score)::numeric,4) AS avg, COUNT(*)::int AS n
    FROM scored GROUP BY 1,2 ORDER BY 2
  )
  SELECT (SELECT COUNT(DISTINCT teacher_id)::int FROM f),
         (SELECT COUNT(DISTINCT course_id)::int FROM f),
         (SELECT COUNT(DISTINCT student_id)::int FROM f),
         (SELECT COUNT(DISTINCT standard_id)::int FROM scored),
         (SELECT ROUND(AVG(mastery_score)::numeric,4) FROM scored),
         (SELECT ROUND(AVG(CASE WHEN mastered THEN 1 ELSE 0 END)::numeric,4) FROM scored),
         (SELECT COUNT(*)::int FROM per_student WHERE avg < 0.6),
         (SELECT COUNT(*)::int FROM per_student WHERE avg >= 0.6 AND avg < 0.8),
         (SELECT COUNT(*)::int FROM per_student WHERE avg >= 0.8),
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('label',label,'ts',ts,'avg',avg,'n',n) ORDER BY ts),'[]'::jsonb) FROM trend);
$$;
REVOKE ALL ON FUNCTION public.building_overview(uuid[], text[], text[], uuid[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.building_overview(uuid[], text[], text[], uuid[], text, text) TO authenticated;

-- Grouped breakdown by one or two dimensions: teacher | subject | grade | course | student | standard
CREATE OR REPLACE FUNCTION public.building_breakdown(
  _dims text[],
  _teachers uuid[] DEFAULT NULL, _subjects text[] DEFAULT NULL, _grades text[] DEFAULT NULL,
  _courses uuid[] DEFAULT NULL, _school_year text DEFAULT NULL, _student_search text DEFAULT NULL)
RETURNS TABLE(key1 text, label1 text, key2 text, label2 text, teacher_count int, class_count int, student_count int,
              standards_assessed int, avg_mastery numeric, pct_mastered numeric, basic int, proficient int, advanced int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH f AS (SELECT * FROM public.building_facts(_teachers,_subjects,_grades,_courses,_school_year,_student_search)),
  keyed AS (
    SELECT f.*,
      CASE _dims[1] WHEN 'teacher' THEN teacher_id::text WHEN 'subject' THEN subject WHEN 'grade' THEN grade
                    WHEN 'course' THEN course_id::text WHEN 'student' THEN student_id::text WHEN 'standard' THEN standard_id::text ELSE 'all' END AS k1,
      CASE _dims[1] WHEN 'teacher' THEN teacher_name WHEN 'subject' THEN subject WHEN 'grade' THEN grade
                    WHEN 'course' THEN course_name WHEN 'student' THEN student_label WHEN 'standard' THEN standard_code ELSE 'All' END AS l1,
      CASE _dims[2] WHEN 'teacher' THEN teacher_id::text WHEN 'subject' THEN subject WHEN 'grade' THEN grade
                    WHEN 'course' THEN course_id::text WHEN 'student' THEN student_id::text WHEN 'standard' THEN standard_id::text ELSE NULL END AS k2,
      CASE _dims[2] WHEN 'teacher' THEN teacher_name WHEN 'subject' THEN subject WHEN 'grade' THEN grade
                    WHEN 'course' THEN course_name WHEN 'student' THEN student_label WHEN 'standard' THEN standard_code ELSE NULL END AS l2
    FROM f
  ),
  filtered AS (
    SELECT * FROM keyed
    WHERE (_dims[1] <> 'standard' OR standard_id IS NOT NULL)
      AND (_dims[2] IS NULL OR _dims[2] <> 'standard' OR standard_id IS NOT NULL)
  ),
  per_student AS (
    SELECT k1, k2, student_id, AVG(mastery_score) AS avg FROM filtered WHERE mastery_score IS NOT NULL GROUP BY k1, k2, student_id
  )
  SELECT k.k1, MIN(k.l1), k.k2, MIN(k.l2),
         COUNT(DISTINCT k.teacher_id)::int, COUNT(DISTINCT k.course_id)::int, COUNT(DISTINCT k.student_id)::int,
         COUNT(DISTINCT k.standard_id)::int,
         ROUND(AVG(k.mastery_score)::numeric,4),
         ROUND(AVG(CASE WHEN k.mastered THEN 1 WHEN k.mastered = false THEN 0 END)::numeric,4),
         (SELECT COUNT(*)::int FROM per_student p WHERE p.k1 = k.k1 AND p.k2 IS NOT DISTINCT FROM k.k2 AND p.avg < 0.6),
         (SELECT COUNT(*)::int FROM per_student p WHERE p.k1 = k.k1 AND p.k2 IS NOT DISTINCT FROM k.k2 AND p.avg >= 0.6 AND p.avg < 0.8),
         (SELECT COUNT(*)::int FROM per_student p WHERE p.k1 = k.k1 AND p.k2 IS NOT DISTINCT FROM k.k2 AND p.avg >= 0.8)
  FROM filtered k
  GROUP BY k.k1, k.k2
  ORDER BY MIN(k.l1), MIN(k.l2);
$$;
REVOKE ALL ON FUNCTION public.building_breakdown(text[], uuid[], text[], text[], uuid[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.building_breakdown(text[], uuid[], text[], text[], uuid[], text, text) TO authenticated;

-- Student history across every course at the school (same Canvas user).
CREATE OR REPLACE FUNCTION public.building_student_history(_student_id uuid)
RETURNS TABLE(school_year text, course_id uuid, course_name text, teacher_name text, subject text, grade text,
              standard_id uuid, standard_code text, standard_description text, mastery_score numeric, mastered boolean, attempts int, last_assessed timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sc AS (SELECT * FROM public.building_scope_courses()),
  seed AS (
    SELECT st.canvas_user_id FROM public.students st JOIN sc ON sc.course_id = st.course_id WHERE st.id = _student_id
  ),
  rows_ AS (
    SELECT st.id AS student_id, st.course_id, st.teacher_id
    FROM public.students st JOIN sc ON sc.course_id = st.course_id
    WHERE st.merged_into IS NULL AND (st.id = _student_id OR st.canvas_user_id IN (SELECT canvas_user_id FROM seed))
  ),
  latest AS (
    SELECT DISTINCT ON (ms.student_id, ms.standard_id) ms.student_id, ms.standard_id, ms.mastery_score, ms.mastered, ms.attempts, ms.computed_at
    FROM public.mastery_snapshots ms JOIN rows_ r ON r.student_id = ms.student_id AND r.teacher_id = ms.teacher_id
    ORDER BY ms.student_id, ms.standard_id, ms.computed_at DESC
  )
  SELECT public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)), c.id, c.name, sc.teacher_name,
         COALESCE(s.subject, sc.subject), COALESCE(s.grade, sc.grade), s.id, s.code, s.description,
         l.mastery_score, l.mastered, l.attempts, l.computed_at
  FROM rows_ r
  JOIN public.courses c ON c.id = r.course_id
  JOIN sc ON sc.course_id = c.id
  JOIN latest l ON l.student_id = r.student_id
  JOIN public.standards s ON s.id = l.standard_id
  ORDER BY l.computed_at DESC NULLS LAST, s.code;
$$;
REVOKE ALL ON FUNCTION public.building_student_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.building_student_history(uuid) TO authenticated;

-- PIN-gated, logged reveal of real names for students in the principal's building.
CREATE OR REPLACE FUNCTION public.reveal_building_identities(_student_ids uuid[], _pin text, _reason text DEFAULT NULL)
RETURNS TABLE(student_id uuid, real_name text, real_sortable_name text, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _hash text; _n int;
BEGIN
  IF public.principal_school() IS NULL THEN RAISE EXCEPTION 'Principal role with a school is required' USING ERRCODE='42501'; END IF;
  SELECT pin_hash INTO _hash FROM public.teacher_security WHERE teacher_id = auth.uid();
  IF _hash IS NULL THEN RAISE EXCEPTION 'PIN_NOT_SET'; END IF;
  IF _pin IS NULL OR _hash <> extensions.crypt(_pin, _hash) THEN RAISE EXCEPTION 'PIN_INVALID'; END IF;

  CREATE TEMP TABLE IF NOT EXISTS _allowed (student_id uuid) ON COMMIT DROP;
  DELETE FROM _allowed;
  INSERT INTO _allowed
  SELECT st.id FROM public.students st
  JOIN public.building_scope_courses() sc ON sc.course_id = st.course_id
  WHERE st.id = ANY(_student_ids);

  SELECT COUNT(*) INTO _n FROM _allowed;
  IF _n > 0 THEN
    INSERT INTO public.identity_reveals (teacher_id, course_id, reason, student_count)
    VALUES (auth.uid(), NULL, NULLIF(_reason,''), _n);
  END IF;

  RETURN QUERY
  SELECT si.student_id, si.real_name, si.real_sortable_name, si.email
  FROM public.student_identities si JOIN _allowed a ON a.student_id = si.student_id;
END; $$;
REVOKE ALL ON FUNCTION public.reveal_building_identities(uuid[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reveal_building_identities(uuid[], text, text) TO authenticated;

-- Lock down the new trigger helpers from direct calls
REVOKE ALL ON FUNCTION public.guard_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_admin_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_sync_school() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.building_facts(uuid[], text[], text[], uuid[], text, text) FROM authenticated;