-- Allow admins to manage user roles
CREATE POLICY "Admins insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all profiles (so they can manage users)
CREATE POLICY "Admins view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Helper function: list all users with roles (admin-only)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, display_name text, email text, created_at timestamptz, roles app_role[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    u.email::text,
    p.created_at,
    COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::app_role[])
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  GROUP BY p.id, p.display_name, u.email, p.created_at
  ORDER BY p.created_at DESC;
END;
$$;