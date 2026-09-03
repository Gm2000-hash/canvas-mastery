// Shared standards-tagging logic used by standards-tagger and ngss-tagger.
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, str, type AuthedContext } from "./curriculum-ai.ts";

export const Body = z.object({
  questions: z.array(z.object({ id: z.union([z.number(), z.string()]), question_text: z.string().max(6000) })).min(1).max(25),
  framework: z.string().max(20).default("ngss"),
  subject: z.string().max(60).optional(),
  grade: z.string().max(20).optional(),
  keyTermsMap: z.record(z.array(z.string())).optional(),
  standardsList: z.array(z.object({ code: z.string(), description: z.string() })).max(600).optional(),
});

type Cand = { code: string; description: string };

async function candidates(ctx: AuthedContext, b: z.infer<typeof Body>): Promise<Cand[]> {
  if (b.standardsList?.length) return b.standardsList;
  const isNgss = b.framework.toLowerCase() === "ngss";
  let q = ctx.supabase.from("standards").select("code, description, framework, subject, grade");
  if (isNgss) q = q.ilike("framework", "ngss");
  else {
    q = q.not("framework", "ilike", "ngss");
    if (b.subject) q = q.ilike("subject", b.subject);
  }
  const { data } = await q.limit(1000);
  const byCode = new Map<string, Cand>();
  for (const s of data ?? []) if (!byCode.has(s.code)) byCode.set(s.code, { code: s.code, description: s.description });
  for (const code of Object.keys(b.keyTermsMap ?? {})) {
    if (!byCode.has(code)) byCode.set(code, { code, description: `(key terms: ${b.keyTermsMap![code].slice(0, 12).join(", ")})` });
  }
  return [...byCode.values()];
}

export async function tag(ctx: AuthedContext, b: z.infer<typeof Body>) {
  const cands = await candidates(ctx, b);
  const candBlock = cands.length
    ? `CANDIDATE STANDARDS (choose only from these codes):\n${cands.map((c) => `${c.code} — ${c.description.slice(0, 220)}`).join("\n")}`
    : `No candidate list is available; use official ${b.framework.toUpperCase()} performance-expectation codes${b.subject ? ` for ${b.subject}` : ""}${b.grade ? ` grade ${b.grade}` : ""} from your knowledge.`;
  const items = b.questions.map((q) => `[${q.id}] ${q.question_text.replace(/\s+/g, " ").slice(0, 1200)}`).join("\n\n");

  const out = await aiJson<{ tags: unknown[] }>({
    system: "You are a standards-alignment specialist. Tag each item with the 1-3 standards it most directly assesses or teaches. Be conservative: only tag when the alignment is clear. Respond with one valid JSON object only.",
    user: `${candBlock}\n\nITEMS:\n${items}\n\nReturn JSON: {"tags":[{"id":<item id exactly as given>,"standards":[{"code":string,"description":string,"matched_terms":[string]}]}]} — include every item id, with an empty standards array if nothing fits. matched_terms = 1-4 words from the item text that drove the match.`,
    temperature: 0.2,
    maxTokens: 4096,
  });

  const descByCode = new Map(cands.map((c) => [c.code.toLowerCase(), c]));
  const byId = new Map<string, unknown[]>();
  for (const t of arr<Record<string, unknown>>(out.tags)) {
    const stds = arr<Record<string, unknown>>(t.standards).map((s) => {
      const code = str(s.code).trim();
      const c = descByCode.get(code.toLowerCase());
      if (cands.length && !c) return null; // hallucinated code → drop
      return { code: c?.code ?? code, description: c?.description ?? str(s.description), matched_terms: arr(s.matched_terms).map(String) };
    }).filter(Boolean);
    byId.set(String(t.id), stds);
  }
  return b.questions.map((q) => ({ id: q.id, question_id: q.id, standards: byId.get(String(q.id)) ?? [] }));
}

