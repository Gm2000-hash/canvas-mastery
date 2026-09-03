// Curriculum suite: quiz questions for an existing assignment (used by the Apps Script / Forms export).
// Input: { assignmentId, count }  Output: { questions: [...] } (also persisted to lesson_assignments.quiz_questions)
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, readBody, serve, stripHtml, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({ assignmentId: z.string().uuid(), count: z.number().int().min(1).max(25).default(10) });

serve(async (req, ctx) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const { assignmentId, count } = parsed.data;

  const { data: a } = await ctx.supabase.from("lesson_assignments")
    .select("id, title, assignment_type, instructions, lesson_plan_id").eq("id", assignmentId).maybeSingle();
  if (!a) throw new HttpError(404, "Assignment not found");
  const { data: lp } = await ctx.supabase.from("lesson_plans").select("title, objectives, vocabulary").eq("id", a.lesson_plan_id).maybeSingle();

  const out = await aiJson<{ questions: unknown[] }>({
    system: "You are an assessment writer. Respond with one valid JSON object only.",
    user: `Lesson: ${lp?.title ?? ""}\nObjectives: ${lp?.objectives ?? ""}\nVocabulary: ${JSON.stringify(lp?.vocabulary ?? []).slice(0, 1200)}\n\nAssignment "${a.title}" (${a.assignment_type}):\n${stripHtml(a.instructions ?? "").slice(0, 5000)}\n\nWrite ${count} quiz questions that check understanding of this assignment. Mostly multiple choice (4 options, exactly one correct), plus 1-2 short answer. Return JSON: {"questions":[{"question_text":string,"question_type":"multiple_choice_question"|"true_false_question"|"short_answer_question","points_possible":number,"answers":[{"text":string,"weight":100|0}],"dok_level":1-4,"blooms_level":string}]}`,
    maxTokens: 4096,
  });
  const questions = arr(out.questions);
  if (!questions.length) throw new HttpError(502, "No questions were generated.");

  await ctx.supabase.from("lesson_assignments").update({ quiz_questions: questions }).eq("id", assignmentId);
  return json({ questions });
});
