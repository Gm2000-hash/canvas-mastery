// Builds the Google consent URL for the signed-in teacher.
// Input: { return_to: string }  Output: { url }
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, env, errorResponse, GOOGLE_SCOPES, json, redirectUri, requireUser, signState } from "../_shared/googleAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { teacherId } = await requireUser(req);
    const parsed = z.object({ return_to: z.string().url().max(500) }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "return_to must be a URL" }, 400);
    const rt = new URL(parsed.data.return_to);
    if (!(rt.protocol === "https:" || rt.hostname === "localhost")) return json({ error: "Invalid return URL" }, 400);

    const state = await signState({ uid: teacherId, rt: rt.toString() });
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", env("GOOGLE_OAUTH_CLIENT_ID"));
    u.searchParams.set("redirect_uri", redirectUri());
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    u.searchParams.set("include_granted_scopes", "true");
    u.searchParams.set("state", state);
    return json({ url: u.toString() });
  } catch (e) {
    return errorResponse(e);
  }
});
