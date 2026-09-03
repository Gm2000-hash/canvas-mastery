// Curriculum suite: study guide, flashcards and review lesson for an exam; persisted to exam_review_materials.
// Input: { exam_id }  Output: { ok: true, id }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, readBody, serve, str, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({ exam_id: z.string().uuid() });

serve(async (req, ctx) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const { exam_id } = parsed.data;

  const { data: exam } = await ctx.supabase.from("isat_exams").select("id, title, grade_level, questions").eq("id", exam_id).maybeSingle();
  if (!exam) throw new HttpError(404, "Exam not found");
  const qs = arr<Record<string, unknown>>(exam.questions);
  const standards = [...new Map(qs.map((q) => [q.standard_code, q.standard_description])).entries()]
    .map(([c, d]) => `${c}: ${d ?? ""}`).join("\n");
  const sample = qs.slice(0, 40).map((q, i) => `${i + 1}. [${q.standard_code}] ${str(q.question_text).slice(0, 220)}`).join("\n");

  const out = await aiJson<Record<string, unknown>>({
    system: `You create student review materials for a ${exam.grade_level} grade science exam. Respond with one valid JSON object only.`,
    user: `Exam: ${exam.title}\nStandards covered:\n${standards}\n\nSample of exam items (do NOT copy them):\n${sample}

Produce: (1) a study guide with one section per standard (title, 2-3 paragraph content, 4-6 key_points); (2) 15-25 flashcards (term, definition, short example); (3) a 50-minute review lesson.
Return JSON: {"study_guide":[{"title":string,"content":string,"key_points":[string]}],"flashcards":[{"term":string,"definition":string,"example":string}],"review_lesson":{"title":string,"objectives":[string],"introduction":string,"sections":[{"title":string,"content":string}],"summary":string,"practice_questions":[{"question":string,"answer":string}]}}`,
    maxTokens: 8000,
  });

  const row = {
    exam_id,
    user_id: ctx.userId,
    study_guide: arr(out.study_guide),
    flashcards: arr(out.flashcards),
    review_lesson: (out.review_lesson ?? {}) as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await ctx.supabase.from("exam_review_materials").select("id").eq("exam_id", exam_id).maybeSingle();
  const q = existing
    ? ctx.supabase.from("exam_review_materials").update(row).eq("id", existing.id).select("id").single()
    : ctx.supabase.from("exam_review_materials").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) throw new HttpError(500, error.message);
  return json({ ok: true, id: data.id });
});
