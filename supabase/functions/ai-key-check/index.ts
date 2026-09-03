// Temporary diagnostic: verifies the OpenRouter key without exposing it.
Deno.serve(async () => {
  const raw = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const key = raw.trim();
  const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  return new Response(JSON.stringify({
    raw_length: raw.length,
    trimmed_length: key.length,
    prefix: key.slice(0, 9),
    suffix_len_ok: key.length > 20,
    has_whitespace: raw !== key,
    starts_with_bearer: /^bearer/i.test(key),
    status: res.status,
    body: body.slice(0, 400),
  }), { headers: { "Content-Type": "application/json" } });
});
