
CREATE OR REPLACE FUNCTION public.mastery_debug(_student_id uuid, _standard_id uuid)
RETURNS TABLE(
  source text,                  -- 'question_direct' | 'question_text_match' | 'assignment_fallback'
  assignment_id uuid,
  assignment_name text,
  question_id uuid,
  question_position integer,
  question_text text,
  points numeric,
  points_possible numeric,
  pct numeric,
  weight numeric,
  confirmed boolean,
  ai_suggested boolean,
  confidence numeric,
  matched_via_question_id uuid, -- when text-matched, this is the tagged source question
  occurred_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH
  -- Tags for this standard owned by the teacher (confirmed OR ai-suggested)
  tags AS (
    SELECT qs.question_id, qs.confirmed, qs.ai_suggested, qs.confidence
    FROM public.question_standards qs
    WHERE qs.teacher_id = auth.uid()
      AND qs.standard_id = _standard_id
      AND (qs.confirmed = true OR qs.ai_suggested = true)
  ),
  -- Normalized text of every tagged question (so we can text-match)
  tagged_questions AS (
    SELECT
      q.id,
      lower(regexp_replace(regexp_replace(coalesce(q.question_text, ''), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')) AS norm_text,
      t.confirmed, t.ai_suggested, t.confidence
    FROM tags t
    JOIN public.quiz_questions q ON q.id = t.question_id
    WHERE q.teacher_id = auth.uid()
  ),
  -- Find every question (any quiz) whose normalized text matches a tagged one
  text_matched AS (
    SELECT
      q.id AS question_id,
      tq.id AS source_question_id,
      tq.confirmed, tq.ai_suggested, tq.confidence
    FROM public.quiz_questions q
    JOIN tagged_questions tq
      ON lower(regexp_replace(regexp_replace(coalesce(q.question_text, ''), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')) = tq.norm_text
    WHERE q.teacher_id = auth.uid()
      AND length(trim(coalesce(q.question_text, ''))) > 0
  ),
  -- Combined: each question linked to the standard, marked direct or text-match
  linked AS (
    SELECT t.question_id, NULL::uuid AS source_question_id, t.confirmed, t.ai_suggested, t.confidence,
           'question_direct'::text AS source
    FROM tags t
    UNION ALL
    SELECT tm.question_id, tm.source_question_id, tm.confirmed, tm.ai_suggested, tm.confidence,
           'question_text_match'::text AS source
    FROM text_matched tm
    WHERE tm.question_id NOT IN (SELECT question_id FROM tags)
  ),
  -- Best (highest weight) link per question, so we don't double-count
  best_link AS (
    SELECT DISTINCT ON (l.question_id)
      l.question_id, l.source_question_id, l.confirmed, l.ai_suggested, l.confidence, l.source,
      CASE WHEN l.confirmed THEN 1.0
           ELSE GREATEST(0.1, LEAST(1.0, COALESCE(l.confidence, 0.5))) END AS weight
    FROM linked l
    ORDER BY l.question_id,
             (CASE WHEN l.confirmed THEN 1.0
                   ELSE GREATEST(0.1, LEAST(1.0, COALESCE(l.confidence, 0.5))) END) DESC
  ),
  q_rows AS (
    SELECT
      bl.source,
      a.id AS assignment_id,
      a.name AS assignment_name,
      q.id AS question_id,
      q.position AS question_position,
      q.question_text,
      r.points,
      r.points_possible,
      CASE WHEN r.points_possible IS NOT NULL AND r.points_possible > 0
           THEN ROUND((r.points::numeric / r.points_possible)::numeric, 4)
           ELSE NULL END AS pct,
      bl.weight,
      bl.confirmed,
      bl.ai_suggested,
      bl.confidence,
      bl.source_question_id AS matched_via_question_id,
      r.created_at AS occurred_at
    FROM best_link bl
    JOIN public.quiz_questions q ON q.id = bl.question_id
    JOIN public.assignments a ON a.id = q.assignment_id
    LEFT JOIN public.question_responses r
      ON r.question_id = q.id
     AND r.student_id = _student_id
     AND r.teacher_id = auth.uid()
    WHERE q.teacher_id = auth.uid()
  ),
  -- Assignment-grain fallback (only show if no question-grain rows exist)
  fallback_rows AS (
    SELECT
      'assignment_fallback'::text AS source,
      a.id AS assignment_id,
      a.name AS assignment_name,
      NULL::uuid AS question_id,
      NULL::integer AS question_position,
      NULL::text AS question_text,
      sub.score AS points,
      sub.points_possible,
      CASE WHEN sub.percentage IS NOT NULL THEN ROUND((sub.percentage / 100.0)::numeric, 4) ELSE NULL END AS pct,
      1.0::numeric AS weight,
      true AS confirmed,
      false AS ai_suggested,
      NULL::numeric AS confidence,
      NULL::uuid AS matched_via_question_id,
      COALESCE(sub.graded_at, sub.submitted_at) AS occurred_at
    FROM public.assignment_standards asg
    JOIN public.assignments a ON a.id = asg.assignment_id
    JOIN public.submissions sub ON sub.assignment_id = a.id AND sub.student_id = _student_id
    WHERE asg.teacher_id = auth.uid()
      AND asg.standard_id = _standard_id
      AND asg.confirmed = true
      AND sub.teacher_id = auth.uid()
      AND sub.percentage IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM q_rows WHERE q_rows.points IS NOT NULL)
  )
  SELECT * FROM q_rows
  UNION ALL
  SELECT * FROM fallback_rows
  ORDER BY occurred_at DESC NULLS LAST, assignment_name, question_position;
$$;
