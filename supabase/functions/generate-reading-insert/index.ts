// Curriculum suite: generate one discrete insert for a reading (paragraph, objective, key term, activity, video suggestion),
// or answer a free-form `prompt` about the lesson.
// Input: { kind, section?, lesson, standards[], prompt? }
// Output: { data: {...} }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, json, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  kind: z.enum(["paragraph", "objective", "key_term", "activity", "video", "section", "callout", "figure", "review_question", "summary_point", "guiding_question"]),
  section: z.string().max(200).optional(),
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
  section: `{"heading":string,"blocks":[{"type":"paragraph","text":string},{"type":"callout","kind":"stop_and_think"|"did_you_know"|"connect_it","text":string}]}`,
  callout: `{"kind":"stop_and_think"|"did_you_know"|"connect_it","text":string}`,
  figure: `{"caption":string,"description":string,"alt":string}`,
  review_question: `{"question":string,"dok":1|2|3,"answer":string}`,
  summary_point: `{"text":string}`,
  guiding_question: `{"text":string}`,
};

const GUIDE: Record<string, string> = {
  paragraph: "Write ONE new paragraph (3-6 sentences) that fits naturally into the requested section and does not repeat existing text.",
  objective: "Write ONE new measurable learning objective not already present, starting with 'Students will be able to'.",
  key_term: "Suggest ONE important vocabulary term from the lesson that is not already in key_terms, with a student-friendly definition.",
  activity: "Design ONE short (10-15 minute) classroom activity or check-for-understanding tied to this reading, as clean HTML.",
  video: "Recommend ONE well-known, classroom-appropriate video (e.g. from Crash Course, TED-Ed, PBS, Khan Academy, Amoeba Sisters) that supports this lesson, with a rationale and a YouTube search URL.",
  section: "Write ONE new textbook section that covers an idea the chapter is missing: a heading a student could turn into a question, 2-3 paragraphs (3-6 sentences each, **bold** new vocabulary) and one callout block.",
  callout: "Write ONE callout box for the requested section: 'stop_and_think' (a quick check question), 'did_you_know' (a striking accurate fact) or 'connect_it' (a link to daily life). 1-3 sentences.",
  figure: "Propose ONE figure for the requested section: a 30-60 word illustrator brief (labeled diagram or realistic scene, no text in the image), a one-sentence caption, and short alt text.",
  review_question: "Write ONE new end-of-chapter review question not already present, with its DOK level (1 recall, 2 apply/compare, 3 explain with evidence) and a short model answer.",
  summary_point: "Write ONE new one-sentence summary bullet for a main idea not yet in the summary.",
  guiding_question: "Write ONE new guiding question a student should be able to answer after reading, tied to a section heading.",
};

function lessonSummary(l: Record<string, unknown>): string {
  const j = (v: unknown, n = 2500) => JSON.stringify(v ?? "").slice(0, n);
  if (l.chapter && typeof l.chapter === "object") return `Chapter JSON (textbook format):\n${JSON.stringify(l.chapter).slice(0, 12000)}`;
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
    : `${GUIDE[b.kind]}${b.section ? ` Target section: ${b.section}.` : ""}\nWrite at a 7th-grade reading level.\nReturn JSON exactly matching: ${SHAPES[b.kind]}`;

  const data = await aiJson<Record<string, unknown>>({
    system: "You are a middle/high-school curriculum writer. Respond with one valid JSON object only — no markdown fences, no commentary.",
    user: `Lesson context:\n${lessonSummary(b.lesson)}\n\nAligned standards:\n${stds || "(none)"}\n\n${instruction}`,
    maxTokens: 2048,
  });
  return json({ data });
});
