ALTER TABLE public.curriculum_lessons ADD COLUMN IF NOT EXISTS chapter jsonb;
ALTER TABLE public.library_items ADD COLUMN IF NOT EXISTS chapter jsonb;

CREATE TABLE public.textbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  subject text,
  grade text,
  cover_url text,
  description text,
  is_published boolean NOT NULL DEFAULT false,
  share_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.textbooks TO authenticated;
GRANT ALL ON public.textbooks TO service_role;
ALTER TABLE public.textbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage textbooks" ON public.textbooks FOR ALL TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TABLE public.textbook_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id uuid NOT NULL REFERENCES public.textbooks(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  part_title text,
  sort_order integer NOT NULL DEFAULT 0,
  source text NOT NULL CHECK (source IN ('lesson','library_item')),
  lesson_id uuid REFERENCES public.curriculum_lessons(id) ON DELETE CASCADE,
  library_item_id uuid REFERENCES public.library_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source = 'lesson' AND lesson_id IS NOT NULL) OR (source = 'library_item' AND library_item_id IS NOT NULL))
);
CREATE INDEX textbook_chapters_book_idx ON public.textbook_chapters (textbook_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.textbook_chapters TO authenticated;
GRANT ALL ON public.textbook_chapters TO service_role;
ALTER TABLE public.textbook_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage textbook chapters" ON public.textbook_chapters FOR ALL TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER textbooks_set_updated_at BEFORE UPDATE ON public.textbooks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.get_shared_textbook(_share_token text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'id', t.id, 'title', t.title, 'subject', t.subject, 'grade', t.grade,
    'cover_url', t.cover_url, 'description', t.description, 'updated_at', t.updated_at,
    'chapters', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'part_title', c.part_title, 'sort_order', c.sort_order, 'source', c.source,
        'title', COALESCE(l.title, li.title),
        'chapter', COALESCE(l.chapter, li.chapter),
        'legacy', CASE WHEN l.id IS NOT NULL THEN jsonb_build_object(
            'title', l.title, 'objectives', l.objectives, 'intro', l.intro, 'explanation', l.explanation,
            'key_terms', l.key_terms, 'reading_title', l.reading_title, 'reading_paragraphs', l.reading_paragraphs, 'image_url', l.image_url)
          ELSE NULL END,
        'body', li.body
      ) ORDER BY c.sort_order)
      FROM public.textbook_chapters c
      LEFT JOIN public.curriculum_lessons l ON l.id = c.lesson_id
      LEFT JOIN public.library_items li ON li.id = c.library_item_id
      WHERE c.textbook_id = t.id
    ), '[]'::jsonb)
  )
  FROM public.textbooks t
  WHERE t.share_token = _share_token AND t.is_published = true
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_shared_textbook(text) TO anon, authenticated;