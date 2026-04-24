CREATE OR REPLACE FUNCTION public.analytics_mastery_trends(
  _course_id uuid DEFAULT NULL,
  _subject text DEFAULT NULL,
  _granularity text DEFAULT 'week'
)
RETURNS TABLE(
  bucket_label text,
  bucket_ts timestamptz,
  framework text,
  subject text,
  avg_mastery numeric,
  sample_size integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      ms.computed_at,
      COALESCE(s.framework, 'STATE') AS framework,
      s.subject AS subject,
      ms.mastery_score,
      st.course_id
    FROM public.mastery_snapshots ms
    JOIN public.standards s ON s.id = ms.standard_id
    JOIN public.students st ON st.id = ms.student_id
    WHERE ms.teacher_id = auth.uid()
      AND (_course_id IS NULL OR st.course_id = _course_id)
      AND (_subject IS NULL OR s.subject = _subject)
  ),
  per_asg AS (
    SELECT
      a.name AS assignment_name,
      COALESCE(a.due_at, MAX(sub.submitted_at), MAX(sub.graded_at)) AS bucket_ts,
      COALESCE(s.framework, 'STATE') AS framework,
      s.subject AS subject,
      AVG(sub.percentage)::numeric AS avg_pct,
      COUNT(DISTINCT sub.student_id)::int AS sample_size
    FROM public.assignments a
    JOIN public.submissions sub ON sub.assignment_id = a.id
    JOIN public.assignment_standards asg ON asg.assignment_id = a.id AND asg.confirmed = true
    JOIN public.standards s ON s.id = asg.standard_id
    WHERE a.teacher_id = auth.uid()
      AND (_course_id IS NULL OR a.course_id = _course_id)
      AND (_subject IS NULL OR s.subject = _subject)
      AND sub.percentage IS NOT NULL
    GROUP BY a.id, a.name, a.due_at, s.framework, s.subject
  )
  SELECT * FROM (
    SELECT
      to_char(date_trunc('week', computed_at), 'IYYY-"W"IW') AS bucket_label,
      date_trunc('week', computed_at) AS bucket_ts,
      framework, subject,
      ROUND(AVG(mastery_score)::numeric, 4) AS avg_mastery,
      COUNT(*)::int AS sample_size
    FROM base WHERE _granularity = 'week'
    GROUP BY 1,2,3,4

    UNION ALL

    SELECT
      to_char(date_trunc('month', computed_at), 'YYYY-MM') AS bucket_label,
      date_trunc('month', computed_at) AS bucket_ts,
      framework, subject,
      ROUND(AVG(mastery_score)::numeric, 4) AS avg_mastery,
      COUNT(*)::int AS sample_size
    FROM base WHERE _granularity = 'month'
    GROUP BY 1,2,3,4

    UNION ALL

    SELECT
      assignment_name AS bucket_label,
      bucket_ts,
      framework, subject,
      ROUND(avg_pct / 100.0, 4) AS avg_mastery,
      sample_size
    FROM per_asg WHERE _granularity = 'assignment'
  ) q
  ORDER BY bucket_ts NULLS LAST, framework, subject;
$$;

CREATE OR REPLACE FUNCTION public.analytics_class_breakdown()
RETURNS TABLE(
  course_id uuid, course_name text, subject text, framework text,
  student_count integer, assessment_count integer,
  avg_mastery numeric, pct_mastered numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH disc AS (
    SELECT c.id AS course_id, c.name AS course_name,
           td.subject, COALESCE(td.framework, 'STATE') AS framework
    FROM public.courses c
    LEFT JOIN public.teacher_disciplines td ON td.id = c.discipline_id
    WHERE c.teacher_id = auth.uid()
  )
  SELECT d.course_id, d.course_name, d.subject, d.framework,
    (SELECT COUNT(*)::int FROM public.students st WHERE st.course_id = d.course_id) AS student_count,
    (SELECT COUNT(*)::int FROM public.assignments a WHERE a.course_id = d.course_id) AS assessment_count,
    ROUND(AVG(ms.mastery_score)::numeric, 4) AS avg_mastery,
    ROUND(AVG(CASE WHEN ms.mastered THEN 1 ELSE 0 END)::numeric, 4) AS pct_mastered
  FROM disc d
  LEFT JOIN public.students st ON st.course_id = d.course_id
  LEFT JOIN public.mastery_snapshots ms ON ms.student_id = st.id AND ms.teacher_id = auth.uid()
  GROUP BY d.course_id, d.course_name, d.subject, d.framework
  ORDER BY d.course_name;
$$;

CREATE OR REPLACE FUNCTION public.analytics_student_breakdown(
  _course_id uuid DEFAULT NULL
)
RETURNS TABLE(
  student_id uuid, student_name text, course_id uuid, course_name text,
  standards_assessed integer, standards_mastered integer,
  avg_mastery numeric, last_activity timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT st.id, st.name, c.id, c.name,
    COUNT(DISTINCT ms.standard_id)::int,
    COUNT(DISTINCT CASE WHEN ms.mastered THEN ms.standard_id END)::int,
    ROUND(AVG(ms.mastery_score)::numeric, 4),
    MAX(ms.computed_at)
  FROM public.students st
  JOIN public.courses c ON c.id = st.course_id
  LEFT JOIN public.mastery_snapshots ms ON ms.student_id = st.id AND ms.teacher_id = auth.uid()
  WHERE st.teacher_id = auth.uid()
    AND (_course_id IS NULL OR st.course_id = _course_id)
  GROUP BY st.id, st.name, st.sortable_name, c.id, c.name
  ORDER BY st.sortable_name NULLS LAST, st.name;
$$;

CREATE OR REPLACE FUNCTION public.analytics_standard_breakdown(
  _course_id uuid DEFAULT NULL,
  _subject text DEFAULT NULL,
  _framework text DEFAULT NULL
)
RETURNS TABLE(
  standard_id uuid, code text, description text, subject text, grade text,
  framework text, students_assessed integer, students_mastered integer,
  avg_mastery numeric, pct_mastered numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.code, s.description, s.subject, s.grade,
    COALESCE(s.framework, 'STATE'),
    COUNT(DISTINCT ms.student_id)::int,
    COUNT(DISTINCT CASE WHEN ms.mastered THEN ms.student_id END)::int,
    ROUND(AVG(ms.mastery_score)::numeric, 4),
    ROUND(AVG(CASE WHEN ms.mastered THEN 1 ELSE 0 END)::numeric, 4)
  FROM public.standards s
  LEFT JOIN public.mastery_snapshots ms ON ms.standard_id = s.id AND ms.teacher_id = auth.uid()
  LEFT JOIN public.students st ON st.id = ms.student_id
    AND (_course_id IS NULL OR st.course_id = _course_id)
  WHERE (s.teacher_id = auth.uid() OR s.teacher_id IS NULL)
    AND (_subject IS NULL OR s.subject = _subject)
    AND (_framework IS NULL OR COALESCE(s.framework, 'STATE') = _framework)
    AND (_course_id IS NULL OR ms.standard_id IS NOT NULL)
  GROUP BY s.id
  HAVING (_course_id IS NULL) OR COUNT(ms.id) > 0
  ORDER BY ROUND(AVG(CASE WHEN ms.mastered THEN 1 ELSE 0 END)::numeric, 4) NULLS LAST, s.code;
$$;

CREATE OR REPLACE FUNCTION public.analytics_assignment_breakdown(
  _course_id uuid DEFAULT NULL
)
RETURNS TABLE(
  assignment_id uuid, name text, course_id uuid, course_name text,
  kind text, due_at timestamptz, points_possible numeric,
  submission_count integer, avg_percentage numeric, standards_tagged integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.name, c.id, c.name, a.kind::text, a.due_at, a.points_possible,
    (SELECT COUNT(*)::int FROM public.submissions sub WHERE sub.assignment_id = a.id),
    (SELECT ROUND(AVG(sub.percentage)::numeric, 2) FROM public.submissions sub WHERE sub.assignment_id = a.id),
    (SELECT COUNT(*)::int FROM public.assignment_standards asg WHERE asg.assignment_id = a.id AND asg.confirmed)
  FROM public.assignments a
  JOIN public.courses c ON c.id = a.course_id
  WHERE a.teacher_id = auth.uid()
    AND (_course_id IS NULL OR a.course_id = _course_id)
  ORDER BY a.due_at DESC NULLS LAST, a.name;
$$;

CREATE OR REPLACE FUNCTION public.analytics_mastery_distribution(
  _course_id uuid DEFAULT NULL,
  _subject text DEFAULT NULL
)
RETURNS TABLE(bucket text, bucket_min numeric, bucket_max numeric, count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH buckets AS (
    SELECT * FROM (VALUES
      ('Not yet (0–40%)',       0.00::numeric, 0.40::numeric),
      ('Approaching (40–60%)',  0.40,          0.60),
      ('Developing (60–80%)',   0.60,          0.80),
      ('Proficient (80–95%)',   0.80,          0.95),
      ('Advanced (95–100%)',    0.95,          1.01)
    ) AS b(label, lo, hi)
  ),
  data AS (
    SELECT ms.mastery_score
    FROM public.mastery_snapshots ms
    JOIN public.students st ON st.id = ms.student_id
    JOIN public.standards s ON s.id = ms.standard_id
    WHERE ms.teacher_id = auth.uid()
      AND (_course_id IS NULL OR st.course_id = _course_id)
      AND (_subject IS NULL OR s.subject = _subject)
  )
  SELECT b.label, b.lo, b.hi,
         (SELECT COUNT(*)::int FROM data d WHERE d.mastery_score >= b.lo AND d.mastery_score < b.hi)
  FROM buckets b
  ORDER BY b.lo;
$$;

CREATE OR REPLACE FUNCTION public.analytics_question_breakdown(
  _assignment_id uuid DEFAULT NULL,
  _course_id uuid DEFAULT NULL
)
RETURNS TABLE(
  question_id uuid, assignment_id uuid, assignment_name text,
  question_position integer, question_text text, points_possible numeric,
  responses integer, correct_count integer,
  pct_correct numeric, avg_points numeric, standards_tagged integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.id, q.assignment_id, a.name, q.position, q.question_text, q.points_possible,
    (SELECT COUNT(*)::int FROM public.question_responses r WHERE r.question_id = q.id),
    (SELECT COUNT(*)::int FROM public.question_responses r WHERE r.question_id = q.id AND r.correct),
    (SELECT ROUND(AVG(CASE WHEN r.correct THEN 1.0 ELSE 0.0 END)::numeric, 4)
     FROM public.question_responses r WHERE r.question_id = q.id),
    (SELECT ROUND(AVG(r.points)::numeric, 2)
     FROM public.question_responses r WHERE r.question_id = q.id),
    (SELECT COUNT(*)::int FROM public.question_standards qs WHERE qs.question_id = q.id AND qs.confirmed)
  FROM public.quiz_questions q
  JOIN public.assignments a ON a.id = q.assignment_id
  WHERE q.teacher_id = auth.uid()
    AND (_assignment_id IS NULL OR q.assignment_id = _assignment_id)
    AND (_course_id IS NULL OR a.course_id = _course_id)
  ORDER BY a.due_at DESC NULLS LAST, q.position NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.analytics_active_dimensions()
RETURNS TABLE(subject text, framework text, standard_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.subject,
         COALESCE(s.framework, 'STATE') AS framework,
         COUNT(*)::int
  FROM public.standards s
  WHERE (s.teacher_id = auth.uid() OR s.teacher_id IS NULL)
  GROUP BY s.subject, COALESCE(s.framework, 'STATE')
  ORDER BY s.subject, framework;
$$;