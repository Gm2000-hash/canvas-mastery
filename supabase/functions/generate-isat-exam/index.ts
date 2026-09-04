// Curriculum suite: ISAT-style practice exam. Input: { question_count, title?, selected_standards[] } Output: { questions }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, num, readBody, serve, str, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  question_count: z.number().int().min(3).max(60).default(30),
  title: z.string().max(300).optional(),
  selected_standards: z.array(z.object({ code: z.string().max(60), description: z.string().max(3000) })).min(1).max(30),
});

const TYPES = ["multiple_choice_question", "multiple_answers_question", "data_analysis_question", "scenario_question", "constructed_response_question", "investigation_design_question"];

serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;
  const stds = b.selected_standards.map((s) => `${s.code}: ${s.description}`).join("\n");

  // Generate in batches of 10 to keep each response well-formed.
  const questions: Record<string, unknown>[] = [];
  const perStd = Math.ceil(b.question_count / b.selected_standards.length);
  while (questions.length < b.question_count) {
    const n = Math.min(6, b.question_count - questions.length);
    const out = await aiJson<{ questions: unknown[] }>({
      system: "You write Idaho ISAT-style science assessment items: phenomenon-based, with realistic data tables and scenarios, aligned to three-dimensional standards. Respond with one valid JSON object only.",
      user: `Standards (spread coverage roughly ${perStd} per standard; already written: ${questions.length} of ${b.question_count}):\n${stds}\n\nWrite ${n} NEW items numbered ${questions.length + 1}-${questions.length + n}, mixing types from: ${TYPES.join(", ")}. Mostly DOK 2-3. For choice types provide 4 answers as [{"text","weight"}] with exactly one weight 100 (multiple_answers: 2 correct of 5). For constructed_response provide answers = [{"text":"<model answer / scoring notes>","weight":100}]. Data-analysis items must embed the data table in question_text as plain text. Each item gets a 1-sentence hint that nudges without giving the answer.
Return JSON: {"questions":[{"question_number":number,"question_type":string,"question_text":string,"standard_code":string,"standard_description":string,"points_possible":number,"dok_level":1-4,"blooms_level":string,"hint":string,"answers":[{"text":string,"weight":number}]}]}`,
      maxTokens: 6000,
      tier: "heavy",
    });
    const batch = arr<Record<string, unknown>>(out.questions);
    if (!batch.length) break;
    for (const q of batch) {
      if (questions.length >= b.question_count) break;
      questions.push({
        question_number: questions.length + 1,
        question_type: TYPES.includes(str(q.question_type)) ? q.question_type : "multiple_choice_question",
        question_text: str(q.question_text),
        standard_code: str(q.standard_code, b.selected_standards[0].code),
        standard_description: str(q.standard_description),
        points_possible: num(q.points_possible, 1),
        dok_level: num(q.dok_level, 2),
        blooms_level: str(q.blooms_level, "Analyze"),
        hint: str(q.hint),
        answers: arr(q.answers),
      });
    }
  }
  if (!questions.length) throw new HttpError(502, "No questions were generated.");
  return json({ questions, title: b.title });
});
