// Textbook-chapter prompt contract shared by every reading generator.
// Mirrors src/modules/curriculum/lib/textbook-chapter.ts (keep the shapes in sync).

export const CHAPTER_SCHEMA = `{
 "title": string,
 "hook": string,
 "before_you_read": {"preview": string, "prior_knowledge_prompt": string, "guiding_questions": [string]},
 "objectives": [string],
 "sections": [{"role":"introduction"|"historical_context"|"key_elements","heading": string, "blocks": [
    {"type":"paragraph","text":string} |
    {"type":"callout","kind":"stop_and_think"|"did_you_know"|"connect_it","text":string} |
    {"type":"figure","caption":string,"description":string,"alt":string}
 ]}],
 "real_world": {"title": string, "paragraphs": [string]},
 "summary": [string],
 "review_questions": [{"question": string, "dok": 1|2|3, "answer": string}],
 "glossary": [{"term": string, "definition": string}]
}`;

export const CHAPTER_RULES = `Write it as ONE textbook chapter. EVERY reading, in EVERY content area, follows this exact flow, in this order:
1. Chapter opener: "title"; "hook" = one paragraph that opens with a phenomenon, surprising fact or question. "before_you_read": "preview" = 2-3 sentences previewing what the chapter covers; "prior_knowledge_prompt" = one prompt asking what students already know; "guiding_questions" = 3 questions, one per main section, that the section answers.
2. "objectives": EXACTLY 3 measurable learning objectives ("Students will be able to …").
3. "sections" — exactly these, in this order (set "role" on each):
   - role "introduction", heading "Introduction": what the concept is, why it matters, and where students meet it (2-3 paragraphs).
   - role "historical_context", heading "Historical Context: <person's name>": the story of ONE real, named person tied to the idea — a scientist, inventor, ruler, political figure, author, artist, explorer, etc. Who they were, when and where they lived (real dates/places), what they did, what problem they faced, and how their work shaped this concept. 3-4 narrative paragraphs. Never invent a person or event.
   - role "key_elements", heading "Key Elements of <topic>": the parts, steps or processes of the topic explained in order (3-5 paragraphs; use numbered steps in prose where there is a sequence). For a long topic you may split this into TWO consecutive "key_elements" sections with distinct headings.
   Each paragraph block is 3-6 sentences; bold key vocabulary on first use with **term**. Each section has exactly one "callout" block placed after a relevant paragraph — rotate kinds: "stop_and_think" (a quick check question), "did_you_know" (a striking fact), "connect_it" (a link to daily life or another subject). Include 1-2 "figure" blocks in the whole chapter: "description" is a 30-60 word brief for an illustrator (labeled diagram or realistic scene, no text in image), "caption" is one sentence explaining what the figure shows, "alt" is short alt text.
4. "real_world": an "In the Real World" case study — a real documented event, place, or organization (real names, dates) that shows the concept in action, 4-6 paragraphs, ending with 1-2 sentences tying it back to the main idea. It must be different from the historical-context story. Never invent an event; if you cannot name a real one, label it clearly as a realistic case study.
5. "summary": 4-6 one-sentence bullet points, one per main idea, in order.
6. "glossary" (shown to students as "Key Terms"): 4-12 terms — every bolded term — each with a plain-language explanation a 7th grader understands.
7. "review_questions" (shown as "Reading Comprehension Questions"): EXACTLY 5 questions — two at DOK 1 (recall), two at DOK 2 (apply/compare/explain), one at DOK 3 (reason with evidence from the reading) — each with a short model "answer".
Reading level: 7th grade (Flesch-Kincaid ~7) — short sentences, familiar words, technical terms defined in plain language on first use. Plain text (no HTML) except **bold** for vocabulary. Respond with one valid JSON object only.`;

export const CHAPTER_SYSTEM = "You are an expert textbook author for grades 6-12 who writes clear, accurate, engaging student-facing chapters. Respond with one valid JSON object only — no markdown fences, no commentary.";

/* Minimal normalizer used server-side (the client re-normalizes on load). */
const s = (v: unknown, d = ""): string => (typeof v === "string" ? v : v == null ? d : String(v));
const sa = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => s(x)).filter((x) => x.trim()) : []);

export function normalizeChapterOut(raw: unknown, fallbackTitle: string) {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const byr = r.before_you_read ?? {};
  const rw = r.real_world ?? {};
  return {
    version: 1,
    number: null,
    title: s(r.title, fallbackTitle),
    hook: s(r.hook),
    before_you_read: { preview: s(byr.preview), prior_knowledge_prompt: s(byr.prior_knowledge_prompt), guiding_questions: sa(byr.guiding_questions) },
    objectives: sa(r.objectives),
    sections: (Array.isArray(r.sections) ? r.sections : []).map((sec: any, i: number) => ({
      number: String(i + 1),
      role: ["introduction", "historical_context", "key_elements"].includes(sec?.role) ? sec.role : (i === 0 ? "introduction" : i === 1 ? "historical_context" : "key_elements"),
      heading: s(sec?.heading, `Section ${i + 1}`),
      blocks: (Array.isArray(sec?.blocks) ? sec.blocks : []).map((b: any) => {
        if (typeof b === "string") return { type: "paragraph", text: b };
        if (b?.type === "callout") return { type: "callout", kind: ["stop_and_think", "did_you_know", "connect_it"].includes(b.kind) ? b.kind : "stop_and_think", text: s(b.text) };
        if (b?.type === "figure") return { type: "figure", caption: s(b.caption), description: s(b.description), alt: s(b.alt), image_url: null };
        return { type: "paragraph", text: s(b?.text) };
      }).filter((b: any) => b.type !== "paragraph" || b.text.trim()),
    })),
    real_world: { title: s(rw.title ?? r.reading_title), paragraphs: sa(rw.paragraphs ?? r.reading_paragraphs) },
    summary: sa(r.summary),
    review_questions: (Array.isArray(r.review_questions) ? r.review_questions : []).map((q: any) => ({
      question: s(q?.question), dok: Math.min(4, Math.max(1, Number(q?.dok) || 1)), answer: s(q?.answer),
    })).filter((q: any) => q.question),
    glossary: (Array.isArray(r.glossary) ? r.glossary : []).map((g: any) => ({ term: s(g?.term), definition: s(g?.definition) })).filter((g: any) => g.term),
    standards: sa(r.standards),
  };
}
export type ChapterOut = ReturnType<typeof normalizeChapterOut>;

/** Legacy lesson columns derived from a chapter (keeps older screens working). */
export function chapterToLegacy(ch: ChapterOut) {
  const paras = (secs: any[]) => secs.flatMap((sec) => sec.blocks.filter((b: any) => b.type === "paragraph").map((b: any) => b.text));
  const [first, ...rest] = ch.sections;
  return {
    title: ch.title,
    objectives: ch.objectives,
    intro: [ch.hook, ...(first ? paras([first]) : [])].filter(Boolean),
    explanation: paras(rest),
    key_terms: ch.glossary,
    reading: { reading_title: ch.real_world.title, reading_paragraphs: ch.real_world.paragraphs },
  };
}

export function chapterToMarkdown(ch: ChapterOut): string {
  const out: string[] = [`# ${ch.title}`];
  if (ch.hook) out.push(ch.hook);
  if (ch.before_you_read.preview || ch.before_you_read.guiding_questions.length) {
    out.push("## Before You Read");
    if (ch.before_you_read.preview) out.push(ch.before_you_read.preview);
    if (ch.before_you_read.prior_knowledge_prompt) out.push(`> **Think first:** ${ch.before_you_read.prior_knowledge_prompt}`);
    if (ch.before_you_read.guiding_questions.length) out.push("**Guiding questions**\n" + ch.before_you_read.guiding_questions.map((q) => `- ${q}`).join("\n"));
  }
  if (ch.objectives.length) out.push("## Learning Objectives\n" + ch.objectives.map((o) => `- ${o}`).join("\n"));
  const label: Record<string, string> = { stop_and_think: "Stop and Think", did_you_know: "Did You Know?", connect_it: "Connect It" };
  for (const sec of ch.sections) {
    out.push(`## ${sec.number} ${sec.heading}`);
    for (const b of sec.blocks) {
      if (b.type === "paragraph") out.push(b.text);
      else if (b.type === "callout") out.push(`> **${label[b.kind]}:** ${b.text}`);
      else out.push(`_${b.caption}_ (${b.description})`);
    }
  }
  if (ch.real_world.paragraphs.length) out.push(`## In the Real World${ch.real_world.title ? `: ${ch.real_world.title}` : ""}\n\n` + ch.real_world.paragraphs.join("\n\n"));
  if (ch.summary.length) out.push("## Chapter Summary\n" + ch.summary.map((x) => `- ${x}`).join("\n"));
  if (ch.review_questions.length) out.push("## Reading Comprehension Questions\n" + ch.review_questions.map((q, i) => `${i + 1}. ${q.question} [DOK ${q.dok}]`).join("\n"));
  if (ch.glossary.length) out.push("## Key Terms\n" + ch.glossary.map((g) => `- **${g.term}** — ${g.definition}`).join("\n"));
  return out.join("\n\n");
}
