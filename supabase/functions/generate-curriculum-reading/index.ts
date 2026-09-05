// Curriculum suite: regenerate a full textbook-style chapter for one lesson.
// Input: { subject_area, objectives, format?, ngss_standard?, standards?: string[] }
// Output: { chapter, lesson: { title, objectives[], intro[], explanation[], key_terms[], reading: { reading_title, reading_paragraphs[] } } }
import { z } from "https://esm.sh/zod@3.23.8";
import { json, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";
import { CHAPTER_RULES, CHAPTER_SCHEMA, CHAPTER_SYSTEM, chapterToLegacy, generateChapterStrict } from "../_shared/textbook-chapter.ts";

const Body = z.object({
  subject_area: z.string().min(1).max(300),
  objectives: z.string().max(4000).optional().default(""),
  format: z.string().max(40).optional().default("textbook"),
  ngss_standard: z.string().max(60).optional().nullable(),
  standards: z.array(z.string().max(400)).max(12).optional().default([]),
});

serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;
  const stds = [b.ngss_standard, ...b.standards].filter(Boolean);

  const chapter = await generateChapterStrict({
    system: CHAPTER_SYSTEM,
    user: `Write a ${b.format}-style chapter for a lesson titled "${b.subject_area}".${stds.length ? `\nAligned standards (reference their codes where relevant):\n${stds.map((x) => `- ${x}`).join("\n")}` : ""}
Lesson objectives to build on:\n${b.objectives || "(derive suitable objectives from the title)"}

${CHAPTER_RULES}

Return JSON exactly in this shape:\n${CHAPTER_SCHEMA}`,
    maxTokens: 8000,
    fallbackTitle: b.subject_area,
  });
  return json({ chapter, lesson: chapterToLegacy(chapter) });
});
