
-- 1. invitations table
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  note text,
  expires_at timestamptz,
  used_by uuid,
  used_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_created_by ON public.invitations(created_by);
CREATE INDEX idx_invitations_code ON public.invitations(code);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view own invitations"
  ON public.invitations FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Teachers create own invitations"
  ON public.invitations FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Teachers update own invitations"
  ON public.invitations FOR UPDATE
  USING (created_by = auth.uid());

-- 2. create_invitation RPC
CREATE OR REPLACE FUNCTION public.create_invitation(_note text DEFAULT NULL, _expires_at timestamptz DEFAULT NULL)
RETURNS TABLE(id uuid, code text, note text, expires_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
  _new_id uuid;
  _attempts int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  LOOP
    -- 12-char code, grouped XXXX-XXXX-XXXX, uppercase, no ambiguous chars
    _code := (
      SELECT string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
               1 + floor(random() * 32)::int, 1), '')
      FROM generate_series(1, 12)
    );
    _code := substr(_code,1,4) || '-' || substr(_code,5,4) || '-' || substr(_code,9,4);

    BEGIN
      INSERT INTO public.invitations (code, created_by, note, expires_at)
      VALUES (_code, auth.uid(), NULLIF(_note,''), _expires_at)
      RETURNING invitations.id INTO _new_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      _attempts := _attempts + 1;
      IF _attempts > 5 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN QUERY
  SELECT i.id, i.code, i.note, i.expires_at, i.created_at
  FROM public.invitations i WHERE i.id = _new_id;
END;
$$;

-- 3. redeem_invitation RPC (called from edge function with service role)
CREATE OR REPLACE FUNCTION public.redeem_invitation(_code text, _user_id uuid)
RETURNS TABLE(ok boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.invitations%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.invitations WHERE code = _code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid invitation code'; RETURN;
  END IF;
  IF _row.revoked THEN
    RETURN QUERY SELECT false, 'This invitation has been revoked'; RETURN;
  END IF;
  IF _row.used_by IS NOT NULL THEN
    RETURN QUERY SELECT false, 'This invitation has already been used'; RETURN;
  END IF;
  IF _row.expires_at IS NOT NULL AND _row.expires_at < now() THEN
    RETURN QUERY SELECT false, 'This invitation has expired'; RETURN;
  END IF;

  UPDATE public.invitations
  SET used_by = _user_id, used_at = now()
  WHERE id = _row.id;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;
