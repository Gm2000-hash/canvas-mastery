-- Department report builder: add two matrix RPCs for heatmap-style data tables.
-- Privacy: peers always show pseudonyms; viewer's own classes/students keep real names.

CREATE OR REPLACE FUNCTION public.department_standard_class_matrix(
  _subject text,
  _grades text[] DEFAULT NULL,
  _school_year text DEFAULT NULL
)
RETURNS TABLE(
  standard_id uuid,
  standard_code text,
  standard_description text,
  standard_grade text,
  course_id uuid,
  is_own boolean,
  class_label text,
  class_grade text,
  students_assessed integer,
  students_mastered integer,
  avg_mastery numeric,
  pct_mastered numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _viewer uuid := auth.uid();
  _year text := COALESCE(_school_year, public.current_school_year_label());
BEGIN
  RETURN QUERY
  WITH dept AS (
    SELECT teacher_id FROM public.department_membership(_subject, _grades, _year)
  ),
  -- Stable, anonymized class labels per peer teacher (Class A, Class B, ...).
  ordered_classes AS (
    SELECT
      c.id AS course_id,
      c.teacher_id,
      c.name,
      c.term,
      c.created_at,
      ROW_NUMBER() OVER (PARTITION BY c.teacher_id ORDER BY c.created_at, c.id) AS seq
    FROM public.courses c
    JOIN dept d ON d.teacher_id = c.teacher_id
    WHERE COALESCE(c.hidden, false) = false
      AND c.archived_at IS NULL
      AND public.school_year_for(c.created_at) = _year
      AND EXISTS (
        SELECT 1 FROM public.teacher_disciplines td
        WHERE td.teacher_id = c.teacher_id
          AND td.subject = _subject
          AND (_grades IS NULL OR td.grade = ANY(_grades))
      )
  ),
  course_grade AS (
    SELECT oc.course_id, MAX(td.grade) AS grade
    FROM ordered_classes oc
    LEFT JOIN public.teacher_disciplines td
      ON td.teacher_id = oc.teacher_id AND td.subject = _subject
    GROUP BY oc.course_id
  ),
  enrolled AS (
    SELECT s.id AS student_id, s.course_id, s.teacher_id
    FROM public.students s
    JOIN ordered_classes oc ON oc.course_id = s.course_id
    WHERE s.archived_at IS NULL
  ),
  agg AS (
    SELECT
      ms.standard_id,
      e.course_id,
      COUNT(DISTINCT ms.student_id)::int AS students_assessed,
      COUNT(DISTINCT ms.student_id) FILTER (WHERE ms.mastered)::int AS students_mastered,
      AVG(ms.mastery_score)::numeric AS avg_mastery
    FROM public.mastery_snapshots ms
    JOIN enrolled e ON e.student_id = ms.student_id AND e.teacher_id = ms.teacher_id
    GROUP BY ms.standard_id, e.course_id
  )
  SELECT
    a.standard_id,
    st.code,
    st.description,
    st.grade,
    a.course_id,
    (oc.teacher_id = _viewer) AS is_own,
    CASE WHEN oc.teacher_id = _viewer
         THEN oc.name
         ELSE 'Class ' || chr(64 + LEAST(oc.seq, 26)::int) END AS class_label,
    cg.grade,
    a.students_assessed,
    a.students_mastered,
    ROUND(a.avg_mastery, 4),
    CASE WHEN a.students_assessed > 0
         THEN ROUND(a.students_mastered::numeric / a.students_assessed, 4)
         ELSE NULL END
  FROM agg a
  JOIN ordered_classes oc ON oc.course_id = a.course_id
  JOIN public.standards st ON st.id = a.standard_id
  LEFT JOIN course_grade cg ON cg.course_id = a.course_id
  WHERE st.subject = _subject
    AND (_grades IS NULL OR st.grade = ANY(_grades))
  ORDER BY st.code, oc.teacher_id, oc.seq;
END;
$$;

CREATE OR REPLACE FUNCTION public.department_student_standard_matrix(
  _subject text,
  _grades text[] DEFAULT NULL,
  _school_year text DEFAULT NULL
)
RETURNS TABLE(
  student_id uuid,
  is_own boolean,
  student_label text,
  class_label text,
  standard_id uuid,
  standard_code text,
  mastery_score numeric,
  mastered boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _viewer uuid := auth.uid();
  _year text := COALESCE(_school_year, public.current_school_year_label());
BEGIN
  RETURN QUERY
  WITH dept AS (
    SELECT teacher_id FROM public.department_membership(_subject, _grades, _year)
  ),
  ordered_classes AS (
    SELECT c.id AS course_id, c.teacher_id, c.name,
           ROW_NUMBER() OVER (PARTITION BY c.teacher_id ORDER BY c.created_at, c.id) AS seq
    FROM public.courses c
    JOIN dept d ON d.teacher_id = c.teacher_id
    WHERE COALESCE(c.hidden, false) = false
      AND c.archived_at IS NULL
      AND public.school_year_for(c.created_at) = _year
  ),
  ordered_students AS (
    SELECT s.id AS student_id, s.teacher_id, s.course_id, s.name,
           ROW_NUMBER() OVER (PARTITION BY s.teacher_id ORDER BY s.created_at, s.id) AS seq
    FROM public.students s
    JOIN ordered_classes oc ON oc.course_id = s.course_id
    WHERE s.archived_at IS NULL
  )
  SELECT
    os.student_id,
    (os.teacher_id = _viewer) AS is_own,
    CASE WHEN os.teacher_id = _viewer THEN os.name
         ELSE 'S-' || os.seq::text END AS student_label,
    CASE WHEN oc.teacher_id = _viewer THEN oc.name
         ELSE 'Class ' || chr(64 + LEAST(oc.seq, 26)::int) END AS class_label,
    ms.standard_id,
    st.code,
    ROUND(ms.mastery_score, 4),
    ms.mastered
  FROM public.mastery_snapshots ms
  JOIN ordered_students os ON os.student_id = ms.student_id AND os.teacher_id = ms.teacher_id
  JOIN ordered_classes oc ON oc.course_id = os.course_id
  JOIN public.standards st ON st.id = ms.standard_id
  WHERE st.subject = _subject
    AND (_grades IS NULL OR st.grade = ANY(_grades))
  ORDER BY os.teacher_id, os.seq, st.code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.department_standard_class_matrix(text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.department_student_standard_matrix(text, text[], text) TO authenticated;