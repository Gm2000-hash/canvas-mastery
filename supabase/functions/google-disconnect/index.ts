// Revokes the teacher's Google refresh token and forgets the connection.
import { corsHeaders, decryptSecret, errorResponse, json, requireUser, revokeToken } from "../_shared/googleAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { teacherId, admin } = await requireUser(req);
    const { data } = await admin.from("google_credentials").select("refresh_token_ciphertext").eq("teacher_id", teacherId).maybeSingle();
    if (data) {
      try { await revokeToken(await decryptSecret(data.refresh_token_ciphertext)); } catch { /* best effort */ }
      await admin.from("google_credentials").delete().eq("teacher_id", teacherId);
    }
    return json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
});
