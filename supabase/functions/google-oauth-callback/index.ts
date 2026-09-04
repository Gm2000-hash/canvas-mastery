// Google redirects the browser here after consent. Exchanges the code, stores
// the encrypted refresh token, then sends the teacher back to the app.
import { adminClient, encryptSecret, exchangeCode, GoogleError, verifyState } from "../_shared/googleAuth.ts";

function back(rt: string, params: Record<string, string>) {
  const u = new URL(rt);
  u.hash = "";
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.hash = "google";
  return Response.redirect(u.toString(), 302);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const stateRaw = url.searchParams.get("state") ?? "";
  let rt = "";
  try {
    const state = await verifyState(stateRaw);
    rt = String(state.rt ?? "");
    const teacherId = String(state.uid ?? "");
    if (!rt || !teacherId) throw new GoogleError("Bad state", "BAD_STATE");

    const gErr = url.searchParams.get("error");
    if (gErr) return back(rt, { google: "error", message: gErr === "access_denied" ? "You cancelled the Google sign-in." : gErr });
    const code = url.searchParams.get("code");
    if (!code) return back(rt, { google: "error", message: "Google did not return a code." });

    const tok = await exchangeCode(code);
    const admin = adminClient();

    // Google only returns a refresh token on the first consent (we force prompt=consent, but be safe).
    let refresh = tok.refresh_token ?? null;
    if (!refresh) {
      const { data } = await admin.from("google_credentials").select("refresh_token_ciphertext").eq("teacher_id", teacherId).maybeSingle();
      if (!data) return back(rt, { google: "error", message: "Google didn't grant offline access. Remove the app at myaccount.google.com/permissions and connect again." });
      refresh = null;
    }

    let email: string | null = null;
    try {
      const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
      email = me?.email ?? null;
    } catch { /* cosmetic */ }

    const scopes = (tok.scope ?? "").split(" ").filter(Boolean);
    const row: Record<string, unknown> = { teacher_id: teacherId, email, scopes, updated_at: new Date().toISOString() };
    if (refresh) row.refresh_token_ciphertext = await encryptSecret(refresh);
    const { error } = refresh
      ? await admin.from("google_credentials").upsert(row, { onConflict: "teacher_id" })
      : await admin.from("google_credentials").update(row).eq("teacher_id", teacherId);
    if (error) throw error;

    return back(rt, { google: "connected" });
  } catch (e) {
    console.error("google-oauth-callback", e);
    const msg = e instanceof Error ? e.message : "Google sign-in failed";
    if (rt) return back(rt, { google: "error", message: msg });
    return new Response(`Google sign-in failed: ${msg}`, { status: 400 });
  }
});
