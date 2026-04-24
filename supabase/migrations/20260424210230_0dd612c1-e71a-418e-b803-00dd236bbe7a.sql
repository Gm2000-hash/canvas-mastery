DROP VIEW IF EXISTS public.canvas_connection_status;

CREATE VIEW public.canvas_connection_status
WITH (security_invoker = false) AS
SELECT
  teacher_id,
  base_url,
  last_sync_at,
  (api_token IS NOT NULL AND length(api_token) > 0) AS connected,
  updated_at
FROM public.canvas_credentials
WHERE teacher_id = auth.uid();

GRANT SELECT ON public.canvas_connection_status TO authenticated;