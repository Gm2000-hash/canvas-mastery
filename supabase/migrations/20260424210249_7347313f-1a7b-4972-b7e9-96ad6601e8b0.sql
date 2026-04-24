DROP VIEW IF EXISTS public.canvas_connection_status;

CREATE OR REPLACE FUNCTION public.get_canvas_connection_status()
RETURNS TABLE (
  teacher_id uuid,
  base_url text,
  last_sync_at timestamptz,
  connected boolean,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cc.teacher_id,
    cc.base_url,
    cc.last_sync_at,
    (cc.api_token IS NOT NULL AND length(cc.api_token) > 0) AS connected,
    cc.updated_at
  FROM public.canvas_credentials cc
  WHERE cc.teacher_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_canvas_connection_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_canvas_connection_status() TO authenticated;