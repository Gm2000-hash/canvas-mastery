CREATE TABLE public.app_secrets (
  name text PRIMARY KEY,
  value_ciphertext text NOT NULL,
  hint text,
  set_by uuid,
  set_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_secrets TO service_role;
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_secret_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hint text,
  action text NOT NULL CHECK (action IN ('set','removed')),
  set_by uuid,
  set_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_secret_history TO authenticated;
GRANT ALL ON public.app_secret_history TO service_role;
ALTER TABLE public.app_secret_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view secret history" ON public.app_secret_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX app_secret_history_name_idx ON public.app_secret_history (name, set_at DESC);