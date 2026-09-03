// Per-question AI standards tagging (interactive, one assignment).
// Input: { assignment_id, question_ids? }
// Core logic lives in ../_shared/questionTagger.ts and is shared with tag-queue-worker.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiProviderErrorMessage, getAiProviderConfig } from "../_shared/openrouter.ts";
import { TaggerConfigError, TaggerProviderError, tagQuestionsForAssignment } from "../_shared/questionTagger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { provider } = getAiProviderConfig();

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const teacherId = userData.user.id;

    const { assignment_id, question_ids } = await req.json();
    if (!assignment_id || typeof assignment_id !== "string") return json({ error: "assignment_id is required" }, 400);
    const onlyIds: string[] | null = Array.isArray(question_ids) && question_ids.length
      ? question_ids.filter((x: unknown) => typeof x === "string").slice(0, 500)
      : null;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      const result = await tagQuestionsForAssignment(admin, teacherId, assignment_id, { questionIds: onlyIds });
      return json({ success: true, ...result });
    } catch (e) {
      if (e instanceof TaggerConfigError) {
        return json({ error: e.message }, e.message === "Forbidden" ? 403 : 400);
      }
      if (e instanceof TaggerProviderError) {
        return json({ error: aiProviderErrorMessage(e.status, provider) }, e.status);
      }
      throw e;
    }
  } catch (e) {
    console.error("tag-question-standards error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
