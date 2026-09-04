// Assigns Webb's Depth of Knowledge levels to library items (readings,
// activities, lesson plans). A single item can span several levels.
//
// Input:  { item_ids?: uuid[], all?: boolean }
//   - item_ids: tag exactly these items (re-tags even if already tagged)
//   - all:      tag up to MAX_PER_CALL of the caller's items that have no DOK yet
// Output: { processed, tagged, remaining }
//   Clients loop on `all: true` until `remaining` is 0.
import { z } from "https://esm.sh/zod@3.23.8";
import { json, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";
import { fetchChatCompletion, aiProviderErrorMessage, getAiProviderConfig, isAiProviderHardError } from "../_shared/openrouter.ts";
import { stripHtmlForTagger } from "../_shared/questionTagger.ts";

const Body = z.object({
  item_ids: z.array(z.string().uuid()).max(200).optional(),
  all: z.boolean().optional(),
});

const MAX_PER_CALL = 40;
const BATCH = 8;

type Item = { id: string; kind: string; title: string; body: string | null; file_name: string | null; grade: string | null; subject: string | null };

const SYSTEM = `You are a curriculum specialist fluent in Webb's Depth of Knowledge (DOK). For each classroom resource you are given, decide which DOK levels the students are asked to work at:
1 = Recall & reproduction (define, identify, list, recall facts, follow a simple procedure)
2 = Skills & concepts (classify, compare, summarize, interpret data, apply a concept)
3 = Strategic thinking (justify with evidence, analyze, draw conclusions, explain phenomena, multi-step reasoning)
4 = Extended thinking (design an investigation, synthesize across sources, sustained projects)

Readings are usually DOK 1-2 (plus 3 if the comprehension questions demand analysis). Labs and stations are often 2-3. Full lesson plans frequently span 1-3. Only include 4 for genuine extended projects. Return every level that is substantially present (1-3 levels), with the primary level first.`;

serve(async (req, ctx) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const { item_ids, all } = parsed.data;
  if (!item_ids?.length && !all) throw new HttpError(400, "Provide item_ids or all: true");

  let q = ctx.admin.from("library_items")
    .select("id, kind, title, body, file_name, grade, subject")
    .eq("teacher_id", ctx.userId)
    .order("updated_at", { ascending: false });
  q = item_ids?.length ? q.in("id", item_ids) : q.eq("dok_levels", "{}").limit(MAX_PER_CALL);
  const { data: items, error } = await q;
  if (error) throw new HttpError(500, error.message);
  const list = (items ?? []) as Item[];

  let tagged = 0;
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH);
    const text = slice.map((it, idx) => {
      const body = stripHtmlForTagger(it.body ?? "").slice(0, 2500);
      const meta = [it.kind.replace("_", " "), it.subject, it.grade ? `grade ${it.grade}` : null].filter(Boolean).join(", ");
      return `Item ${idx} (${meta}) — Title: ${it.title}${it.file_name ? ` — File: ${it.file_name}` : ""}\n${body || "(no text content — judge from the title and type)"}`;
    }).join("\n\n---\n\n");

    const res = await fetchChatCompletion({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `Assign DOK levels:\n\n${text}` }],
      tools: [{
        type: "function",
        function: {
          name: "assign_dok",
          description: "Assign DOK levels to each item.",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "integer", description: "Item index in this batch (0..N-1)." },
                    dok_levels: { type: "array", items: { type: "integer", minimum: 1, maximum: 4 }, minItems: 1, maxItems: 3, description: "DOK levels present, primary first." },
                  },
                  required: ["index", "dok_levels"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "assign_dok" } },
      temperature: 0.2,
    }, { tier: "bulk" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("tag-library-dok provider error", res.status, t.slice(0, 300));
      if (isAiProviderHardError(res.status)) {
        throw new HttpError(res.status, aiProviderErrorMessage(res.status, (await getAiProviderConfig()).provider, t));
      }
      continue; // transient — skip this batch, client will retry on the next loop
    }
    const data = await res.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let out: { index: number; dok_levels: number[] }[] = [];
    try { out = JSON.parse(args ?? "{}").items ?? []; } catch (e) { console.error("parse", e); }

    for (const o of out) {
      const it = slice[o.index];
      if (!it) continue;
      const levels = Array.from(new Set((o.dok_levels ?? []).map((n) => Math.round(Number(n))).filter((n) => n >= 1 && n <= 4))).slice(0, 3);
      if (!levels.length) continue;
      const { error: uErr } = await ctx.admin.from("library_items").update({ dok_levels: levels }).eq("id", it.id).eq("teacher_id", ctx.userId);
      if (uErr) console.error("update", uErr); else tagged++;
    }
  }

  let remaining = 0;
  if (all) {
    const { count } = await ctx.admin.from("library_items").select("id", { count: "exact", head: true })
      .eq("teacher_id", ctx.userId).eq("dok_levels", "{}");
    remaining = count ?? 0;
  }
  return json({ processed: list.length, tagged, remaining });
});
