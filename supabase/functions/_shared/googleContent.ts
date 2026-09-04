// Google Docs / Slides / Forms content helpers shared by the Classroom import and push functions.
import { gapi } from "./googleAuth.ts";

// ---- Reading -------------------------------------------------------------

/** Google Docs JSON → markdown-ish text (headings, lists, bold/italic). */
export function docToMarkdown(doc: any): string {
  const out: string[] = [];
  const lists: Record<string, any> = doc.lists ?? {};
  for (const el of doc.body?.content ?? []) {
    if (el.paragraph) {
      const p = el.paragraph;
      let text = "";
      for (const pe of p.elements ?? []) {
        const tr = pe.textRun;
        if (!tr) continue;
        let t = String(tr.content ?? "").replace(/\n$/, "");
        if (!t.trim()) { text += t; continue; }
        const st = tr.textStyle ?? {};
        if (st.bold) t = `**${t}**`;
        if (st.italic) t = `_${t}_`;
        if (st.link?.url) t = `[${t}](${st.link.url})`;
        text += t;
      }
      text = text.trim();
      if (!text) { out.push(""); continue; }
      const style = p.paragraphStyle?.namedStyleType ?? "NORMAL_TEXT";
      const h = style.match(/^HEADING_(\d)$/);
      if (style === "TITLE") out.push(`# ${text}`);
      else if (h) out.push(`${"#".repeat(Math.min(3, Number(h[1])))} ${text}`);
      else if (p.bullet) {
        const glyph = lists[p.bullet.listId]?.listProperties?.nestingLevels?.[0]?.glyphType;
        const ordered = glyph && /DECIMAL|ALPHA|ROMAN/.test(glyph);
        out.push(`${ordered ? "1." : "-"} ${text}`);
      } else out.push(text);
    } else if (el.table) {
      for (const row of el.table.tableRows ?? []) {
        const cells = (row.tableCells ?? []).map((c: any) =>
          (c.content ?? []).map((x: any) => (x.paragraph?.elements ?? []).map((e: any) => e.textRun?.content ?? "").join("")).join(" ").replace(/\n/g, " ").trim());
        out.push(`| ${cells.join(" | ")} |`);
      }
      out.push("");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Google Slides JSON → text, one heading per slide. */
export function slidesToMarkdown(pres: any): string {
  const out: string[] = [];
  (pres.slides ?? []).forEach((s: any, i: number) => {
    const texts: string[] = [];
    for (const pe of s.pageElements ?? []) {
      const t = (pe.shape?.text?.textElements ?? []).map((e: any) => e.textRun?.content ?? "").join("").trim();
      if (t) texts.push(t);
    }
    if (!texts.length) return;
    out.push(`## Slide ${i + 1}: ${texts[0].split("\n")[0].slice(0, 80)}`);
    out.push(texts.join("\n\n"));
    out.push("");
  });
  return out.join("\n").trim();
}

export async function fetchDocMarkdown(token: string, docId: string): Promise<string> {
  const doc = await gapi(token, `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}`);
  return docToMarkdown(doc);
}
export async function fetchSlidesMarkdown(token: string, id: string): Promise<string> {
  const pres = await gapi(token, `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(id)}`);
  return slidesToMarkdown(pres);
}

// ---- Forms → questions ----------------------------------------------------

export type ImportedQuestion = {
  google_item_id: string;
  question_text: string;
  item_type: string;
  points_possible: number;
  answers: { text: string; weight: number }[] | null;
  position: number;
};

export function formIdFromUrl(url: string | undefined | null): string | null {
  const m = String(url ?? "").match(/\/forms\/d\/(?!e\/)([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Map a Forms API `form` into question rows. Returns null when the form isn't a quiz. */
export function formToQuestions(form: any): { isQuiz: boolean; title: string; questions: ImportedQuestion[] } {
  const isQuiz = !!form.settings?.quizSettings?.isQuiz;
  const questions: ImportedQuestion[] = [];
  let pos = 0;
  for (const item of form.items ?? []) {
    const q = item.questionItem?.question;
    if (!q) continue;
    pos++;
    const grading = q.grading ?? {};
    const correct = new Set<string>((grading.correctAnswers?.answers ?? []).map((a: any) => String(a.value)));
    const points = Number(grading.pointValue ?? 1) || 1;
    const text = [item.title, item.description].filter(Boolean).join("\n\n") || `Question ${pos}`;
    if (q.choiceQuestion) {
      const opts = (q.choiceQuestion.options ?? []).filter((o: any) => !o.isOther).map((o: any) => String(o.value ?? ""));
      const answers = opts.map((t: string) => ({ text: t, weight: correct.has(t) ? 100 : 0 }));
      const tf = opts.length === 2 && opts.every((o: string) => /^(true|false)$/i.test(o.trim()));
      const type = tf ? "true_false_question" : q.choiceQuestion.type === "CHECKBOX" || correct.size > 1 ? "multiple_answers_question" : "multiple_choice_question";
      questions.push({ google_item_id: String(item.itemId), question_text: text, item_type: type, points_possible: points, answers, position: pos });
    } else if (q.textQuestion) {
      const type = q.textQuestion.paragraph ? "essay_question" : "short_answer_question";
      const answers = correct.size ? Array.from(correct).map((t) => ({ text: t, weight: 100 })) : null;
      questions.push({ google_item_id: String(item.itemId), question_text: text, item_type: type, points_possible: points, answers, position: pos });
    } else if (q.scaleQuestion || q.dateQuestion || q.timeQuestion) {
      questions.push({ google_item_id: String(item.itemId), question_text: text, item_type: "short_answer_question", points_possible: points, answers: null, position: pos });
    }
  }
  return { isQuiz, title: String(form.info?.title ?? form.info?.documentTitle ?? "Quiz"), questions };
}

// ---- Blocks → Google Docs batchUpdate ---------------------------------------

export type Block =
  | { type: "h1" | "h2" | "h3" | "p" | "quote"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "hr" };

type Seg = { text: string; bold?: boolean; italic?: boolean; link?: string };

/** Inline markdown → styled segments (bold, italic, links; code becomes plain). */
function segments(md: string): Seg[] {
  const out: Seg[] = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(?!\s)(.+?)\3|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    if (m.index > last) out.push({ text: md.slice(last, m.index) });
    if (m[2]) out.push({ text: m[2], bold: true });
    else if (m[4]) out.push({ text: m[4], italic: true });
    else if (m[5]) out.push({ text: m[5], link: m[6] });
    else if (m[7]) out.push({ text: m[7] });
    last = re.lastIndex;
  }
  if (last < md.length) out.push({ text: md.slice(last) });
  return out.filter((s) => s.text.length);
}

/**
 * Build Google Docs batchUpdate requests for a fresh document. Text is inserted
 * sequentially; paragraph styles and inline styles are applied by range.
 */
export function blocksToDocRequests(title: string, blocks: Block[], meta?: string): any[] {
  const reqs: any[] = [];
  let idx = 1;

  const para = (segs: Seg[], style?: { named?: string; indent?: boolean; italic?: boolean; size?: number; color?: boolean }, bullet?: "ul" | "ol") => {
    const start = idx;
    const text = segs.map((s) => s.text).join("") + "\n";
    reqs.push({ insertText: { location: { index: idx }, text } });
    let cursor = idx;
    for (const s of segs) {
      const range = { startIndex: cursor, endIndex: cursor + s.text.length };
      const ts: any = {}; const fields: string[] = [];
      if (s.bold) { ts.bold = true; fields.push("bold"); }
      if (s.italic || style?.italic) { ts.italic = true; fields.push("italic"); }
      if (s.link) { ts.link = { url: s.link }; fields.push("link"); }
      if (fields.length && s.text.length) reqs.push({ updateTextStyle: { range, textStyle: ts, fields: fields.join(",") } });
      cursor += s.text.length;
    }
    idx += text.length;
    const range = { startIndex: start, endIndex: idx };
    if (style?.named) reqs.push({ updateParagraphStyle: { range, paragraphStyle: { namedStyleType: style.named }, fields: "namedStyleType" } });
    if (style?.indent) reqs.push({ updateParagraphStyle: { range, paragraphStyle: { indentStart: { magnitude: 36, unit: "PT" } }, fields: "indentStart" } });
    if (style?.size || style?.color) {
      const ts: any = {}; const f: string[] = [];
      if (style.size) { ts.fontSize = { magnitude: style.size, unit: "PT" }; f.push("fontSize"); }
      if (style.color) { ts.foregroundColor = { color: { rgbColor: { red: 0.45, green: 0.45, blue: 0.45 } } }; f.push("foregroundColor"); }
      reqs.push({ updateTextStyle: { range: { startIndex: start, endIndex: idx - 1 }, textStyle: ts, fields: f.join(",") } });
    }
    if (bullet) reqs.push({ createParagraphBullets: { range: { startIndex: start, endIndex: idx - 1 }, bulletPreset: bullet === "ol" ? "NUMBERED_DECIMAL_ALPHA_ROMAN" : "BULLET_DISC_CIRCLE_SQUARE" } });
  };

  para([{ text: title }], { named: "TITLE" });
  if (meta) para([{ text: meta }], { size: 9, color: true });

  for (const b of blocks) {
    if (b.type === "hr") { para([{ text: "―――" }], { color: true }); continue; }
    if (b.type === "ul" || b.type === "ol") { for (const it of b.items) para(segments(it), undefined, b.type); continue; }
    const named = b.type === "h1" ? "HEADING_1" : b.type === "h2" ? "HEADING_2" : b.type === "h3" ? "HEADING_3" : "NORMAL_TEXT";
    para(segments(b.text), { named, indent: b.type === "quote", italic: b.type === "quote" });
  }
  return reqs;
}

// ---- Questions → Google Forms batchUpdate ----------------------------------

export type PushQuestion = { text: string; points: number; itemType?: string | null; answers: { text: string; correct: boolean }[] };

export function questionsToFormRequests(qs: PushQuestion[], description?: string): any[] {
  const reqs: any[] = [
    { updateSettings: { settings: { quizSettings: { isQuiz: true } }, updateMask: "quizSettings.isQuiz" } },
  ];
  if (description) reqs.push({ updateFormInfo: { info: { description: description.slice(0, 4000) }, updateMask: "description" } });
  qs.forEach((q, i) => {
    const correct = q.answers.filter((a) => a.correct);
    const grading: any = { pointValue: Math.max(0, Math.round(q.points || 1)) };
    let question: any;
    if (q.answers.length) {
      const type = correct.length > 1 ? "CHECKBOX" : "RADIO";
      question = { required: false, grading, choiceQuestion: { type, options: q.answers.map((a) => ({ value: a.text.slice(0, 500) || "—" })), shuffle: false } };
      if (correct.length) grading.correctAnswers = { answers: correct.map((a) => ({ value: a.text.slice(0, 500) || "—" })) };
    } else {
      const paragraph = !(q.itemType ?? "").toLowerCase().includes("short");
      question = { required: false, grading, textQuestion: { paragraph } };
    }
    reqs.push({ createItem: { item: { title: q.text.replace(/\s+/g, " ").trim().slice(0, 4000) || `Question ${i + 1}`, questionItem: { question } }, location: { index: i } } });
  });
  return reqs;
}
