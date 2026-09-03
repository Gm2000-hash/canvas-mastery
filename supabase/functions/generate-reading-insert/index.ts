// Curriculum suite: generate one discrete insert for a reading (paragraph, objective, key term, activity, video suggestion),
// or answer a free-form `prompt` about the lesson.
// Input: { kind, section?, lesson, standards[], prompt? }
// Output: { data: {...} }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, json, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  kind: z.enum(["paragraph", "objective", "key_term", "activity", "video"]),
  section: z.enum(["intro", "explanation", "reading"]).optional(),
  lesson: z.record(z.unknown()).default({}),
  standards: z.array(z.object({ code: z.string(), description: z.string() })).max(20).default([]),
  prompt: z.string().max(4000).optional(),
});

const SHAPES: Record<string, string> = {
  paragraph: `{"html":"<p>...</p>","text":"plain text of the same paragraph"}`,
  objective: `{"text":"Students will be able to ..."}`,
  key_term: `{"term":string,"definition":string}`,
  activity: `{"html":"<h4>Activity title</h4><p>instructions...</p><ol><li>step</li></ol>"}`,
  video: `{"title":string,"source":string,"rationale":string,"search_url":"https://www.youtube.com/results?search_query=...","youtube_search":"query string"}`,
};

const GUIDE: Record<string, string> = {
  paragraph: "Write ONE new paragraph (3-6 sentences) that fits naturally into the requested section and does not repeat existing text.",
  objective: "Write ONE new measurable learning objective not already present, starting with 'Students will be able to'.",
  key_term: "Suggest ONE important vocabulary term from the lesson that is not already in key_terms, with a student-friendly definition.",
  activity: "Design ONE short (10-15 minute) classroom activity or check-for-understanding tied to this reading, as clean HTML.",
  video: "Recommend ONE well-known, classroom-appropriate video (e.g. from Crash Course, TED-Ed, PBS, Khan Academy, Amoeba Sisters) that supports this lesson, with a rationale and a YouTube search URL.",
};

function lessonSummary(l: Record<string, unknown>): string {
  const j = (v: unknown, n = 2500) => JSON.stringify(v ?? "").slice(0, n);
  return [
    `Title: ${l.title ?? ""}`,
    `Objectives: ${j(l.objectives)}`,
    `Key terms: ${j(l.key_terms, 1500)}`,
    `Intro: ${j(l.intro)}`,
    `Explanation: ${j(l.explanation, 4000)}`,
    `Reading "${l.reading_title ?? ""}": ${j(l.reading_paragraphs, 4000)}`,
  ].join("\n");
}

serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;
  const stds = b.standards.map((s) => `- ${s.code}: ${s.description}`).join("\n");

  const instruction = b.prompt
    ? `Follow these instructions exactly and return the JSON object they describe:\n${b.prompt}`
    : `${GUIDE[b.kind]}${b.kind === "paragraph" && b.section ? ` Target section: ${b.section}.` : ""}\nReturn JSON exactly matching: ${SHAPES[b.kind]}`;

  const data = await aiJson<Record<string, unknown>>({
    system: "You are a middle/high-school curriculum writer. Respond with one valid JSON object only — no markdown fences, no commentary.",
    user: `Lesson context:\n${lessonSummary(b.lesson)}\n\nAligned standards:\n${stds || "(none)"}\n\n${instruction}`,
    maxTokens: 2048,
  });
  return json({ data });
});
