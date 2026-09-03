// Curriculum suite: generate questions, lesson plans, or readings for one standard.
// Input: { content_type, standard_code, standard_description, count, framework?, subject?, dok_level? }
// Output: { questions } | { lessons } | { readings }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";

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
const LESSON_SCHEMA = `{"lessons":[{"title":string,"duration_minutes":number,"objectives":string,"activities":[{"name":string,"duration_minutes":number,"description":string}],"materials":string,"assessment":string,"differentiation":string,"vocabulary":[{"term":string,"definition":string}],"resources":[{"title":string,"url":string,"type":string}]}]}`;
const READING_SCHEMA = `{"readings":[{"title":string,"objectives":[string],"intro":[string],"explanation":[string],"key_terms":[{"term":string,"definition":string}],"reading_title":string,"reading_paragraphs":[string]}]}`;

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
      user: `${ctx}\n\nDesign ${b.count} sequential 50-minute lesson plan(s) that build toward mastery of this standard. Each plan needs a clear objective, 3-5 timed activities with a 5E flow (engage, explore, explain, elaborate, evaluate), materials, a formative assessment, differentiation strategies, 4-6 vocabulary terms and 1-3 resources. Return JSON matching: ${LESSON_SCHEMA}`,
      maxTokens: 6000,
    });
    return json({ lessons: arr(out.lessons) });
  }
  const out = await aiJson<{ readings: unknown[] }>({
    system,
    user: `${ctx}\n\nWrite ${b.count} student-facing textbook-style reading(s) for this standard. Each has: 2-4 objectives, an "intro" of 2 short paragraphs that hooks the reader, an "explanation" of 3-5 paragraphs teaching the core ideas with concrete examples, 5-8 key terms with student-friendly definitions, and a narrative reading (reading_title + 4-6 paragraphs) that applies the concept to a real-world scenario. Plain text paragraphs, grade-appropriate. Return JSON matching: ${READING_SCHEMA}`,
    maxTokens: 6000,
  });
  return json({ readings: arr(out.readings) });
});
