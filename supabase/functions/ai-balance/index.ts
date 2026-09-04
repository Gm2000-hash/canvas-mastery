// Admin-only: report the shared OpenRouter balance so a low balance is caught
// before every teacher's AI features stop at once.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAiProviderConfig, getOpenRouterCredits, OPENROUTER_MODEL_CHAINS } from "../_shared/openrouter.ts";

const LOW_BALANCE_USD = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const provider = getAiProviderConfig().provider;
    const credits = provider === "openrouter" ? await getOpenRouterCredits() : null;
    return json({
      provider,
      threshold: LOW_BALANCE_USD,
      credits,
      low: credits ? credits.remaining < LOW_BALANCE_USD : false,
      chains: OPENROUTER_MODEL_CHAINS,
    });
  } catch (e) {
    console.error("ai-balance", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
