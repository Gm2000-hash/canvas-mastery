// Compiled digital textbook: loading, ordering, front/back matter and export.
import { supabase } from "@/integrations/supabase/client";
import type { ExportResource } from "@/lib/export/resource";
import {
  chapterFromLegacyLesson, chapterToBlocks, chapterToHtml, isChapter, mergeGlossary, normalizeChapter, renumberChapter,
  type ChapterExportBlock, type TextbookChapter,
} from "./textbook-chapter";

export interface Textbook {
  id: string;
  teacher_id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  cover_url: string | null;
  description: string | null;
  is_published: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface TextbookChapterRow {
  id: string;
  textbook_id: string;
  part_title: string | null;
  sort_order: number;
  source: "lesson" | "library_item";
  lesson_id: string | null;
  library_item_id: string | null;
}

export interface ResolvedChapter {
  id: string;
  part_title: string | null;
  source: "lesson" | "library_item";
  source_id: string;
  converted: boolean;
  chapter: TextbookChapter;
  standards: string[];
}

export interface BookPart { title: string | null; chapters: ResolvedChapter[] }

/** Markdown-only fallback for library readings that were never converted. */
function chapterFromMarkdown(title: string, md: string): TextbookChapter {
  const lines = (md || "").replace(/\r/g, "").split("\n");
  const sections: { heading: string; blocks: { type: "paragraph"; text: string }[] }[] = [];
  let cur = { heading: "Reading", blocks: [] as { type: "paragraph"; text: string }[] };
  let para: string[] = [];
  const flush = () => { if (para.length) { cur.blocks.push({ type: "paragraph", text: para.join(" ") }); para = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^#{1,3}\s+(.*)$/);
    if (h) { flush(); if (cur.blocks.length) sections.push(cur); cur = { heading: h[1], blocks: [] }; continue; }
    if (!line) { flush(); continue; }
    para.push(line.replace(/^[-*]\s+/, "• "));
  }
  flush(); if (cur.blocks.length) sections.push(cur);
  return normalizeChapter({ title, sections }, title);
}

export function resolveChapter(row: {
  id: string; part_title: string | null; source: "lesson" | "library_item"; source_id: string;
  title: string; chapter: unknown; legacy?: any; body?: string | null; standards?: string[];
}): ResolvedChapter {
  const converted = isChapter(row.chapter);
  const chapter = converted
    ? normalizeChapter(row.chapter, row.title)
    : row.legacy ? chapterFromLegacyLesson({ ...row.legacy, title: row.legacy.title ?? row.title })
    : chapterFromMarkdown(row.title, row.body ?? "");
  return { id: row.id, part_title: row.part_title, source: row.source, source_id: row.source_id, converted, chapter, standards: row.standards ?? [] };
}

/** Owner-side load: chapter rows + their lessons / library items. */
export async function loadBookChapters(textbookId: string): Promise<ResolvedChapter[]> {
  const { data: rows, error } = await supabase.from("textbook_chapters").select("*").eq("textbook_id", textbookId).order("sort_order");
  if (error) throw error;
  const list = (rows ?? []) as TextbookChapterRow[];
  const lessonIds = list.filter((r) => r.lesson_id).map((r) => r.lesson_id!);
  const itemIds = list.filter((r) => r.library_item_id).map((r) => r.library_item_id!);
  const [lessons, items, stds] = await Promise.all([
    lessonIds.length ? supabase.from("curriculum_lessons").select("*").in("id", lessonIds) : Promise.resolve({ data: [] as any[] }),
    itemIds.length ? supabase.from("library_items").select("id, title, body, chapter, library_item_standards(standards(code))").in("id", itemIds) : Promise.resolve({ data: [] as any[] }),
    lessonIds.length ? (supabase.from("curriculum_lesson_standards" as any) as any).select("lesson_id, ngss_code").in("lesson_id", lessonIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const lmap = new Map((lessons.data ?? []).map((l: any) => [l.id, l]));
  const imap = new Map((items.data ?? []).map((i: any) => [i.id, i]));
  const smap = new Map<string, string[]>();
  for (const s of (stds.data ?? []) as any[]) smap.set(s.lesson_id, [...(smap.get(s.lesson_id) ?? []), s.ngss_code]);
  return list.map((r) => {
    if (r.source === "lesson") {
      const l = lmap.get(r.lesson_id!);
      return resolveChapter({ id: r.id, part_title: r.part_title, source: "lesson", source_id: r.lesson_id!, title: l?.title ?? "Missing reading", chapter: l?.chapter, legacy: l ?? undefined, standards: smap.get(r.lesson_id!) ?? [] });
    }
    const it = imap.get(r.library_item_id!);
    return resolveChapter({ id: r.id, part_title: r.part_title, source: "library_item", source_id: r.library_item_id!, title: it?.title ?? "Missing reading", chapter: it?.chapter, body: it?.body, standards: (it?.library_item_standards ?? []).map((x: any) => x.standards?.code).filter(Boolean) });
  });
}

/** Group consecutive chapters by part title and number them 1..n across the book. */
export function groupParts(chapters: ResolvedChapter[]): BookPart[] {
  const parts: BookPart[] = [];
  chapters.forEach((c, i) => {
    const numbered = { ...c, chapter: renumberChapter(c.chapter, i + 1) };
    const last = parts[parts.length - 1];
    if (last && (last.title ?? "") === (c.part_title ?? "")) last.chapters.push(numbered);
    else parts.push({ title: c.part_title, chapters: [numbered] });
  });
  return parts;
}

/* ───────────── Front & back matter ───────────── */

export const HOW_TO_USE: { title: string; tip: string }[] = [
  { title: "Preview first", tip: "Skim the chapter title, section headings, bold words, figures, summary and review questions before you read. Ask yourself what the chapter is about." },
  { title: "Turn headings into questions", tip: "Each numbered heading can become a question. Read the section to find the answer, then check the Guiding Questions in \"Before You Read\"." },
  { title: "Stop and summarize", tip: "After every section, pause and say in your own words what you just read. The \"Stop and Think\" boxes help you check yourself." },
  { title: "Use the glossary", tip: "Bold words are defined in the glossary. Click a bold word to see its definition without losing your place." },
  { title: "Connect it", tip: "Link what you read to your own life, the \"In the Real World\" story and what you already know." },
  { title: "Review and self-test", tip: "Use the Chapter Summary and Review Questions to quiz yourself. Try answering before you reveal the answer." },
];

export function frontMatterBlocks(book: Pick<Textbook, "title" | "subject" | "grade" | "description">, parts: BookPart[]): ChapterExportBlock[] {
  const out: ChapterExportBlock[] = [{ type: "h1", text: book.title }];
  const meta = [book.subject, book.grade ? `Grade ${book.grade}` : null].filter(Boolean).join(" · ");
  if (meta) out.push({ type: "p", text: `_${meta}_` });
  if (book.description) out.push({ type: "p", text: book.description });
  out.push({ type: "h2", text: "How to use this book" });
  out.push({ type: "ul", items: HOW_TO_USE.map((h) => `**${h.title}.** ${h.tip}`) });
  out.push({ type: "h2", text: "Contents" });
  for (const p of parts) {
    if (p.title) out.push({ type: "h3", text: p.title });
    out.push({ type: "ol", items: p.chapters.map((c) => `Chapter ${c.chapter.number}: ${c.chapter.title}`) });
  }
  return out;
}

export function backMatterBlocks(parts: BookPart[]): ChapterExportBlock[] {
  const all = parts.flatMap((p) => p.chapters);
  const glossary = mergeGlossary(all.map((c) => c.chapter));
  const out: ChapterExportBlock[] = [];
  if (glossary.length) { out.push({ type: "h1", text: "Glossary" }); out.push({ type: "ul", items: glossary.map((g) => `**${g.term}** — ${g.definition} _(${g.chapter})_`) }); }
  const withStds = all.filter((c) => c.standards.length);
  if (withStds.length) { out.push({ type: "h1", text: "Standards index" }); out.push({ type: "ul", items: withStds.map((c) => `Chapter ${c.chapter.number}: ${c.chapter.title} — ${c.standards.join(", ")}`) }); }
  return out;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function frontMatterHtml(book: Pick<Textbook, "title" | "subject" | "grade" | "description">, parts: BookPart[]): string {
  const meta = [book.subject, book.grade ? `Grade ${book.grade}` : null].filter(Boolean).join(" · ");
  return [
    `<h1>${esc(book.title)}</h1>`, meta ? `<p><em>${esc(meta)}</em></p>` : "", book.description ? `<p>${esc(book.description)}</p>` : "",
    `<h2>How to use this book</h2><ul>${HOW_TO_USE.map((h) => `<li><strong>${esc(h.title)}.</strong> ${esc(h.tip)}</li>`).join("")}</ul>`,
    `<h2>Contents</h2>`, ...parts.map((p) => `${p.title ? `<h3>${esc(p.title)}</h3>` : ""}<ol>${p.chapters.map((c) => `<li>Chapter ${c.chapter.number}: ${esc(c.chapter.title)}</li>`).join("")}</ol>`),
  ].join("");
}

/** Book → ExportResource list for the shared Word/PDF renderers. */
export function bookToResources(book: Textbook, parts: BookPart[], opts: { includeAnswers?: boolean } = {}): ExportResource[] {
  const base = { standards: [], dokLevels: [], grade: book.grade, subject: book.subject, source: "textbook", updatedAt: book.updated_at };
  const res: ExportResource[] = [{ id: `${book.id}-front`, kind: "reading", title: book.title, blocks: frontMatterBlocks(book, parts).slice(1) as any, ...base }];
  for (const p of parts) for (const c of p.chapters) {
    res.push({ id: c.id, kind: "reading", title: `Chapter ${c.chapter.number}: ${c.chapter.title}`, blocks: chapterToBlocks(c.chapter, { includeAnswers: opts.includeAnswers }).slice(1) as any, standards: c.standards.map((code) => ({ code, description: "" })), dokLevels: [], grade: book.grade, subject: book.subject, source: "textbook", updatedAt: book.updated_at });
  }
  const back = backMatterBlocks(parts);
  if (back.length) res.push({ id: `${book.id}-back`, kind: "reading", title: "Glossary & Standards index", blocks: back as any, ...base });
  return res;
}

/** Payload for the push-textbook edge function. */
export function bookPushPayload(book: Textbook, parts: BookPart[], platform: "canvas" | "google", courseId: string, published: boolean) {
  return {
    platform, course_id: courseId, published, textbook_id: book.id, title: book.title,
    front_matter: { html: frontMatterHtml(book, parts), blocks: frontMatterBlocks(book, parts) },
    parts: parts.map((p) => ({
      title: p.title,
      chapters: p.chapters.map((c) => ({ id: c.id, title: `Chapter ${c.chapter.number}: ${c.chapter.title}`, html: chapterToHtml(c.chapter), blocks: chapterToBlocks(c.chapter) })),
    })),
  };
}

export function bookReaderUrl(token: string) {
  return `${window.location.origin}/book/${token}`;
}
