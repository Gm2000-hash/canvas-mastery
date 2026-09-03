// Curriculum suite: regenerate a full textbook-style reading for one lesson.
// Input: { subject_area, objectives, format?, ngss_standard? }
// Output: { lesson: { title, objectives[], intro[], explanation[], key_terms[], reading: { reading_title, reading_paragraphs[] } } }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, readBody, serve, str, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  subject_area: z.string().min(1).max(300),
  objectives: z.string().max(4000).optional().default(""),
  format: z.string().max(40).optional().default("textbook"),
  ngss_standard: z.string().max(60).optional().nullable(),
});

serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;

  const out = await aiJson<Record<string, unknown>>({
    system: "You are an expert science and humanities textbook author for grades 6-12. Write clear, engaging, accurate student-facing text. Respond with one valid JSON object only.",
    user: `Write a ${b.format}-style reading for a lesson titled "${b.subject_area}".${b.ngss_standard ? ` Aligned standard: ${b.ngss_standard}.` : ""}
Lesson objectives:\n${b.objectives || "(derive suitable objectives from the title)"}

Return JSON exactly in this shape:
{"title":string,"objectives":[string],"intro":[string],"explanation":[string],"key_terms":[{"term":string,"definition":string}],"reading":{"reading_title":string,"reading_paragraphs":[string]}}
Requirements: 2-4 objectives; intro = 2 paragraphs that hook the reader with a phenomenon or question; explanation = 4-6 paragraphs that teach the concept with examples and connect back to the objectives; 6-8 key terms; the reading is a 5-7 paragraph narrative or case study applying the concept. Plain text paragraphs (no HTML).`,
    maxTokens: 6000,
  });

  const reading = (out.reading ?? {}) as Record<string, unknown>;
  return json({
    lesson: {
      title: str(out.title, b.subject_area),
      objectives: arr(out.objectives),
      intro: arr(out.intro),
      explanation: arr(out.explanation),
      key_terms: arr(out.key_terms),
      reading: {
        reading_title: str(reading.reading_title ?? out.reading_title),
        reading_paragraphs: arr(reading.reading_paragraphs ?? out.reading_paragraphs),
      },
    },
  });
});
