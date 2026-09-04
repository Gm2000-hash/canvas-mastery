// Curriculum suite: generate one or more full lesson plans for a unit.
// Input: { unitTitle, discipline, gradeLevel, topic, numLessons, additionalContext?, focusConcepts?, deemphasizeConcepts? }
// Output: { lessons: [...] }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  unitTitle: z.string().max(300).default("Unit"),
  discipline: z.string().max(100).default("Science"),
  gradeLevel: z.string().max(60).default("Middle School"),
  topic: z.string().max(1000).default(""),
  numLessons: z.number().int().min(1).max(10).default(1),
  additionalContext: z.string().max(12000).optional(),
  focusConcepts: z.string().max(2000).optional(),
  deemphasizeConcepts: z.string().max(2000).optional(),
});

const SCHEMA = `{"lessons":[{"title":string,"duration_minutes":number,"objectives":string,"activities":[{"name":string,"duration_minutes":number,"description":string,"type":"engage"|"explore"|"explain"|"elaborate"|"evaluate"}],"materials":string,"assessment":string,"differentiation":string,"notes":string,"vocabulary":[{"term":string,"definition":string}],"resources":[{"title":string,"url":string,"type":"video"|"article"|"simulation"|"worksheet"|"other"}],"udl_supports":{"representation":[string],"action_expression":[string],"engagement":[string]},"standards":[{"code":string,"description":string}]}]}`;

serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;

  const out = await aiJson<{ lessons: unknown[] }>({
    system: `You are a master ${b.discipline} teacher and instructional coach who writes detailed, classroom-ready lesson plans for ${b.gradeLevel} students. Respond with one valid JSON object only.`,
    user: [
      `Unit: ${b.unitTitle}`,
      `Topic: ${b.topic || b.unitTitle}`,
      b.focusConcepts ? `Emphasize: ${b.focusConcepts}` : "",
      b.deemphasizeConcepts ? `De-emphasize: ${b.deemphasizeConcepts}` : "",
      b.additionalContext ? `Additional context / instructions:\n${b.additionalContext}` : "",
      "",
      `Write ${b.numLessons} sequential lesson plan(s), each ~50 minutes, that build on each other. Objectives, materials, assessment, differentiation and notes are multi-sentence plain text (use newlines between items). Activities are 4-6 timed steps following a 5E flow. Include 5-8 vocabulary terms, 2-3 real resources with plausible URLs from reputable sources (PhET, Khan Academy, PBS, NASA, etc.), UDL supports, and 1-3 aligned standards (use the standard codes given in the context when present; otherwise choose the best-fit NGSS or state standard codes).`,
      `Return JSON matching exactly: ${SCHEMA}`,
    ].filter((l) => l !== null).join("\n"),
    maxTokens: Math.min(4096 + b.numLessons * 1800, 12000),
    tier: "heavy",
  });

  const lessons = arr<Record<string, unknown>>(out.lessons).map((l) => ({
    ...l,
    standards: arr<Record<string, unknown>>(l.standards).map((s) => ({
      code: s.code ?? s.ngss_code,
      description: s.description ?? s.ngss_description,
      ngss_code: s.ngss_code ?? s.code,
      ngss_description: s.ngss_description ?? s.description,
    })),
  }));
  if (!lessons.length) throw new HttpError(502, "No lessons were generated. Please try again.");
  return json({ lessons });
});
