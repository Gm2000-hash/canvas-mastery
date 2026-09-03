// Curriculum suite: DOK / Bloom's rewrites for a question.
// Output: { dok_suggestions: [...4], blooms_suggestions: [...6] }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, num, readBody, serve, str, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  question_text: z.string().max(4000),
  question_type: z.string().max(60).default("multiple_choice_question"),
  current_dok: z.number().int().min(1).max(4).nullable().optional(),
  current_blooms: z.string().max(30).nullable().optional(),
  answers: z.unknown().optional(),
});

const DOK_NAMES = ["Recall", "Skill/Concept", "Strategic Thinking", "Extended Thinking"];
const BLOOMS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;

  const out = await aiJson<Record<string, unknown>>({
    system: "You are an assessment-design coach fluent in Webb's Depth of Knowledge and Bloom's Taxonomy. Respond with one valid JSON object only.",
    user: `Question type: ${b.question_type}\nQuestion: ${b.question_text}\nCurrent answers JSON: ${JSON.stringify(b.answers ?? null).slice(0, 3000)}\nCurrent DOK: ${b.current_dok ?? "unknown"}; current Bloom's: ${b.current_blooms ?? "unknown"}

Produce a rewrite of this question at EVERY DOK level (1-4) and EVERY Bloom's level (${BLOOMS.join(", ")}). Keep the same topic and question type. "rewritten_answers" must use the SAME JSON shape as the current answers (for multiple choice: [{"text":string,"weight":100|0}] with exactly one 100). Each explanation is 1-2 sentences on why it sits at that level.
Return JSON: {"dok_suggestions":[{"level":1-4,"level_name":string,"explanation":string,"rewritten_question":string,"rewritten_answers":any}],"blooms_suggestions":[{"level":"Remember"|...,"explanation":string,"rewritten_question":string,"rewritten_answers":any}]}`,
    maxTokens: 6000,
  });

  const dok = arr<Record<string, unknown>>(out.dok_suggestions).map((s) => {
    const level = num(s.level, 1);
    return {
      level,
      level_name: str(s.level_name, DOK_NAMES[level - 1] ?? ""),
      explanation: str(s.explanation),
      rewritten_question: str(s.rewritten_question),
      rewritten_answers: s.rewritten_answers,
      is_current: level === (b.current_dok ?? -1),
    };
  });
  const blooms = arr<Record<string, unknown>>(out.blooms_suggestions).map((s) => ({
    level: str(s.level),
    explanation: str(s.explanation),
    rewritten_question: str(s.rewritten_question),
    rewritten_answers: s.rewritten_answers,
    is_current: str(s.level).toLowerCase() === (b.current_blooms ?? "").toLowerCase(),
  }));
  return json({ dok_suggestions: dok, blooms_suggestions: blooms });
});
