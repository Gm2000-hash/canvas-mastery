-- Security PIN feature: required to reveal student identities.
-- Stored as a bcrypt hash via pgcrypto. Never expires; admin can reset.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.teacher_security (
  teacher_id uuid PRIMARY KEY,
  pin_hash text,
  pin_set_at timestamp with time zone,
  pin_reset_by uuid,
  pin_reset_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_security ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own security row" ON public.teacher_security;
CREATE POLICY "View own security row"
  ON public.teacher_security
  FOR SELECT
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Note: writes happen via SECURITY DEFINER RPCs only; no direct insert/update/delete policies.

-- Helper: does the caller have a PIN set?
CREATE OR REPLACE FUNCTION public.has_security_pin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_security
    WHERE teacher_id = auth.uid() AND pin_hash IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.has_security_pin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_security_pin() TO authenticated;

-- Set the caller's PIN. Allowed only if they don't have one yet
-- (or it was cleared by an admin reset).
CREATE OR REPLACE FUNCTION public.set_security_pin(_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  VALUES (auth.uid(), crypt(_pin, gen_salt('bf', 10)), now(), now())
  ON CONFLICT (teacher_id) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash,
      pin_set_at = now(),
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_security_pin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_security_pin(text) TO authenticated;

-- Verify a PIN against the caller's stored hash.
CREATE OR REPLACE FUNCTION public.verify_security_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
  RETURN _hash = crypt(_pin, _hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_security_pin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_security_pin(text) TO authenticated;

-- Admin: clear another user's PIN so they can set a new one.
CREATE OR REPLACE FUNCTION public.admin_reset_security_pin(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  INSERT INTO public.teacher_security (teacher_id, pin_hash, pin_reset_by, pin_reset_at, updated_at)
  VALUES (_user_id, NULL, auth.uid(), now(), now())
  ON CONFLICT (teacher_id) DO UPDATE
  SET pin_hash = NULL,
      pin_reset_by = auth.uid(),
      pin_reset_at = now(),
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_security_pin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_security_pin(uuid) TO authenticated;

-- Replace reveal_student_identities to require a valid PIN.
CREATE OR REPLACE FUNCTION public.reveal_student_identities(_course_id uuid, _reason text DEFAULT NULL, _pin text DEFAULT NULL)
RETURNS TABLE(student_id uuid, real_name text, real_sortable_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF _pin IS NULL OR _hash <> crypt(_pin, _hash) THEN
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

REVOKE ALL ON FUNCTION public.reveal_student_identities(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reveal_student_identities(uuid, text, text) TO authenticated;

-- Admin listing helper: include pin_set flag on admin_list_users if it exists.
-- (We leave admin_list_users alone; the admin UI will fetch from teacher_security directly.)