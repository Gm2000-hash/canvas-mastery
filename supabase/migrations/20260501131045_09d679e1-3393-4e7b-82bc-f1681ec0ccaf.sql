CREATE OR REPLACE FUNCTION public.set_security_pin(_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _existing text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _pin IS NULL OR length(_pin) < 6 OR length(_pin) > 12 THEN
    RAISE EXCEPTION 'PIN must be between 6 and 12 characters';
  END IF;

  SELECT pin_hash INTO _existing
  FROM public.teacher_security
  WHERE teacher_id = auth.uid();

  IF _existing IS NOT NULL THEN
    RAISE EXCEPTION 'A PIN is already set. Ask an admin to reset it.';
  END IF;

  INSERT INTO public.teacher_security (teacher_id, pin_hash, pin_set_at, updated_at)
  VALUES (auth.uid(), extensions.crypt(_pin, extensions.gen_salt('bf'::text, 10)), now(), now())
  ON CONFLICT (teacher_id) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash,
      pin_set_at = now(),
      updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_security_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
BEGIN
  IF auth.uid() IS NULL OR _pin IS NULL THEN
    RETURN false;
  END IF;
  SELECT pin_hash INTO _hash
  FROM public.teacher_security
  WHERE teacher_id = auth.uid();
  IF _hash IS NULL THEN
    RETURN false;
  END IF;
  RETURN _hash = extensions.crypt(_pin, _hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_student_identities(_course_id uuid, _reason text DEFAULT NULL, _pin text DEFAULT NULL)
RETURNS TABLE(student_id uuid, real_name text, real_sortable_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _count integer;
  _hash text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id AND c.teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this course';
  END IF;

  SELECT pin_hash INTO _hash
  FROM public.teacher_security
  WHERE teacher_id = auth.uid();

  IF _hash IS NULL THEN
    RAISE EXCEPTION 'PIN_NOT_SET';
  END IF;

  IF _pin IS NULL OR _hash <> extensions.crypt(_pin, _hash) THEN
    RAISE EXCEPTION 'PIN_INVALID';
  END IF;

  SELECT COUNT(*) INTO _count
  FROM public.students st
  WHERE st.course_id = _course_id AND st.teacher_id = auth.uid();

  INSERT INTO public.identity_reveals (teacher_id, course_id, reason, student_count)
  VALUES (auth.uid(), _course_id, NULLIF(_reason, ''), _count);

  RETURN QUERY
  SELECT si.student_id, si.real_name, si.real_sortable_name, si.email
  FROM public.student_identities si
  JOIN public.students st ON st.id = si.student_id
  WHERE st.course_id = _course_id
    AND st.teacher_id = auth.uid()
    AND si.teacher_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_my_identities(_reason text DEFAULT NULL, _pin text DEFAULT NULL)
RETURNS TABLE(student_id uuid, real_name text, real_sortable_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  IF _pin IS NULL OR _hash <> extensions.crypt(_pin, _hash) THEN
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