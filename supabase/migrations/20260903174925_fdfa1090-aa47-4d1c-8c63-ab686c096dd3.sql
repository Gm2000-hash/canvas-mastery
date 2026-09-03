CREATE TABLE public.library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reading','activity','lesson_plan')),
  title text NOT NULL,
  body text,
  source text NOT NULL DEFAULT 'created' CHECK (source IN ('upload','created','ai','canvas')),
  file_path text,
  file_mime text,
  file_name text,
  canvas_course_id bigint,
  canvas_item_id bigint,
  canvas_item_type text,
  grade text,
  subject text,
  search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(left(body, 200000),'')), 'B')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX library_items_tsv_idx ON public.library_items USING gin (search_tsv);
CREATE INDEX library_items_teacher_kind_idx ON public.library_items (teacher_id, kind);
CREATE UNIQUE INDEX library_items_canvas_uniq ON public.library_items (teacher_id, canvas_item_type, canvas_item_id) WHERE canvas_item_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT ALL ON public.library_items TO service_role;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own library items" ON public.library_items
  FOR ALL TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER library_items_set_updated_at BEFORE UPDATE ON public.library_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.library_item_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  library_item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  standard_id uuid NOT NULL REFERENCES public.standards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (library_item_id, standard_id)
);
CREATE INDEX library_item_standards_std_idx ON public.library_item_standards (teacher_id, standard_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_item_standards TO authenticated;
GRANT ALL ON public.library_item_standards TO service_role;
ALTER TABLE public.library_item_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own library item standards" ON public.library_item_standards
  FOR ALL TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- Storage: per-teacher folders in the private library-files bucket.
CREATE POLICY "Library files: owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'library-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Library files: owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'library-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Library files: owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'library-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Library files: owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'library-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Unified search across library items and imported quiz questions (owner-scoped).
CREATE OR REPLACE FUNCTION public.search_library(_q text DEFAULT NULL, _standard_id uuid DEFAULT NULL, _kind text DEFAULT NULL)
RETURNS TABLE (
  item_type text,
  item_id uuid,
  title text,
  snippet text,
  source text,
  standards jsonb,
  updated_at timestamptz,
  rank real
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT CASE WHEN coalesce(trim(_q),'') = '' THEN NULL ELSE websearch_to_tsquery('english', _q) END AS tsq
  ),
  items AS (
    SELECT li.kind AS item_type, li.id AS item_id, li.title,
           left(coalesce(li.body,''), 240) AS snippet, li.source,
           coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'description', s.description) ORDER BY s.code)
                     FROM library_item_standards lis JOIN standards s ON s.id = lis.standard_id
                     WHERE lis.library_item_id = li.id), '[]'::jsonb) AS standards,
           li.updated_at,
           CASE WHEN q.tsq IS NULL THEN 0::real ELSE ts_rank(li.search_tsv, q.tsq) END AS rank
    FROM library_items li, q
    WHERE li.teacher_id = auth.uid()
      AND (_kind IS NULL OR _kind = 'ALL' OR li.kind = _kind)
      AND (q.tsq IS NULL OR li.search_tsv @@ q.tsq OR li.title ILIKE '%' || _q || '%')
      AND (_standard_id IS NULL OR EXISTS (SELECT 1 FROM library_item_standards lis WHERE lis.library_item_id = li.id AND lis.standard_id = _standard_id))
  ),
  questions AS (
    SELECT 'question'::text AS item_type, qq.id AS item_id,
           coalesce(a.name, 'Quiz') || ' · Q' || coalesce(qq.position::text, '?') AS title,
           left(regexp_replace(coalesce(qq.question_text,''), '<[^>]+>', '', 'g'), 240) AS snippet,
           'canvas'::text AS source,
           coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'description', s.description) ORDER BY s.code)
                     FROM question_standards qs JOIN standards s ON s.id = qs.standard_id
                     WHERE qs.question_id = qq.id AND qs.confirmed), '[]'::jsonb) AS standards,
           qq.created_at AS updated_at,
           CASE WHEN q.tsq IS NULL THEN 0::real ELSE ts_rank(to_tsvector('english', coalesce(qq.question_text,'')), q.tsq) END AS rank
    FROM quiz_questions qq JOIN assignments a ON a.id = qq.assignment_id, q
    WHERE qq.teacher_id = auth.uid()
      AND (_kind IS NULL OR _kind = 'ALL' OR _kind = 'question')
      AND (q.tsq IS NULL OR to_tsvector('english', coalesce(qq.question_text,'')) @@ q.tsq OR qq.question_text ILIKE '%' || _q || '%')
      AND (_standard_id IS NULL OR EXISTS (SELECT 1 FROM question_standards qs WHERE qs.question_id = qq.id AND qs.standard_id = _standard_id AND qs.confirmed))
  )
  SELECT * FROM items
  UNION ALL
  SELECT * FROM questions
  ORDER BY rank DESC, updated_at DESC
  LIMIT 200;
$$;
GRANT EXECUTE ON FUNCTION public.search_library(text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.search_library(text, uuid, text) FROM anon, public;