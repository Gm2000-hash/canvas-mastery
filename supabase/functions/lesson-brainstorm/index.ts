// Curriculum suite: streaming brainstorm chat for a lesson plan (OpenAI-style SSE deltas).
// Input: { messages: [{role, content}], lessonContext: { title, objectives, standards, duration } }
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, json, readBody, requireUser, HttpError } from "../_shared/curriculum-ai.ts";
import { aiProviderErrorMessage, fetchChatCompletion, getAiProviderConfig, isAiProviderHardError } from "../_shared/openrouter.ts";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(12000) })).min(1).max(40),
  lessonContext: z.object({
    title: z.string().max(300).default(""),
    objectives: z.string().max(4000).default(""),
    standards: z.string().max(4000).default(""),
    duration: z.number().optional().default(50),
  }).default({}),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    await requireUser(req);
    const parsed = Body.safeParse(await readBody(req));
    if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
    const { messages, lessonContext: lc } = parsed.data;

    const system = `You are a friendly, expert instructional coach brainstorming with a teacher about ONE lesson. Be concrete and practical; prefer short markdown with headers, bullets and bold — never JSON. Offer 2-4 options when asked for ideas, and tailor everything to the lesson below.

Lesson: ${lc.title}
Duration: ${lc.duration} minutes
Objectives: ${lc.objectives || "(none yet)"}
Standards: ${lc.standards || "(none yet)"}`;

    const upstream = await fetchChatCompletion({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: system }, ...messages],
      stream: true,
      temperature: 0.8,
      max_tokens: 2048,
    });
    if (!upstream.ok || !upstream.body) {
      const config = getAiProviderConfig();
      const status = upstream.status;
      console.error("brainstorm upstream", status, (await upstream.text().catch(() => "")).slice(0, 500));
      const msg = isAiProviderHardError(status) ? aiProviderErrorMessage(status, config.provider) : `AI provider error (${status}).`;
      return json({ error: msg }, isAiProviderHardError(status) ? status : 502);
    }
    // Pass the OpenAI-compatible SSE stream straight through.
    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
