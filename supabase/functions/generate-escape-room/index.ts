// Curriculum suite: digital escape room (Google-Form friendly). Output: EscapeRoom JSON.
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, num, readBody, serve, str, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  title: z.string().max(300).default(""),
  topic: z.string().max(1000).default(""),
  gradeLevel: z.string().max(60).default("Middle School"),
  discipline: z.string().max(100).default("Science"),
  objectives: z.string().max(4000).default(""),
  vocabulary: z.string().max(4000).default(""),
  numPuzzles: z.number().int().min(2).max(8).default(5),
  difficulty: z.string().max(30).default("medium"),
  additionalContext: z.string().max(4000).default(""),
});

serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;

  const out = await aiJson<Record<string, unknown>>({
    system: `You design immersive educational escape rooms for ${b.gradeLevel} ${b.discipline} students that run inside a Google Form with response-validated "locks". Respond with one valid JSON object only.`,
    user: `Title idea: ${b.title || b.topic}\nTopic: ${b.topic || b.title}\nObjectives: ${b.objectives || "(infer from topic)"}\nVocabulary to feature: ${b.vocabulary || "(choose key terms)"}\nDifficulty: ${b.difficulty}\nExtra context: ${b.additionalContext || "(none)"}

Create ${b.numPuzzles} sequential rooms with a continuous storyline. Vary puzzle_type across: decode, matching, diagram, vocabulary, data, riddle. Every room's answer must require content knowledge and resolve to a short lock_code (a number or single word) with a clear explanation. Provide 2-3 progressive hints and 3 plausible distractor codes per room. form_section_instructions tells the teacher exactly how to set up that section's validated short-answer question.
Return JSON: {"theme_title":string,"narrative_intro":string,"google_form_setup":string,"puzzles":[{"room_number":number,"room_name":string,"narrative_text":string,"scenario_text":string,"challenge_steps":[string],"story_transition":string,"puzzle_type":string,"question_text":string,"hints":[string],"lock_code":string,"lock_code_explanation":string,"form_section_instructions":string,"distractors":[string]}],"answer_key_summary":string,"estimated_time_minutes":number}`,
    maxTokens: 7000,
    tier: "heavy",
  });

  const puzzles = arr<Record<string, unknown>>(out.puzzles).map((p, i) => ({
    room_number: num(p.room_number, i + 1),
    room_name: str(p.room_name, `Room ${i + 1}`),
    narrative_text: str(p.narrative_text),
    scenario_text: str(p.scenario_text),
    challenge_steps: arr(p.challenge_steps).map(String),
    story_transition: str(p.story_transition),
    puzzle_type: str(p.puzzle_type, "riddle"),
    question_text: str(p.question_text),
    hints: arr(p.hints).map(String),
    lock_code: str(p.lock_code),
    lock_code_explanation: str(p.lock_code_explanation),
    form_section_instructions: str(p.form_section_instructions),
    distractors: arr(p.distractors).map(String),
  }));
  if (!puzzles.length) throw new HttpError(502, "No puzzles were generated.");

  return json({
    theme_title: str(out.theme_title, b.title || b.topic),
    narrative_intro: str(out.narrative_intro),
    google_form_setup: str(out.google_form_setup),
    puzzles,
    answer_key_summary: str(out.answer_key_summary),
    estimated_time_minutes: num(out.estimated_time_minutes, puzzles.length * 8),
  });
});
