// Public edge function: validates an invitation code, creates the auth user,
// and atomically marks the invitation as used. Deployed with verify_jwt = false.
// The requested role (teacher | principal) and school are passed as user
// metadata; the handle_new_user trigger turns them into a teacher role or a
// pending principal request.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const code = String(body?.code ?? "").trim().toUpperCase();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const displayName = body?.displayName ? String(body.displayName).trim().slice(0, 80) : null;
  const requestedRole = String(body?.requestedRole ?? "teacher").toLowerCase() === "principal" ? "principal" : "teacher";
  const school = body?.school ? String(body.school).trim().slice(0, 120) : "";

  if (!code) return json({ error: "Invitation code is required" }, 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email" }, 400);
  if (!password || password.length < 8 || password.length > 72) {
    return json({ error: "Password must be 8–72 characters" }, 400);
  }
  if (!school) return json({ error: "School is required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Pre-check the invitation (defense in depth; redeem_invitation is the source of truth)
  const { data: inv, error: invErr } = await admin
    .from("invitations")
    .select("id, used_by, revoked, expires_at")
    .eq("code", code)
    .maybeSingle();
  if (invErr) return json({ error: "Failed to check invitation" }, 500);
  if (!inv) return json({ error: "Invalid invitation code" }, 400);
  if (inv.revoked) return json({ error: "This invitation has been revoked" }, 400);
  if (inv.used_by) return json({ error: "This invitation has already been used" }, 400);
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    return json({ error: "This invitation has expired" }, 400);
  }

  // Create the auth user (auto-confirm so they can sign in immediately)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...(displayName ? { display_name: displayName } : {}),
      requested_role: requestedRole,
      school,
    },
  });
  if (createErr || !created.user) {
    return json({ error: createErr?.message ?? "Failed to create account" }, 400);
  }
  const userId = created.user.id;

  // Atomically redeem the invitation
  const { data: redeemed, error: redeemErr } = await admin.rpc("redeem_invitation", {
    _code: code, _user_id: userId,
  });
  const result = Array.isArray(redeemed) ? redeemed[0] : redeemed;
  if (redeemErr || !result?.ok) {
    // Roll back: delete the just-created user so the code is preserved for next try
    await admin.auth.admin.deleteUser(userId);
    return json({ error: result?.error ?? redeemErr?.message ?? "Failed to redeem invitation" }, 400);
  }

  return json({ ok: true, user_id: userId, requested_role: requestedRole });
});
