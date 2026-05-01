CREATE OR REPLACE FUNCTION public.reveal_my_identities(_reason text DEFAULT NULL, _pin text DEFAULT NULL)
RETURNS TABLE(student_id uuid, real_name text, real_sortable_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
  _hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pin_hash INTO _hash
  FROM public.teacher_security
  WHERE teacher_id = auth.uid();

  IF _hash IS NULL THEN
    RAISE EXCEPTION 'PIN_NOT_SET';
  END IF;

  IF _pin IS NULL OR _hash <> crypt(_pin, _hash) THEN
    RAISE EXCEPTION 'PIN_INVALID';
  END IF;

  SELECT COUNT(*) INTO _count
  FROM public.student_identities si
  WHERE si.teacher_id = auth.uid();

  INSERT INTO public.identity_reveals (teacher_id, course_id, reason, student_count)
  VALUES (auth.uid(), NULL, NULLIF(_reason, ''), _count);

  RETURN QUERY
  SELECT si.student_id, si.real_name, si.real_sortable_name, si.email
  FROM public.student_identities si
  WHERE si.teacher_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_my_identities(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reveal_my_identities(text, text) TO authenticated;