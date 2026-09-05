// Shared export model.
//
// Everything exportable (readings, activities, lesson plans, question sets)
// is first normalised into an `ExportResource`: a title, some metadata, and a
// flat list of simple blocks. Each output format (Word, PDF, Excel, Canvas HTML,
// and later Google Classroom / Docs) renders from this one model, so adding a
// destination never requires touching the library UI.

import type { LibraryItem } from "@/components/library/libraryTypes";
import type { QuestionRow } from "@/pages/app/standards/QuestionsTab";
import { chapterToBlocks, isChapter, normalizeChapter } from "@/modules/curriculum/lib/textbook-chapter";

export type ExportBlock =
  | { type: "h1" | "h2" | "h3" | "p" | "quote"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "hr" };

export type ExportStandard = { code: string; description: string };

export type ExportQuestion = {
  id: string;
  text: string;
  answers: { text: string; correct: boolean }[];
  points: number;
  itemType: string | null;
  dok: number | null;
  standards: ExportStandard[];
  assignment: string | null;
};

export type ExportResource = {
  id: string;
  kind: "reading" | "activity" | "lesson_plan" | "question_set";
  title: string;
  blocks: ExportBlock[];
  standards: ExportStandard[];
  dokLevels: number[];
  grade: string | null;
  subject: string | null;
  source: string | null;
  updatedAt: string | null;
  /** Present only for question sets. */
  questions?: ExportQuestion[];
  /** Attached file (uploads) — exported as a link/mention, not embedded. */
  fileName?: string | null;
};

export const KIND_LABEL: Record<ExportResource["kind"], string> = {
  reading: "Reading",
  activity: "Activity",
  lesson_plan: "Lesson plan",
  question_set: "Question set",
};

/* ───────────── Markdown → blocks ───────────── */

/** Remove inline markdown markers, leaving plain text. */
/** Like plainInline but keeps leading/trailing whitespace (for run splitting). */
export function plainInlineKeepSpace(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~(.+?)~~/g, "$1");
}

export function plainInline(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Inline markdown → safe HTML (bold, italic, code, links). */
export function inlineHtml(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/(\*\*|__)(.+?)\1/g, "<strong>$2</strong>");
  out = out.replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

/** Very small markdown parser covering what the AI generator and editor produce. */
export function markdownToBlocks(md: string | null | undefined): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  if (!md) return blocks;
  // Strip HTML tags if a body came in as HTML (Canvas imports).
  const src = /<\/?[a-z][\s\S]*>/i.test(md) ? htmlToMarkdownish(md) : md;
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => { if (para.length) { blocks.push({ type: "p", text: para.join(" ").trim() }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flushPara(); flushList(); continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); flushList(); const lvl = h[1].length; blocks.push({ type: lvl === 1 ? "h1" : lvl === 2 ? "h2" : "h3", text: h[2].trim() }); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { flushPara(); flushList(); blocks.push({ type: "hr" }); continue; }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((ul ?? ol)![1].trim());
      continue;
    }
    const q = line.match(/^\s*>\s?(.*)$/);
    if (q) { flushPara(); flushList(); blocks.push({ type: "quote", text: q[1].trim() }); continue; }
    if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += " " + line.trim(); continue; }
    flushList();
    para.push(line.trim());
  }
  flushPara(); flushList();
  return blocks;
}

/** Best-effort HTML → markdown-ish text so imported Canvas pages export cleanly. */
function htmlToMarkdownish(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("script,style,iframe").forEach((n) => n.remove());
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { out.push(node.textContent ?? ""); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const hm = tag.match(/^h([1-6])$/);
    if (hm) { out.push(`\n\n${"#".repeat(Math.min(3, Number(hm[1])))} ${el.textContent?.trim() ?? ""}\n\n`); return; }
    if (tag === "li") { const ordered = el.parentElement?.tagName.toLowerCase() === "ol"; out.push(`\n${ordered ? "1." : "-"} ${el.textContent?.trim() ?? ""}`); return; }
    if (tag === "br") { out.push("\n"); return; }
    if (tag === "hr") { out.push("\n\n---\n\n"); return; }
    if (tag === "strong" || tag === "b") { out.push(`**${el.textContent ?? ""}**`); return; }
    if (tag === "em" || tag === "i") { out.push(`*${el.textContent ?? ""}*`); return; }
    if (tag === "a") { const href = el.getAttribute("href"); out.push(href ? `[${el.textContent ?? href}](${href})` : el.textContent ?? ""); return; }
    const block = ["p", "div", "ul", "ol", "blockquote", "table", "tr", "section", "article"].includes(tag);
    if (block) out.push("\n\n");
    el.childNodes.forEach(walk);
    if (block) out.push("\n\n");
  };
  div.childNodes.forEach(walk);
  return out.join("").replace(/\n{3,}/g, "\n\n");
}

/* ───────────── Blocks → HTML (Canvas pages, Google Docs later) ───────────── */

export function blocksToHtml(blocks: ExportBlock[]): string {
  return blocks.map((b) => {
    switch (b.type) {
      case "h1": return `<h2>${inlineHtml(b.text)}</h2>`; // page title already H1 in the LMS
      case "h2": return `<h3>${inlineHtml(b.text)}</h3>`;
      case "h3": return `<h4>${inlineHtml(b.text)}</h4>`;
      case "p": return `<p>${inlineHtml(b.text)}</p>`;
      case "quote": return `<blockquote>${inlineHtml(b.text)}</blockquote>`;
      case "hr": return "<hr>";
      case "ul": return `<ul>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join("")}</ul>`;
      case "ol": return `<ol>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join("")}</ol>`;
    }
  }).join("\n");
}

/** Metadata line used at the top of every export. */
export function resourceMetaLine(r: ExportResource): string {
  const parts: string[] = [];
  if (r.grade) parts.push(`Grade ${r.grade}`);
  if (r.subject) parts.push(r.subject);
  if (r.dokLevels.length) parts.push(`DOK ${Array.from(new Set(r.dokLevels)).sort().join(", ")}`);
  if (r.standards.length) parts.push(`Standards: ${r.standards.map((s) => s.code).join(", ")}`);
  return parts.join(" · ");
}

/** Full HTML for an LMS page/assignment: metadata footer + body (+ questions if any). */
export function resourceToHtml(r: ExportResource): string {
  const meta = resourceMetaLine(r);
  let html = "";
  if (meta) html += `<p><em>${escapeHtml(meta)}</em></p>`;
  html += blocksToHtml(r.blocks);
  if (r.questions?.length) html += blocksToHtml(questionsToBlocks(r.questions, { showAnswers: false }));
  if (r.standards.length) {
    html += `<hr><p><strong>Standards</strong></p><ul>${r.standards.map((s) => `<li><strong>${escapeHtml(s.code)}</strong> — ${escapeHtml(s.description)}</li>`).join("")}</ul>`;
  }
  return html;
}

/* ───────────── Questions → blocks ───────────── */

export function questionsToBlocks(qs: ExportQuestion[], opts: { showAnswers: boolean }): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  qs.forEach((q, i) => {
    const tags: string[] = [];
    if (q.points) tags.push(`${q.points} pt${q.points === 1 ? "" : "s"}`);
    if (q.dok) tags.push(`DOK ${q.dok}`);
    if (q.standards.length) tags.push(q.standards.map((s) => s.code).join(", "));
    blocks.push({ type: "p", text: `**${i + 1}.** ${q.text}${tags.length ? `  _(${tags.join(" · ")})_` : ""}` });
    if (q.answers.length) {
      blocks.push({ type: "ul", items: q.answers.map((a, j) => `${String.fromCharCode(65 + j)}. ${a.text}${opts.showAnswers && a.correct ? " ✓" : ""}`) });
    } else {
      blocks.push({ type: "p", text: "Answer:" });
      blocks.push({ type: "hr" });
    }
  });
  return blocks;
}

export function answerKeyBlocks(qs: ExportQuestion[]): ExportBlock[] {
  const items = qs.map((q, i) => {
    const correct = q.answers.map((a, j) => (a.correct ? String.fromCharCode(65 + j) : null)).filter(Boolean);
    return correct.length ? correct.join(", ") : "(open response)";
  });
  return [{ type: "h2", text: "Answer key" }, { type: "ol", items }];
}

/* ───────────── Adapters from app records ───────────── */

export function resourceFromLibraryItem(it: LibraryItem): ExportResource {
  return {
    id: it.id,
    kind: it.kind,
    title: it.title,
    blocks: it.kind === "reading" && isChapter(it.chapter) ? chapterToBlocks(normalizeChapter(it.chapter, it.title), { includeAnswers: true }) : markdownToBlocks(it.body),
    standards: it.standards.map((s) => ({ code: s.code, description: s.description })),
    dokLevels: it.dok_levels ?? [],
    grade: it.grade,
    subject: it.subject,
    source: it.source,
    updatedAt: it.updated_at,
    fileName: it.file_name,
  };
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").trim();
}

export function exportQuestionFromRow(q: QuestionRow): ExportQuestion {
  return {
    id: q.id,
    text: stripHtml(q.question_text) || q.question_text || "",
    answers: (q.answers ?? []).map((a) => ({ text: (a.text ?? stripHtml(a.html)) || "", correct: (a.weight ?? 0) > 0 })),
    points: Number(q.points_possible ?? 1),
    itemType: q.item_type ?? null,
    dok: q.dok_level ?? null,
    standards: (q.standards ?? []).map((s) => ({ code: s.code, description: s.description })),
    assignment: q.assignments?.name ?? null,
  };
}

export function resourceFromQuestions(rows: QuestionRow[], title = "Question set"): ExportResource {
  const questions = rows.map(exportQuestionFromRow);
  const stdMap = new Map<string, ExportStandard>();
  questions.forEach((q) => q.standards.forEach((s) => stdMap.set(s.code, s)));
  return {
    id: `qset-${Date.now()}`,
    kind: "question_set",
    title,
    blocks: [],
    standards: Array.from(stdMap.values()),
    dokLevels: Array.from(new Set(questions.map((q) => q.dok).filter((d): d is number => d != null))),
    grade: null,
    subject: null,
    source: "canvas",
    updatedAt: null,
    questions,
  };
}

export function safeFilename(s: string, ext: string) {
  const base = s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "export";
  return `${base}.${ext}`;
}
