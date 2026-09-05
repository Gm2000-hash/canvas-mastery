// Restructures an existing reading (legacy lesson fields or a markdown body)
// into the textbook-chapter format without losing content.
// Input: { title, lesson?: {...legacy fields}, markdown?: string, standards?: [{code, description}] , chapter_number? }
// Output: { chapter }
import { z } from "https://esm.sh/zod@3.23.8";
import { json, readBody, serve, stripHtml, HttpError } from "../_shared/curriculum-ai.ts";
import { CHAPTER_RULES, CHAPTER_SCHEMA, CHAPTER_SYSTEM, generateChapterStrict } from "../_shared/textbook-chapter.ts";

const Body = z.object({
  title: z.string().min(1).max(300),
  lesson: z.record(z.unknown()).optional(),
  markdown: z.string().max(60000).optional(),
  standards: z.array(z.object({ code: z.string().max(60), description: z.string().max(1000) })).max(20).default([]),
});

function legacyText(l: Record<string, unknown>): string {
  const j = (v: unknown) => Array.isArray(v) ? v.map((x) => typeof x === "string" ? stripHtml(x) : JSON.stringify(x)).join("\n") : "";
  return [
    `Objectives:\n${j(l.objectives)}`,
    `Key terms:\n${(Array.isArray(l.key_terms) ? l.key_terms : []).map((k: any) => `- ${k?.term}: ${stripHtml(String(k?.definition ?? ""))}`).join("\n")}`,
    `Introduction:\n${j(l.intro)}`,
    `Explanation:\n${j(l.explanation)}`,
    `Reading "${l.reading_title ?? ""}":\n${j(l.reading_paragraphs)}`,
  ].join("\n\n");
}

serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;
  const source = b.markdown?.trim() ? b.markdown : b.lesson ? legacyText(b.lesson) : "";
  if (!source.trim()) throw new HttpError(400, "Nothing to convert");

  const chapter = await generateChapterStrict({
    system: CHAPTER_SYSTEM,
    user: `Restructure the following existing reading titled "${b.title}" into a textbook chapter. Keep ALL of the original ideas, examples, vocabulary and the real-world story (reword only for flow and reading level; do not drop content), but REORGANIZE it into the required flow below: exactly 3 objectives; sections Introduction -> Historical Context (write this section if the original lacks a real, named person's story) -> Key Elements; the real-world case study; 4-12 key terms; exactly 5 reading comprehension questions. Add any missing parts (hook, Before You Read, guiding questions, callouts, figure briefs, summary) so the result is complete.
${b.standards.length ? `Aligned standards:\n${b.standards.map((s) => `- ${s.code}: ${s.description}`).join("\n")}\n` : ""}
${CHAPTER_RULES}

Return JSON exactly in this shape:\n${CHAPTER_SCHEMA}

=== ORIGINAL READING ===
${source.slice(0, 40000)}`,
    maxTokens: 8000,
    fallbackTitle: b.title,
  });
  return json({ chapter });
});
