// Stores a teacher's Canvas API token + base URL.
// The token is never returned to the browser after this.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeBaseUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  return url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const baseUrlRaw = String(body?.base_url ?? "");
    const apiToken = String(body?.api_token ?? "");

    if (!baseUrlRaw || !apiToken) {
      return new Response(JSON.stringify({ error: "base_url and api_token are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (apiToken.length < 20 || apiToken.length > 4096) {
      return new Response(JSON.stringify({ error: "Token looks invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = normalizeBaseUrl(baseUrlRaw);

    // Verify token with Canvas
    const verify = await fetch(`${baseUrl}/api/v1/users/self`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (!verify.ok) {
      const t = await verify.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Canvas rejected the token (${verify.status}). Check the URL and token. ${t.slice(0, 200)}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const me = await verify.json();

    // Upsert via service role (table is RLS-locked for SELECT)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: upErr } = await admin.from("canvas_credentials").upsert({
      teacher_id: userId,
      base_url: baseUrl,
      api_token: apiToken,
    });
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({ success: true, canvas_user: { id: me.id, name: me.name, login_id: me.login_id } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("canvas-save-token error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
