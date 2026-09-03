// Curriculum suite: key vocabulary per standard.
// Input: { standards: [{code, description}] }  Output: { results: [{code, key_terms[]}] }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  standards: z.array(z.object({ code: z.string().max(60), description: z.string().max(3000) })).min(1).max(40),
});

serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const { standards } = parsed.data;

  const results: Array<{ code: string; key_terms: string[] }> = [];
  // Batches of 10 keep each response small and reliable.
  for (let i = 0; i < standards.length; i += 10) {
    const batch = standards.slice(i, i + 10);
    const out = await aiJson<{ results: Array<{ code: string; key_terms: string[] }> }>({
      system: "You are a curriculum specialist. Respond with one valid JSON object only.",
      user: `For each standard below, list 8-15 key vocabulary terms and concepts a student must know to master it (lowercase, 1-3 words each, no duplicates).\n\n${
        batch.map((s) => `${s.code}: ${s.description}`).join("\n")
      }\n\nReturn JSON: {"results":[{"code":string,"key_terms":[string]}]} — include every code exactly as given.`,
      temperature: 0.3,
      maxTokens: 3000,
    });
    for (const r of arr<{ code: string; key_terms: unknown }>(out.results)) {
      results.push({ code: String(r.code), key_terms: arr<string>(r.key_terms).map(String) });
    }
  }
  return json({ results });
});
