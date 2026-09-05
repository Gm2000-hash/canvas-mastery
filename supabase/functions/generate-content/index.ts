// Curriculum suite: generate questions, lesson plans, or readings for one standard.
// Input: { content_type, standard_code, standard_description, count, framework?, subject?, dok_level? }
// Output: { questions } | { lessons } | { readings }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";
import { CHAPTER_RULES, CHAPTER_SCHEMA, CHAPTER_SYSTEM, chapterToLegacy, normalizeChapterOut } from "../_shared/textbook-chapter.ts";

const Body = z.object({
  content_type: z.enum(["questions", "lesson_plan", "reading"]),
  standard_code: z.string().min(1).max(60),
  standard_description: z.string().min(1).max(3000),
  count: z.number().int().min(1).max(12).default(3),
  framework: z.string().max(30).optional().default("NGSS"),
  subject: z.string().max(60).optional().default("Science"),
  dok_level: z.number().int().min(1).max(4).optional().nullable(),
});

const QUESTIONS_SCHEMA = `{"questions":[{"question_text":string,"question_type":"multiple_choice_question"|"true_false_question"|"multiple_answers_question"|"short_answer_question"|"essay_question","points_possible":number,"answers":[{"text":string,"weight":100|0}],"dok_level":1-4,"blooms_level":"Remember"|"Understand"|"Apply"|"Analyze"|"Evaluate"|"Create"}]}`;
const LESSON_SCHEMA = `{"lessons":[{"title":string,"duration_minutes":number,"objectives":string,"activities":[{"name":string,"duration_minutes":number,"description":string,"type":"concrete_experience"|"reflective_observation"|"abstract_conceptualization"|"active_experimentation","rationale":string}],"materials":string,"assessment":string,"differentiation":string,"rationale":{"objectives":string,"materials":string,"assessment":string,"differentiation":string},"vocabulary":[{"term":string,"definition":string}],"resources":[{"title":string,"url":string,"type":string}]}]}`;
const KOLB_GUIDE = `Design each lesson around Kolb's experiential learning cycle, with activities in this order: (1) "concrete_experience" — students do or observe something first-hand; (2) "reflective_observation" — students discuss, journal, or compare what they noticed; (3) "abstract_conceptualization" — the concept, vocabulary and models are named and explained; (4) "active_experimentation" — students apply the idea to a new problem, prediction, or design. Every activity has a "rationale": 1-2 sentences of instructional reasoning ("Why this works"). Also fill the top-level "rationale" object with a 1-2 sentence rationale for the objectives, materials, assessment, and differentiation choices.`;


serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;

  const system = `You are an expert ${b.subject} teacher and curriculum designer working with ${b.framework} standards. Respond with a single valid JSON object only — no markdown, no commentary.`;
  const ctx = `Standard ${b.standard_code}: ${b.standard_description}`;

  if (b.content_type === "questions") {
    const out = await aiJson<{ questions: unknown[] }>({
      system,
      user: `${ctx}\n\nWrite ${b.count} rigorous, standards-aligned assessment questions${b.dok_level ? ` at DOK level ${b.dok_level}` : " across DOK levels 1-3"}. Prefer multiple choice with 4 plausible answers (exactly one with weight 100, others weight 0). Include the correct answer for every question. Return JSON matching: ${QUESTIONS_SCHEMA}`,
      maxTokens: 4096,
    });
    return json({ questions: arr(out.questions) });
  }
  if (b.content_type === "lesson_plan") {
    const out = await aiJson<{ lessons: unknown[] }>({
      system,
      user: `${ctx}\n\nDesign ${b.count} sequential 50-minute lesson plan(s) that build toward mastery of this standard. Each plan needs a clear objective, 4-6 timed activities, materials, a formative assessment, differentiation strategies, 4-6 vocabulary terms and 1-3 resources. ${KOLB_GUIDE} Return JSON matching: ${LESSON_SCHEMA}`,
      maxTokens: 6000,
    });
    return json({ lessons: arr(out.lessons) });
  }
  // Readings: one textbook chapter per reading. Generated one at a time so each
  // chapter gets the full token budget; the legacy columns are derived from it.
  const readings: unknown[] = [];
  const count = Math.min(b.count, 4);
  for (let i = 0; i < count; i++) {
    const out = await aiJson<Record<string, unknown>>({
      system: CHAPTER_SYSTEM,
      user: `${ctx}\n\nWrite student-facing textbook chapter ${i + 1} of ${count} for this standard${count > 1 ? ` (each chapter covers a different facet of the standard; this one should be distinct from the others and use a different real-world case)` : ""}. Reference the standard code where relevant.\n\n${CHAPTER_RULES}\n\nReturn JSON exactly in this shape:\n${CHAPTER_SCHEMA}`,
      maxTokens: 8000,
      tier: "heavy",
    });
    const chapter = normalizeChapterOut(out, b.standard_code);
    if (!chapter.sections.length) continue;
    const legacy = chapterToLegacy(chapter);
    readings.push({ ...legacy, reading_title: legacy.reading.reading_title, reading_paragraphs: legacy.reading.reading_paragraphs, chapter });
  }
  if (!readings.length) throw new HttpError(502, "The AI returned no usable chapter. Please try again.");
  return json({ readings });
});
