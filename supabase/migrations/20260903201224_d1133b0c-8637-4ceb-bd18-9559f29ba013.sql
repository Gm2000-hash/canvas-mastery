DROP POLICY IF EXISTS "Teachers create own invitations" ON public.invitations;
CREATE POLICY "Teachers create own invitations" ON public.invitations
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "Teachers view own invitations" ON public.invitations;
CREATE POLICY "Teachers view own invitations" ON public.invitations
  FOR SELECT TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Delete own standards" ON public.standards;
CREATE POLICY "Delete own standards" ON public.standards
  FOR DELETE TO authenticated USING (teacher_id = auth.uid());
DROP POLICY IF EXISTS "Insert own standards" ON public.standards;
CREATE POLICY "Insert own standards" ON public.standards
  FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS "View shared or own standards" ON public.standards;
CREATE POLICY "View shared or own standards" ON public.standards
  FOR SELECT TO authenticated USING (teacher_id IS NULL OR teacher_id = auth.uid());