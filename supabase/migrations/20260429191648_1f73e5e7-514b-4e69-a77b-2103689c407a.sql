
-- =============================================================
-- Department analytics
-- =============================================================
-- Returns the set of teacher_ids that share a subject (+ optional grade)
-- in a given school year. Used internally by every department_* function.
CREATE OR REPLACE FUNCTION public.department_membership(
  _subject text,
  _grades  text[] DEFAULT NULL,
  _school_year text DEFAULT NULL
)
RETURNS TABLE(teacher_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT td.teacher_id
  FROM public.teacher_disciplines td
  WHERE td.subject = _subject
    AND (_grades IS NULL OR array_length(_grades,1) IS NULL OR td.grade = ANY(_grades))
    AND EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.teacher_id = td.teacher_id
        AND c.discipline_id = td.id
        AND c.archived_at IS NULL
        AND (
          _school_year IS NULL
          OR public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) = _school_year
        )
    );
$$;

-- =============================================================
-- Landing page: subjects this teacher participates in + counts
-- =============================================================
CREATE OR REPLACE FUNCTION public.department_subjects(_school_year text DEFAULT NULL)
RETURNS TABLE(
  subject text,
  grades text[],
  teacher_count integer,
  class_count integer,
  student_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH my_subjects AS (
    SELECT DISTINCT td.subject
    FROM public.teacher_disciplines td
    WHERE td.teacher_id = auth.uid()
  ),
  my_grades AS (
    SELECT td.subject, array_agg(DISTINCT td.grade ORDER BY td.grade) AS grades
    FROM public.teacher_disciplines td
    WHERE td.teacher_id = auth.uid()
    GROUP BY td.subject
  )
  SELECT
    ms.subject,
    mg.grades,
    (SELECT COUNT(DISTINCT m.teacher_id)::int
       FROM public.department_membership(ms.subject, NULL, _school_year) m),
    (SELECT COUNT(DISTINCT c.id)::int
       FROM public.courses c
       JOIN public.teacher_disciplines td2 ON td2.id = c.discipline_id
       WHERE td2.subject = ms.subject
         AND c.archived_at IS NULL
         AND (_school_year IS NULL OR public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) = _school_year)
         AND c.teacher_id IN (SELECT teacher_id FROM public.department_membership(ms.subject, NULL, _school_year))),
    (SELECT COUNT(*)::int
       FROM public.students st
       JOIN public.courses c ON c.id = st.course_id
       JOIN public.teacher_disciplines td2 ON td2.id = c.discipline_id
       WHERE td2.subject = ms.subject
         AND st.merged_into IS NULL
         AND st.archived_at IS NULL
         AND c.archived_at IS NULL
         AND (_school_year IS NULL OR public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) = _school_year)
         AND st.teacher_id IN (SELECT teacher_id FROM public.department_membership(ms.subject, NULL, _school_year)))
  FROM my_subjects ms
  LEFT JOIN my_grades mg ON mg.subject = ms.subject
  ORDER BY ms.subject;
$$;

-- =============================================================
-- Helper view-like CTE function: "department scope" returns
-- (course, teacher) rows that the caller is allowed to see.
-- Caller must be a member of the department (have a matching discipline row).
-- =============================================================

-- Overview: KPIs + distribution + weekly trend
CREATE OR REPLACE FUNCTION public.department_overview(
  _subject text,
  _grades text[] DEFAULT NULL,
  _school_year text DEFAULT NULL
)
RETURNS TABLE(
  teacher_count integer,
  class_count integer,
  student_count integer,
  avg_mastery numeric,
  pct_mastered numeric,
  -- distribution as JSON for convenience
  distribution jsonb,
  trend jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_member boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_disciplines td
    WHERE td.teacher_id = auth.uid() AND td.subject = _subject
  ) INTO _is_member;

  IF NOT _is_member THEN
    RETURN; -- empty
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT teacher_id FROM public.department_membership(_subject, _grades, _school_year)
  ),
  scope_courses AS (
    SELECT c.id AS course_id, c.teacher_id
    FROM public.courses c
    JOIN public.teacher_disciplines td ON td.id = c.discipline_id
    WHERE td.subject = _subject
      AND (_grades IS NULL OR array_length(_grades,1) IS NULL OR td.grade = ANY(_grades))
      AND c.archived_at IS NULL
      AND c.teacher_id IN (SELECT teacher_id FROM members)
      AND (_school_year IS NULL OR public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) = _school_year)
  ),
  scope_students AS (
    SELECT st.id AS student_id, st.teacher_id, st.course_id
    FROM public.students st
    JOIN scope_courses sc ON sc.course_id = st.course_id
    WHERE st.merged_into IS NULL AND st.archived_at IS NULL
  ),
  latest_ms AS (
    SELECT DISTINCT ON (ms.student_id, ms.standard_id)
      ms.student_id, ms.standard_id, ms.mastery_score, ms.mastered, ms.computed_at
    FROM public.mastery_snapshots ms
    JOIN scope_students ss ON ss.student_id = ms.student_id AND ss.teacher_id = ms.teacher_id
    WHERE (_school_year IS NULL OR public.school_year_label(ms.computed_at) = _school_year)
    ORDER BY ms.student_id, ms.standard_id, ms.computed_at DESC
  ),
  buckets AS (
    SELECT * FROM (VALUES
      ('Not yet (0–40%)',       0.00::numeric, 0.40::numeric),
      ('Approaching (40–60%)',  0.40,          0.60),
      ('Developing (60–80%)',   0.60,          0.80),
      ('Proficient (80–95%)',   0.80,          0.95),
      ('Advanced (95–100%)',    0.95,          1.01)
    ) AS b(label, lo, hi)
  ),
  dist AS (
    SELECT b.label, b.lo, b.hi,
           (SELECT COUNT(*)::int FROM latest_ms d WHERE d.mastery_score >= b.lo AND d.mastery_score < b.hi) AS n
    FROM buckets b
  ),
  trend_rows AS (
    SELECT to_char(date_trunc('week', ms.computed_at), 'IYYY-"W"IW') AS bucket_label,
           date_trunc('week', ms.computed_at) AS bucket_ts,
           ROUND(AVG(ms.mastery_score)::numeric, 4) AS avg_mastery,
           COUNT(*)::int AS sample_size
    FROM latest_ms ms
    GROUP BY 1, 2
    ORDER BY 2
  )
  SELECT
    (SELECT COUNT(DISTINCT teacher_id)::int FROM scope_courses),
    (SELECT COUNT(*)::int FROM scope_courses),
    (SELECT COUNT(*)::int FROM scope_students),
    (SELECT ROUND(AVG(mastery_score)::numeric, 4) FROM latest_ms),
    (SELECT ROUND(AVG(CASE WHEN mastered THEN 1 ELSE 0 END)::numeric, 4) FROM latest_ms),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'lo', lo, 'hi', hi, 'count', n) ORDER BY lo), '[]'::jsonb) FROM dist),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('label', bucket_label, 'ts', bucket_ts, 'avg', avg_mastery, 'n', sample_size) ORDER BY bucket_ts), '[]'::jsonb) FROM trend_rows);
END;
$$;

-- Standards breakdown across the department
CREATE OR REPLACE FUNCTION public.department_standards(
  _subject text,
  _grades text[] DEFAULT NULL,
  _school_year text DEFAULT NULL
)
RETURNS TABLE(
  standard_id uuid,
  code text,
  description text,
  grade text,
  framework text,
  students_assessed integer,
  students_mastered integer,
  avg_mastery numeric,
  pct_mastered numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH members AS (
    SELECT teacher_id FROM public.department_membership(_subject, _grades, _school_year)
    WHERE EXISTS (
      SELECT 1 FROM public.teacher_disciplines td
      WHERE td.teacher_id = auth.uid() AND td.subject = _subject
    )
  ),
  scope_students AS (
    SELECT st.id AS student_id, st.teacher_id
    FROM public.students st
    JOIN public.courses c ON c.id = st.course_id
    JOIN public.teacher_disciplines td ON td.id = c.discipline_id
    WHERE td.subject = _subject
      AND (_grades IS NULL OR array_length(_grades,1) IS NULL OR td.grade = ANY(_grades))
      AND st.merged_into IS NULL AND st.archived_at IS NULL
      AND c.archived_at IS NULL
      AND st.teacher_id IN (SELECT teacher_id FROM members)
      AND (_school_year IS NULL OR public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) = _school_year)
  ),
  latest_ms AS (
    SELECT DISTINCT ON (ms.student_id, ms.standard_id)
      ms.student_id, ms.standard_id, ms.mastery_score, ms.mastered, ms.computed_at
    FROM public.mastery_snapshots ms
    JOIN scope_students ss ON ss.student_id = ms.student_id AND ss.teacher_id = ms.teacher_id
    WHERE (_school_year IS NULL OR public.school_year_label(ms.computed_at) = _school_year)
    ORDER BY ms.student_id, ms.standard_id, ms.computed_at DESC
  )
  SELECT
    s.id, s.code, s.description, s.grade, COALESCE(s.framework, 'STATE'),
    COUNT(DISTINCT lms.student_id)::int,
    COUNT(DISTINCT CASE WHEN lms.mastered THEN lms.student_id END)::int,
    ROUND(AVG(lms.mastery_score)::numeric, 4),
    ROUND(AVG(CASE WHEN lms.mastered THEN 1 ELSE 0 END)::numeric, 4)
  FROM public.standards s
  JOIN latest_ms lms ON lms.standard_id = s.id
  WHERE s.subject = _subject
    AND (_grades IS NULL OR array_length(_grades,1) IS NULL OR s.grade = ANY(_grades))
  GROUP BY s.id
  HAVING COUNT(lms.standard_id) > 0
  ORDER BY ROUND(AVG(CASE WHEN lms.mastered THEN 1 ELSE 0 END)::numeric, 4) NULLS LAST, s.code;
$$;

-- Class breakdown across the department (own classes show real names, peers anonymized)
CREATE OR REPLACE FUNCTION public.department_classes(
  _subject text,
  _grades text[] DEFAULT NULL,
  _school_year text DEFAULT NULL
)
RETURNS TABLE(
  course_id uuid,
  is_own boolean,
  display_label text,
  grade text,
  student_count integer,
  avg_mastery numeric,
  pct_mastered numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH members AS (
    SELECT teacher_id FROM public.department_membership(_subject, _grades, _school_year)
    WHERE EXISTS (
      SELECT 1 FROM public.teacher_disciplines td
      WHERE td.teacher_id = auth.uid() AND td.subject = _subject
    )
  ),
  scope_courses AS (
    SELECT c.id AS course_id, c.teacher_id, c.name, td.grade
    FROM public.courses c
    JOIN public.teacher_disciplines td ON td.id = c.discipline_id
    WHERE td.subject = _subject
      AND (_grades IS NULL OR array_length(_grades,1) IS NULL OR td.grade = ANY(_grades))
      AND c.archived_at IS NULL
      AND c.teacher_id IN (SELECT teacher_id FROM members)
      AND (_school_year IS NULL OR public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) = _school_year)
  ),
  -- Stable peer letter labels
  peer_labels AS (
    SELECT sc.course_id,
           'Class ' || chr(64 + (dense_rank() OVER (ORDER BY sc.teacher_id, sc.course_id))::int) AS label
    FROM scope_courses sc
    WHERE sc.teacher_id <> auth.uid()
  ),
  scope_students AS (
    SELECT st.id AS student_id, st.teacher_id, st.course_id
    FROM public.students st
    JOIN scope_courses sc ON sc.course_id = st.course_id
    WHERE st.merged_into IS NULL AND st.archived_at IS NULL
  ),
  latest_ms AS (
    SELECT DISTINCT ON (ms.student_id, ms.standard_id)
      ms.student_id, ms.standard_id, ms.mastery_score, ms.mastered, ms.computed_at
    FROM public.mastery_snapshots ms
    JOIN scope_students ss ON ss.student_id = ms.student_id AND ss.teacher_id = ms.teacher_id
    WHERE (_school_year IS NULL OR public.school_year_label(ms.computed_at) = _school_year)
    ORDER BY ms.student_id, ms.standard_id, ms.computed_at DESC
  )
  SELECT
    sc.course_id,
    (sc.teacher_id = auth.uid()) AS is_own,
    CASE WHEN sc.teacher_id = auth.uid() THEN sc.name ELSE pl.label END,
    sc.grade,
    (SELECT COUNT(*)::int FROM scope_students s WHERE s.course_id = sc.course_id),
    ROUND(AVG(lms.mastery_score)::numeric, 4),
    ROUND(AVG(CASE WHEN lms.mastered THEN 1 ELSE 0 END)::numeric, 4)
  FROM scope_courses sc
  LEFT JOIN peer_labels pl ON pl.course_id = sc.course_id
  LEFT JOIN scope_students ss ON ss.course_id = sc.course_id
  LEFT JOIN latest_ms lms ON lms.student_id = ss.student_id
  GROUP BY sc.course_id, sc.teacher_id, sc.name, pl.label, sc.grade
  ORDER BY (sc.teacher_id = auth.uid()) DESC, sc.grade, COALESCE(pl.label, sc.name);
$$;

-- Students breakdown (own students show real names; peer students get S-N labels)
CREATE OR REPLACE FUNCTION public.department_students(
  _subject text,
  _grades text[] DEFAULT NULL,
  _school_year text DEFAULT NULL
)
RETURNS TABLE(
  student_id uuid,
  is_own boolean,
  display_name text,
  class_label text,
  grade text,
  standards_assessed integer,
  standards_mastered integer,
  avg_mastery numeric,
  last_activity timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH members AS (
    SELECT teacher_id FROM public.department_membership(_subject, _grades, _school_year)
    WHERE EXISTS (
      SELECT 1 FROM public.teacher_disciplines td
      WHERE td.teacher_id = auth.uid() AND td.subject = _subject
    )
  ),
  scope_courses AS (
    SELECT c.id AS course_id, c.teacher_id, c.name, td.grade
    FROM public.courses c
    JOIN public.teacher_disciplines td ON td.id = c.discipline_id
    WHERE td.subject = _subject
      AND (_grades IS NULL OR array_length(_grades,1) IS NULL OR td.grade = ANY(_grades))
      AND c.archived_at IS NULL
      AND c.teacher_id IN (SELECT teacher_id FROM members)
      AND (_school_year IS NULL OR public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) = _school_year)
  ),
  peer_class_labels AS (
    SELECT sc.course_id,
           'Class ' || chr(64 + (dense_rank() OVER (ORDER BY sc.teacher_id, sc.course_id))::int) AS label
    FROM scope_courses sc
    WHERE sc.teacher_id <> auth.uid()
  ),
  scope_students AS (
    SELECT st.id AS student_id, st.teacher_id, st.course_id, st.name, st.sortable_name
    FROM public.students st
    JOIN scope_courses sc ON sc.course_id = st.course_id
    WHERE st.merged_into IS NULL AND st.archived_at IS NULL
  ),
  peer_student_labels AS (
    SELECT ss.student_id,
           'S-' || (dense_rank() OVER (PARTITION BY ss.teacher_id ORDER BY ss.student_id))::text AS label
    FROM scope_students ss
    WHERE ss.teacher_id <> auth.uid()
  ),
  latest_ms AS (
    SELECT DISTINCT ON (ms.student_id, ms.standard_id)
      ms.student_id, ms.standard_id, ms.mastery_score, ms.mastered, ms.computed_at
    FROM public.mastery_snapshots ms
    JOIN scope_students ss ON ss.student_id = ms.student_id AND ss.teacher_id = ms.teacher_id
    WHERE (_school_year IS NULL OR public.school_year_label(ms.computed_at) = _school_year)
    ORDER BY ms.student_id, ms.standard_id, ms.computed_at DESC
  )
  SELECT
    ss.student_id,
    (ss.teacher_id = auth.uid()),
    CASE WHEN ss.teacher_id = auth.uid() THEN ss.name ELSE psl.label END,
    CASE WHEN ss.teacher_id = auth.uid() THEN sc.name ELSE pcl.label END,
    sc.grade,
    COUNT(DISTINCT lms.standard_id)::int,
    COUNT(DISTINCT CASE WHEN lms.mastered THEN lms.standard_id END)::int,
    ROUND(AVG(lms.mastery_score)::numeric, 4),
    MAX(lms.computed_at)
  FROM scope_students ss
  JOIN scope_courses sc ON sc.course_id = ss.course_id
  LEFT JOIN peer_class_labels pcl ON pcl.course_id = ss.course_id
  LEFT JOIN peer_student_labels psl ON psl.student_id = ss.student_id
  LEFT JOIN latest_ms lms ON lms.student_id = ss.student_id
  GROUP BY ss.student_id, ss.teacher_id, ss.name, ss.sortable_name, psl.label, sc.name, pcl.label, sc.grade
  ORDER BY (ss.teacher_id = auth.uid()) DESC, ss.sortable_name NULLS LAST, ss.name;
$$;

-- Common assessments across the department (matched by name_normalized)
CREATE OR REPLACE FUNCTION public.department_assessments(
  _subject text,
  _grades text[] DEFAULT NULL,
  _school_year text DEFAULT NULL
)
RETURNS TABLE(
  name_normalized text,
  display_name text,
  teacher_count integer,
  class_count integer,
  submission_count integer,
  avg_percentage numeric,
  standards_tagged integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH members AS (
    SELECT teacher_id FROM public.department_membership(_subject, _grades, _school_year)
    WHERE EXISTS (
      SELECT 1 FROM public.teacher_disciplines td
      WHERE td.teacher_id = auth.uid() AND td.subject = _subject
    )
  ),
  scope_courses AS (
    SELECT c.id AS course_id, c.teacher_id
    FROM public.courses c
    JOIN public.teacher_disciplines td ON td.id = c.discipline_id
    WHERE td.subject = _subject
      AND (_grades IS NULL OR array_length(_grades,1) IS NULL OR td.grade = ANY(_grades))
      AND c.archived_at IS NULL
      AND c.teacher_id IN (SELECT teacher_id FROM members)
      AND (_school_year IS NULL OR public.school_year_label(COALESCE(c.end_at, c.last_synced_at, c.created_at)) = _school_year)
  ),
  scope_assignments AS (
    SELECT a.id, a.name, a.name_normalized, a.teacher_id, a.course_id
    FROM public.assignments a
    JOIN scope_courses sc ON sc.course_id = a.course_id AND sc.teacher_id = a.teacher_id
    WHERE a.name_normalized IS NOT NULL AND length(a.name_normalized) >= 3
  )
  SELECT
    sa.name_normalized,
    (array_agg(sa.name ORDER BY sa.name))[1] AS display_name,
    COUNT(DISTINCT sa.teacher_id)::int,
    COUNT(DISTINCT sa.course_id)::int,
    (SELECT COUNT(*)::int FROM public.submissions sub WHERE sub.assignment_id IN (SELECT id FROM scope_assignments sa2 WHERE sa2.name_normalized = sa.name_normalized)),
    (SELECT ROUND(AVG(sub.percentage)::numeric, 2) FROM public.submissions sub WHERE sub.assignment_id IN (SELECT id FROM scope_assignments sa2 WHERE sa2.name_normalized = sa.name_normalized) AND sub.percentage IS NOT NULL),
    (SELECT COUNT(*)::int FROM public.assignment_standards asg WHERE asg.assignment_id IN (SELECT id FROM scope_assignments sa2 WHERE sa2.name_normalized = sa.name_normalized) AND (asg.confirmed OR asg.ai_suggested))
  FROM scope_assignments sa
  GROUP BY sa.name_normalized
  HAVING COUNT(DISTINCT sa.teacher_id) >= 1
  ORDER BY COUNT(DISTINCT sa.teacher_id) DESC, COUNT(DISTINCT sa.course_id) DESC, display_name
  LIMIT 200;
$$;
