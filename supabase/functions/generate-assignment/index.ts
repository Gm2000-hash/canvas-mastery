// Curriculum suite: brainstorm an assignment for a lesson plan.
// mode "clarify" -> { questions: [{question, suggestions[]}] }
// mode "full"    -> { assignment: { title, assignment_type, instructions(html), points_possible, materials[], rubric[] } }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, num, readBody, serve, str, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  lessonPlanId: z.string().uuid(),
  mode: z.enum(["clarify", "full"]),
  assignmentType: z.string().max(60),
  learningGoal: z.string().max(3000).default(""),
  clarifications: z.array(z.object({ question: z.string().max(500), answer: z.string().max(1000) })).max(10).optional(),
  teacherIdea: z.string().max(3000).optional(),
});

serve(async (req, ctx) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;

  const { data: lp } = await ctx.supabase.from("lesson_plans")
    .select("title, objectives, activities, vocabulary, assessment, differentiation").eq("id", b.lessonPlanId).maybeSingle();
  if (!lp) throw new HttpError(404, "Lesson plan not found");
  const lessonCtx = `Lesson: ${lp.title}\nObjectives: ${lp.objectives}\nActivities: ${JSON.stringify(lp.activities).slice(0, 2500)}\nVocabulary: ${JSON.stringify(lp.vocabulary).slice(0, 1200)}\nAssessment: ${lp.assessment}`;

  if (b.mode === "clarify") {
    const out = await aiJson<{ questions: unknown[] }>({
      system: "You are an instructional designer helping a teacher scope an assignment. Respond with one valid JSON object only.",
      user: `${lessonCtx}\n\nAssignment type: ${b.assignmentType}\nTeacher's goal: ${b.learningGoal}\n\nAsk 2-4 short clarifying questions that would most improve the assignment (length, rigor, grouping, product format, scaffolds, etc.). For each, give 3-4 one-tap suggested answers. Return JSON: {"questions":[{"question":string,"suggestions":[string]}]}`,
      temperature: 0.5,
      maxTokens: 1200,
    });
    return json({ questions: arr(out.questions) });
  }

  const clar = (b.clarifications ?? []).map((c) => `- ${c.question} → ${c.answer}`).join("\n");
  const out = await aiJson<Record<string, unknown>>({
    system: "You are an expert teacher who writes polished, student-facing assignments. Respond with one valid JSON object only.",
    user: `${lessonCtx}\n\nAssignment type: ${b.assignmentType}\nLearning goal: ${b.teacherIdea || b.learningGoal}\nClarifications:\n${clar || "(none)"}\n\nCreate the complete assignment. "instructions" is clean HTML for students (headings, numbered steps, any prompts/questions/tables they need, success criteria). Include a 3-5 row rubric.\nReturn JSON: {"title":string,"assignment_type":string,"instructions":string,"points_possible":number,"materials":[string],"rubric":[{"criterion":string,"points":number,"levels":[{"label":string,"description":string,"points":number}]}]}`,
    maxTokens: 4096,
  });
  return json({
    assignment: {
      title: str(out.title, "Untitled assignment"),
      assignment_type: str(out.assignment_type, b.assignmentType),
      instructions: str(out.instructions),
      points_possible: num(out.points_possible, 100),
      materials: arr(out.materials).map(String),
      rubric: arr(out.rubric),
    },
  });
});
