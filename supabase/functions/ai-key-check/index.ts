// Diagnostic: verifies the OpenRouter key without exposing it.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const raw = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const key = raw.trim();
  const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  return new Response(JSON.stringify({
    present: raw.length > 0,
    raw_length: raw.length,
    trimmed_length: key.length,
    prefix: key.slice(0, 6),
    has_whitespace: raw !== key,
    status: res.status,
    body: body.slice(0, 400),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
