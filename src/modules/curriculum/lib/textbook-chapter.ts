// Textbook chapter model shared by the Curriculum suite readings and Library
// reading items. One structure feeds the viewer/editor, Word/PDF export,
// Canvas/Google pushes and the compiled digital textbook.
//
// Structure (modeled on how students preview & study a textbook):
//   opener (hook, Before You Read, guiding questions, objectives)
//   numbered sections with paragraphs, callouts and captioned figures
//   In the Real World (case study), Chapter Summary, Review Questions, Glossary

export type CalloutKind = "stop_and_think" | "did_you_know" | "connect_it";

export type ChapterBlock =
  | { type: "paragraph"; text: string }
  | { type: "callout"; kind: CalloutKind; title?: string; text: string }
  | { type: "figure"; caption: string; description: string; alt?: string; image_url?: string | null };

export interface ChapterSection {
  number?: string;
  heading: string;
  blocks: ChapterBlock[];
}

export interface ReviewQuestion { question: string; dok: number; answer?: string }
export interface GlossaryEntry { term: string; definition: string }

export interface TextbookChapter {
  version: 1;
  number?: number | null;
  title: string;
  hook: string;
  before_you_read: { preview: string; prior_knowledge_prompt: string; guiding_questions: string[] };
  objectives: string[];
  sections: ChapterSection[];
  real_world: { title: string; paragraphs: string[] };
  summary: string[];
  review_questions: ReviewQuestion[];
  glossary: GlossaryEntry[];
  standards?: string[];
}

export const CALLOUT_LABEL: Record<CalloutKind, string> = {
  stop_and_think: "Stop and Think",
  did_you_know: "Did You Know?",
  connect_it: "Connect It",
};

const s = (v: unknown, d = ""): string => (typeof v === "string" ? v : v == null ? d : String(v));
const sa = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => s(x)).filter((x) => x.trim()) : []);

export function isChapter(v: unknown): v is TextbookChapter {
  return !!v && typeof v === "object" && Array.isArray((v as any).sections) && typeof (v as any).title === "string";
}

/** Coerce loosely-shaped JSON (AI output, older rows) into a valid chapter. */
export function normalizeChapter(raw: unknown, fallbackTitle = "Chapter"): TextbookChapter {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const byr = (r.before_you_read ?? {}) as Record<string, any>;
  const rw = (r.real_world ?? {}) as Record<string, any>;
  const sections: ChapterSection[] = (Array.isArray(r.sections) ? r.sections : []).map((sec: any) => ({
    number: sec?.number ? s(sec.number) : undefined,
    heading: s(sec?.heading, "Section"),
    blocks: (Array.isArray(sec?.blocks) ? sec.blocks : []).map((b: any): ChapterBlock | null => {
      if (!b || typeof b !== "object") return typeof b === "string" && b.trim() ? { type: "paragraph", text: b } : null;
      if (b.type === "callout") {
        const kind: CalloutKind = (["stop_and_think", "did_you_know", "connect_it"] as const).includes(b.kind) ? b.kind : "stop_and_think";
        return { type: "callout", kind, title: b.title ? s(b.title) : undefined, text: s(b.text) };
      }
      if (b.type === "figure") return { type: "figure", caption: s(b.caption), description: s(b.description), alt: b.alt ? s(b.alt) : undefined, image_url: b.image_url ?? null };
      return { type: "paragraph", text: s(b.text ?? b.html) };
    }).filter((b: ChapterBlock | null): b is ChapterBlock => !!b && ("text" in b ? !!b.text.trim() : true)),
  }));
  const ch: TextbookChapter = {
    version: 1,
    number: typeof r.number === "number" ? r.number : null,
    title: s(r.title, fallbackTitle),
    hook: s(r.hook),
    before_you_read: { preview: s(byr.preview), prior_knowledge_prompt: s(byr.prior_knowledge_prompt), guiding_questions: sa(byr.guiding_questions) },
    objectives: sa(r.objectives),
    sections,
    real_world: { title: s(rw.title ?? r.reading_title), paragraphs: sa(rw.paragraphs ?? r.reading_paragraphs) },
    summary: sa(r.summary),
    review_questions: (Array.isArray(r.review_questions) ? r.review_questions : []).map((q: any) => ({
      question: s(q?.question ?? q?.text ?? q), dok: Math.min(4, Math.max(1, Number(q?.dok) || 1)), answer: q?.answer ? s(q.answer) : undefined,
    })).filter((q: ReviewQuestion) => q.question.trim()),
    glossary: (Array.isArray(r.glossary ?? r.key_terms) ? (r.glossary ?? r.key_terms) : []).map((g: any) => ({ term: s(g?.term), definition: s(g?.definition) })).filter((g: GlossaryEntry) => g.term.trim()),
    standards: sa(r.standards),
  };
  return renumberChapter(ch, ch.number ?? undefined);
}

/** Assign section numbers (3.1, 3.2 …) and figure numbers based on the chapter number. */
export function renumberChapter(ch: TextbookChapter, number?: number | null): TextbookChapter {
  const n = number ?? ch.number ?? null;
  let fig = 0;
  return {
    ...ch,
    number: n,
    sections: ch.sections.map((sec, i) => ({
      ...sec,
      number: n ? `${n}.${i + 1}` : `${i + 1}`,
      blocks: sec.blocks.map((b) => {
        if (b.type !== "figure") return b;
        fig++;
        const label = n ? `Figure ${n}.${fig}` : `Figure ${fig}`;
        const caption = b.caption.replace(/^Figure\s+[\d.]+\s*[:.\-–—]?\s*/i, "");
        return { ...b, caption: `${label}: ${caption}` };
      }),
    })),
  };
}

/* ───────────── Legacy lesson ⇄ chapter ───────────── */

export interface LegacyLessonFields {
  title: string;
  objectives?: string[] | null;
  intro?: string[] | null;
  explanation?: string[] | null;
  key_terms?: { term: string; definition: string }[] | null;
  reading_title?: string | null;
  reading_paragraphs?: string[] | null;
  image_url?: string | null;
}

/** Deterministic (no AI) mapping so old readings render in the chapter layout. */
export function chapterFromLegacyLesson(l: LegacyLessonFields): TextbookChapter {
  const intro = l.intro ?? [];
  const expl = l.explanation ?? [];
  const sections: ChapterSection[] = [];
  if (intro.length) sections.push({ heading: "Introduction", blocks: intro.map((t) => ({ type: "paragraph", text: t })) });
  if (expl.length) sections.push({ heading: "Explanation", blocks: expl.map((t) => ({ type: "paragraph", text: t })) });
  return normalizeChapter({
    title: l.title,
    hook: intro[0] ? stripTags(intro[0]).slice(0, 400) : "",
    before_you_read: { preview: "", prior_knowledge_prompt: "", guiding_questions: [] },
    objectives: l.objectives ?? [],
    sections,
    real_world: { title: l.reading_title ?? "", paragraphs: l.reading_paragraphs ?? [] },
    summary: [],
    review_questions: [],
    glossary: l.key_terms ?? [],
  }, l.title);
}

/** Keep the legacy columns in sync so older screens and exports still work. */
export function chapterToLegacyFields(ch: TextbookChapter): Omit<LegacyLessonFields, "image_url"> {
  const paras = (secs: ChapterSection[]) => secs.flatMap((sec) => sec.blocks.filter((b): b is Extract<ChapterBlock, { type: "paragraph" }> => b.type === "paragraph").map((b) => b.text));
  const [first, ...rest] = ch.sections;
  return {
    title: ch.title,
    objectives: ch.objectives,
    intro: [ch.hook, ...(first ? paras([first]) : [])].filter(Boolean),
    explanation: paras(rest),
    key_terms: ch.glossary,
    reading_title: ch.real_world.title || null,
    reading_paragraphs: ch.real_world.paragraphs,
  };
}

/* ───────────── Renderers ───────────── */

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Paragraph text may be plain, markdown-ish (**bold**) or HTML from the rich editor. */
export function inlineToHtml(t: string): string {
  if (/<[a-z][\s\S]*>/i.test(t)) return t;
  return esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|\W)_(.+?)_(?=\W|$)/g, "$1<em>$2</em>");
}
const mdInline = (t: string) => /<[a-z][\s\S]*>/i.test(t) ? stripTags(t.replace(/<(strong|b)>(.*?)<\/\1>/gi, "**$2**")) : t;

export function chapterToMarkdown(ch: TextbookChapter): string {
  const out: string[] = [];
  const num = ch.number ? `Chapter ${ch.number}: ` : "";
  out.push(`# ${num}${ch.title}`);
  if (ch.hook) out.push(mdInline(ch.hook));
  if (ch.before_you_read.preview || ch.before_you_read.guiding_questions.length) {
    out.push("## Before You Read");
    if (ch.before_you_read.preview) out.push(mdInline(ch.before_you_read.preview));
    if (ch.before_you_read.prior_knowledge_prompt) out.push(`> **Think first:** ${mdInline(ch.before_you_read.prior_knowledge_prompt)}`);
    if (ch.before_you_read.guiding_questions.length) out.push("**Guiding questions**\n" + ch.before_you_read.guiding_questions.map((q) => `- ${mdInline(q)}`).join("\n"));
  }
  if (ch.objectives.length) out.push("## Learning Objectives\n" + ch.objectives.map((o) => `- ${mdInline(o)}`).join("\n"));
  for (const sec of ch.sections) {
    out.push(`## ${sec.number ? sec.number + " " : ""}${sec.heading}`);
    for (const b of sec.blocks) {
      if (b.type === "paragraph") out.push(mdInline(b.text));
      else if (b.type === "callout") out.push(`> **${b.title || CALLOUT_LABEL[b.kind]}:** ${mdInline(b.text)}`);
      else out.push(b.image_url ? `![${b.alt ?? b.caption}](${b.image_url})\n\n_${b.caption}_` : `_${b.caption}_ (${b.description})`);
    }
  }
  if (ch.real_world.paragraphs.length) out.push(`## In the Real World${ch.real_world.title ? `: ${ch.real_world.title}` : ""}\n\n` + ch.real_world.paragraphs.map(mdInline).join("\n\n"));
  if (ch.summary.length) out.push("## Chapter Summary\n" + ch.summary.map((x) => `- ${mdInline(x)}`).join("\n"));
  if (ch.review_questions.length) out.push("## Review Questions\n" + ch.review_questions.map((q, i) => `${i + 1}. ${mdInline(q.question)} [DOK ${q.dok}]`).join("\n"));
  if (ch.glossary.length) out.push("## Glossary\n" + ch.glossary.map((g) => `- **${g.term}** — ${mdInline(g.definition)}`).join("\n"));
  return out.join("\n\n");
}

/** Self-contained HTML (inline styles) for Canvas pages, Google Docs and print. */
export function chapterToHtml(ch: TextbookChapter, opts: { includeAnswers?: boolean; headingLevel?: 1 | 2 } = {}): string {
  const h = opts.headingLevel ?? 1;
  const H = (lvl: number, text: string, id?: string) => `<h${Math.min(6, lvl)}${id ? ` id="${id}"` : ""}>${text}</h${Math.min(6, lvl)}>`;
  const box = (title: string, body: string, color: string) =>
    `<div style="border-left:4px solid ${color};background:#f8fafc;padding:12px 16px;margin:14px 0;border-radius:6px;"><strong>${esc(title)}</strong><div>${body}</div></div>`;
  const out: string[] = [];
  out.push(H(h, esc(ch.number ? `Chapter ${ch.number}: ${ch.title}` : ch.title)));
  if (ch.hook) out.push(`<p style="font-size:1.05em;"><em>${inlineToHtml(ch.hook)}</em></p>`);
  if (ch.before_you_read.preview || ch.before_you_read.guiding_questions.length) {
    let body = "";
    if (ch.before_you_read.preview) body += `<p>${inlineToHtml(ch.before_you_read.preview)}</p>`;
    if (ch.before_you_read.prior_knowledge_prompt) body += `<p><strong>Think first:</strong> ${inlineToHtml(ch.before_you_read.prior_knowledge_prompt)}</p>`;
    if (ch.before_you_read.guiding_questions.length) body += `<p><strong>Guiding questions</strong></p><ul>${ch.before_you_read.guiding_questions.map((q) => `<li>${inlineToHtml(q)}</li>`).join("")}</ul>`;
    out.push(box("Before You Read", body, "#2563eb"));
  }
  if (ch.objectives.length) out.push(H(h + 1, "Learning Objectives") + `<ul>${ch.objectives.map((o) => `<li>${inlineToHtml(o)}</li>`).join("")}</ul>`);
  for (const sec of ch.sections) {
    out.push(H(h + 1, esc(`${sec.number ? sec.number + " " : ""}${sec.heading}`)));
    for (const b of sec.blocks) {
      if (b.type === "paragraph") out.push(`<p>${inlineToHtml(b.text)}</p>`);
      else if (b.type === "callout") out.push(box(b.title || CALLOUT_LABEL[b.kind], `<p>${inlineToHtml(b.text)}</p>`, b.kind === "did_you_know" ? "#d97706" : b.kind === "connect_it" ? "#059669" : "#7c3aed"));
      else out.push(`<figure style="margin:16px 0;text-align:center;">${b.image_url ? `<img src="${b.image_url}" alt="${esc(b.alt ?? b.caption)}" style="max-width:100%;border-radius:8px;" />` : `<div style="border:1px dashed #94a3b8;padding:20px;color:#64748b;border-radius:8px;">${esc(b.description)}</div>`}<figcaption style="font-size:0.9em;color:#475569;margin-top:6px;">${esc(b.caption)}</figcaption></figure>`);
    }
  }
  if (ch.real_world.paragraphs.length) out.push(H(h + 1, esc(`In the Real World${ch.real_world.title ? `: ${ch.real_world.title}` : ""}`)) + ch.real_world.paragraphs.map((p) => `<p>${inlineToHtml(p)}</p>`).join(""));
  if (ch.summary.length) out.push(H(h + 1, "Chapter Summary") + `<ul>${ch.summary.map((x) => `<li>${inlineToHtml(x)}</li>`).join("")}</ul>`);
  if (ch.review_questions.length) out.push(H(h + 1, "Review Questions") + `<ol>${ch.review_questions.map((q) => `<li>${inlineToHtml(q.question)} <em>[DOK ${q.dok}]</em>${opts.includeAnswers && q.answer ? `<br/><span style="color:#475569;"><strong>Answer:</strong> ${inlineToHtml(q.answer)}</span>` : ""}</li>`).join("")}</ol>`);
  if (ch.glossary.length) out.push(H(h + 1, "Glossary") + `<dl>${ch.glossary.map((g) => `<dt><strong>${esc(g.term)}</strong></dt><dd>${inlineToHtml(g.definition)}</dd>`).join("")}</dl>`);
  return out.join("\n");
}

/** Flat export blocks (Word / PDF / Google Doc pipeline in src/lib/export). */
export type ChapterExportBlock =
  | { type: "h1" | "h2" | "h3" | "p" | "quote"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "hr" };

export function chapterToBlocks(ch: TextbookChapter, opts: { includeAnswers?: boolean; titleLevel?: "h1" | "h2" } = {}): ChapterExportBlock[] {
  const out: ChapterExportBlock[] = [];
  const t = opts.titleLevel ?? "h1";
  const sub = t === "h1" ? "h2" : "h3";
  out.push({ type: t, text: ch.number ? `Chapter ${ch.number}: ${ch.title}` : ch.title });
  if (ch.hook) out.push({ type: "p", text: `_${mdInline(ch.hook)}_` });
  if (ch.before_you_read.preview || ch.before_you_read.guiding_questions.length) {
    out.push({ type: sub, text: "Before You Read" });
    if (ch.before_you_read.preview) out.push({ type: "p", text: mdInline(ch.before_you_read.preview) });
    if (ch.before_you_read.prior_knowledge_prompt) out.push({ type: "quote", text: `Think first: ${mdInline(ch.before_you_read.prior_knowledge_prompt)}` });
    if (ch.before_you_read.guiding_questions.length) { out.push({ type: "p", text: "**Guiding questions**" }); out.push({ type: "ul", items: ch.before_you_read.guiding_questions.map(mdInline) }); }
  }
  if (ch.objectives.length) { out.push({ type: sub, text: "Learning Objectives" }); out.push({ type: "ul", items: ch.objectives.map(mdInline) }); }
  for (const sec of ch.sections) {
    out.push({ type: sub, text: `${sec.number ? sec.number + " " : ""}${sec.heading}` });
    for (const b of sec.blocks) {
      if (b.type === "paragraph") out.push({ type: "p", text: mdInline(b.text) });
      else if (b.type === "callout") out.push({ type: "quote", text: `**${b.title || CALLOUT_LABEL[b.kind]}:** ${mdInline(b.text)}` });
      else out.push({ type: "quote", text: `_${b.caption}_${b.image_url ? "" : ` — ${b.description}`}` });
    }
  }
  if (ch.real_world.paragraphs.length) { out.push({ type: sub, text: `In the Real World${ch.real_world.title ? `: ${ch.real_world.title}` : ""}` }); ch.real_world.paragraphs.forEach((p) => out.push({ type: "p", text: mdInline(p) })); }
  if (ch.summary.length) { out.push({ type: sub, text: "Chapter Summary" }); out.push({ type: "ul", items: ch.summary.map(mdInline) }); }
  if (ch.review_questions.length) {
    out.push({ type: sub, text: "Review Questions" });
    out.push({ type: "ol", items: ch.review_questions.map((q) => `${mdInline(q.question)} _[DOK ${q.dok}]_`) });
    if (opts.includeAnswers && ch.review_questions.some((q) => q.answer)) { out.push({ type: "p", text: "**Answer key (teacher)**" }); out.push({ type: "ol", items: ch.review_questions.map((q) => mdInline(q.answer ?? "—")) }); }
  }
  if (ch.glossary.length) { out.push({ type: sub, text: "Glossary" }); out.push({ type: "ul", items: ch.glossary.map((g) => `**${g.term}** — ${mdInline(g.definition)}`) }); }
  return out;
}

export function chapterDokLevels(ch: TextbookChapter): number[] {
  return Array.from(new Set(ch.review_questions.map((q) => q.dok))).sort();
}

/** Combined A–Z glossary for a whole book. */
export function mergeGlossary(chapters: { number?: number | null; title: string; glossary: GlossaryEntry[] }[]): (GlossaryEntry & { chapter: string })[] {
  const seen = new Map<string, GlossaryEntry & { chapter: string }>();
  for (const ch of chapters) {
    for (const g of ch.glossary) {
      const key = g.term.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.set(key, { ...g, chapter: ch.number ? `Ch. ${ch.number}` : ch.title });
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.term.localeCompare(b.term));
}

export function emptyChapter(title = "New chapter"): TextbookChapter {
  return normalizeChapter({ title, sections: [{ heading: "Section", blocks: [{ type: "paragraph", text: "" }] }] }, title);
}
