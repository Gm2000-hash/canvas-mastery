// Temporary diagnostic: verifies the normalized OpenRouter key without exposing it.
import { normalizeOpenRouterKey } from "../_shared/openrouter.ts";

Deno.serve(async () => {
  const key = normalizeOpenRouterKey(Deno.env.get("OPENROUTER_API_KEY"));
  const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  return new Response(JSON.stringify({ prefix: key.slice(0, 9), status: res.status, body: body.slice(0, 300) }), {
    headers: { "Content-Type": "application/json" },
  });
});
