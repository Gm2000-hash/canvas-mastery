// Admin-only: view the active AI provider / balance and manage the shared
// OpenRouter key (stored encrypted in app_secrets; overrides the env secret).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  checkOpenRouterKey,
  invalidateOpenRouterKeyCache,
  invalidateProviderOrderCache,
  LOVABLE_MODEL_CHAINS,
  normalizeOpenRouterKey,
  OPENROUTER_MODEL_CHAINS,
  OPENROUTER_SECRET_NAME,
  PROVIDER_ORDER_SETTING,
  resolveOpenRouterKey,
  resolveProviderOrder,
} from "../_shared/openrouter.ts";
import { encryptSecret } from "../_shared/crypto.ts";

const LOW_BALANCE_USD = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const hintOf = (k: string) => `${k.slice(0, 9)}…${k.slice(-4)}`;

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
    const uid = userData.user.id;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = typeof body?.action === "string" ? body.action : "status";

    if (action === "set_openrouter_key") {
      const key = normalizeOpenRouterKey(typeof body?.key === "string" ? body.key : "");
      // Only a light shape check here — the live OpenRouter probe below is the real validation.
      if (!key) return json({ error: "Paste your OpenRouter API key first." }, 400);
      if (!/^sk-or-/i.test(key)) {
        return json({ error: `That doesn't look like an OpenRouter key — they start with "sk-or-" (you pasted one starting with "${key.slice(0, 6)}…"). Create one at openrouter.ai → Keys.` }, 400);
      }
      if (key.length < 20) return json({ error: "That key looks incomplete — copy the full key from openrouter.ai → Keys." }, 400);
      const probe = await checkOpenRouterKey(key);
      if (!probe.ok) {
        return json({ error: probe.status === 401 ? "OpenRouter rejected this key (invalid or deleted). Check it and try again." : `Could not verify the key with OpenRouter (status ${probe.status || "network"}).` }, 400);
      }
      const credits = probe.credits;
      const hint = hintOf(key);
      const ciphertext = await encryptSecret(key);
      const { error: upErr } = await admin.from("app_secrets").upsert({
        name: OPENROUTER_SECRET_NAME, value_ciphertext: ciphertext, hint, set_by: uid, set_at: new Date().toISOString(),
      });
      if (upErr) return json({ error: upErr.message }, 500);
      await admin.from("app_secret_history").insert({ name: OPENROUTER_SECRET_NAME, hint, action: "set", set_by: uid });
      invalidateOpenRouterKeyCache();
      return json({ ok: true, credits, hint });
    }

    if (action === "remove_openrouter_key") {
      const { data: existing } = await admin.from("app_secrets").select("hint").eq("name", OPENROUTER_SECRET_NAME).maybeSingle();
      await admin.from("app_secrets").delete().eq("name", OPENROUTER_SECRET_NAME);
      await admin.from("app_secret_history").insert({ name: OPENROUTER_SECRET_NAME, hint: existing?.hint ?? null, action: "removed", set_by: uid });
      invalidateOpenRouterKeyCache();
      return json({ ok: true });
    }

    // status
    invalidateOpenRouterKeyCache();
    const { key, source } = await resolveOpenRouterKey();
    const provider = key ? "openrouter" : "lovable";
    const probe = key ? await checkOpenRouterKey(key) : null;
    const credits = probe?.credits ?? null;
    const keyError = probe && !probe.ok
      ? (probe.status === 401 ? "OpenRouter rejects the current key — it was likely deleted or rotated. Every teacher's AI tools are failing until a valid key is entered." : `OpenRouter could not be reached (status ${probe.status || "network"}).`)
      : null;
    const { data: stored } = await admin.from("app_secrets").select("hint, set_by, set_at").eq("name", OPENROUTER_SECRET_NAME).maybeSingle();
    const { data: history } = await admin.from("app_secret_history")
      .select("hint, action, set_by, set_at").eq("name", OPENROUTER_SECRET_NAME)
      .order("set_at", { ascending: false }).limit(5);
    const setterIds = Array.from(new Set([stored?.set_by, ...(history ?? []).map((h) => h.set_by)].filter(Boolean))) as string[];
    const names: Record<string, string> = {};
    if (setterIds.length) {
      const { data: profs } = await admin.from("profiles").select("id, display_name").in("id", setterIds);
      for (const p of profs ?? []) names[p.id] = p.display_name ?? "Admin";
    }
    return json({
      provider,
      keySource: source,
      keyHint: source === "admin" ? stored?.hint ?? null : key ? hintOf(key) : null,
      setBy: stored?.set_by ? names[stored.set_by] ?? "Admin" : null,
      setAt: source === "admin" ? stored?.set_at ?? null : null,
      keyError,
      lovableAvailable: Boolean(Deno.env.get("LOVABLE_API_KEY")),
      threshold: LOW_BALANCE_USD,
      credits,
      low: credits ? credits.remaining < LOW_BALANCE_USD : false,
      chains: provider === "openrouter" ? OPENROUTER_MODEL_CHAINS : LOVABLE_MODEL_CHAINS,
      history: (history ?? []).map((h) => ({ ...h, by: h.set_by ? names[h.set_by] ?? "Admin" : null })),
    });
  } catch (e) {
    console.error("ai-provider-admin", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
