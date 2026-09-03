-- student_identities: explicit deny-all for API roles; access only via SECURITY DEFINER reveal_* functions.
drop policy if exists "student_identities_no_direct_select" on public.student_identities;
drop policy if exists "student_identities_no_direct_write" on public.student_identities;
create policy "student_identities_no_direct_select" on public.student_identities
  for select to authenticated, anon using (false);
create policy "student_identities_no_direct_write" on public.student_identities
  for all to authenticated, anon using (false) with check (false);

-- avatars: owner-folder writes
drop policy if exists "curr_avatars_insert" on storage.objects;
drop policy if exists "curr_avatars_update" on storage.objects;
create policy "curr_avatars_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "curr_avatars_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- library-pdfs: owner, or published / shared book
drop policy if exists "curr_library-pdfs_select" on storage.objects;
create policy "curr_library-pdfs_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'library-pdfs' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.library_books b
        where b.file_path = storage.objects.name
          and (b.is_published = true or b.share_token is not null)
      )
    )
  );

-- book-covers / activity-media: owner-only reads
drop policy if exists "curr_book-covers_select" on storage.objects;
create policy "curr_book-covers_select" on storage.objects for select to authenticated
  using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "curr_activity-media_select" on storage.objects;
create policy "curr_activity-media_select" on storage.objects for select to authenticated
  using (bucket_id = 'activity-media' and (storage.foldername(name))[1] = auth.uid()::text);