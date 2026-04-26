-- Unique index on question_responses for upsert-safe per-question score sync
CREATE UNIQUE INDEX IF NOT EXISTS question_responses_question_student_uq
  ON public.question_responses (question_id, student_id);

-- RPC: Question Bank tree + counts in one round trip.
-- Returns one row per standard that has at least one CONFIRMED question tag
-- (optionally filtered by course / subject / framework), plus aggregated stats.
CREATE OR REPLACE FUNCTION public.analytics_question_bank(
  _course_id uuid DEFAULT NULL,
  _subject text DEFAULT NULL,
  _framework text DEFAULT NULL
)
RETURNS TABLE (
  standard_id uuid,
  code text,
  parent_code text,
  description text,
  framework text,
  subject text,
  grade text,
  tagged_question_count integer,
  response_count integer,
  avg_pct_correct numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH tagged AS (
    SELECT
      qs.standard_id,
      qs.question_id
    FROM public.question_standards qs
    JOIN public.quiz_questions q ON q.id = qs.question_id
    JOIN public.assignments a ON a.id = q.assignment_id
    WHERE qs.teacher_id = auth.uid()
      AND qs.confirmed = true
      AND (_course_id IS NULL OR a.course_id = _course_id)
  ),
  per_standard AS (
    SELECT
      t.standard_id,
      COUNT(DISTINCT t.question_id)::int AS tagged_question_count,
      COUNT(r.id)::int AS response_count,
      CASE
        WHEN COUNT(r.id) FILTER (WHERE r.points_possible IS NOT NULL AND r.points_possible > 0) > 0
        THEN ROUND(
          AVG(
            CASE
              WHEN r.points_possible IS NOT NULL AND r.points_possible > 0
              THEN LEAST(1.0, GREATEST(0.0, r.points::numeric / r.points_possible))
            END
          )::numeric, 4)
        ELSE NULL
      END AS avg_pct_correct
    FROM tagged t
    LEFT JOIN public.question_responses r
      ON r.question_id = t.question_id
     AND r.teacher_id = auth.uid()
    GROUP BY t.standard_id
  )
  SELECT
    s.id AS standard_id,
    s.code,
    CASE
      WHEN s.code ~ '[-.][^-.]+$'
        THEN regexp_replace(s.code, '[-.][^-.]+$', '')
      ELSE s.code
    END AS parent_code,
    s.description,
    COALESCE(s.framework, 'STATE') AS framework,
    s.subject,
    s.grade,
    ps.tagged_question_count,
    ps.response_count,
    ps.avg_pct_correct
  FROM per_standard ps
  JOIN public.standards s ON s.id = ps.standard_id
  WHERE (_subject IS NULL OR s.subject = _subject)
    AND (_framework IS NULL OR COALESCE(s.framework, 'STATE') = _framework)
  ORDER BY s.code;
$$;