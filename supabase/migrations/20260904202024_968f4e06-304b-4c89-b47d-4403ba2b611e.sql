DROP POLICY IF EXISTS "curr_library-pdfs_select" ON storage.objects;
CREATE POLICY "curr_library-pdfs_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'library-pdfs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.library_books b
      WHERE b.file_path = objects.name AND b.is_published = true
    )
  )
);