import {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Packer, PageBreak, ExternalHyperlink, ShadingType,
} from "docx";
import { saveAs } from "file-saver";
import type { CurriculumLesson } from "@/modules/curriculum/hooks/useCurriculum";

/* ─── Helpers ─── */

function stripHtml(html: string): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

function isEmbed(html: string): boolean {
  return /<iframe\b/i.test(html);
}

/** Pull a src URL out of an iframe HTML string (best-effort) */
function extractIframeSrc(html: string): string | null {
  const m = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

/** Headings teachers will recognize for the 5-act arc.
 *  We don't print these in classroom-facing output, but we DO use them
 *  in the export so teachers can see structure when reviewing offline. */
const FIVE_ACT_LABELS = [
  "Act 1 — Exposition",
  "Act 2 — Rising Action",
  "Act 3 — Climax",
  "Act 4 — Falling Action",
  "Act 5 — Denouement",
];

/** Distribute reading paragraphs into the 5 acts using the contract:
 *  Act1 ≈ 2, Act2 ≈ 3-4, Act3 ≈ 2-3, Act4 ≈ 3-4, Act5 ≈ 2-3.
 *  Anything left over (UDL closing block etc.) goes into a final "Closing" bucket.
 *  This is best-effort — if the AI deviated, paragraphs still all get printed. */
function splitIntoActs(paragraphs: string[]): { acts: string[][]; closing: string[] } {
  const total = paragraphs.length;
  // Default per-act paragraph budget (sums to ~14)
  const budget = total >= 14
    ? [2, 4, 3, 3, 2] // generous
    : total >= 12
    ? [2, 3, 2, 3, 2] // tight
    : total >= 10
    ? [2, 3, 2, 2, 1]
    : [Math.max(1, Math.floor(total / 5)), Math.ceil(total / 5), Math.ceil(total / 5), Math.ceil(total / 5), Math.max(1, Math.floor(total / 5))];

  const acts: string[][] = [[], [], [], [], []];
  let i = 0;
  for (let a = 0; a < 5; a++) {
    const take = budget[a];
    for (let k = 0; k < take && i < total; k++, i++) {
      acts[a].push(paragraphs[i]);
    }
  }
  const closing = paragraphs.slice(i);
  return { acts, closing };
}

/* ─── Reusable docx blocks ─── */

const HEX = {
  primary: "1A5276",
  secondary: "2C3E50",
  accent: "B9770E",
  muted: "555555",
  rule: "CCCCCC",
  shade: "F4F6F8",
};

function H1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 180 },
    children: [new TextRun({ text, bold: true, size: 36, color: HEX.primary })],
  });
}

function H2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28, color: HEX.primary })],
  });
}

function H3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, color: HEX.secondary })],
  });
}

function ActHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: HEX.shade },
    children: [new TextRun({ text, bold: true, size: 24, color: HEX.accent, allCaps: true })],
  });
}

function P(text: string, opts: { italics?: boolean; size?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 140, line: 300 },
    children: [new TextRun({ text, italics: opts.italics, size: opts.size ?? 22 })],
  });
}

function Muted(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, italics: true, size: 20, color: HEX.muted })],
  });
}

function Bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function HyperlinkP(label: string, url: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    bullet: { level: 0 },
    children: [
      new TextRun({ text: `${label} — `, size: 22 }),
      new ExternalHyperlink({
        link: url,
        children: [new TextRun({ text: url, size: 22, color: "1A73E8", underline: { type: "single" } })],
      }),
    ],
  });
}

function PageBreakP(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

/* ─── Citation building ─── */

interface SourceEntry {
  label: string;
  url: string;
  type: "embedded-video" | "embedded-activity" | "embedded-media";
}

function collectEmbeddedSources(lesson: CurriculumLesson): SourceEntry[] {
  const all: string[] = [
    ...((lesson.intro as string[]) || []),
    ...((lesson.explanation as string[]) || []),
    ...((lesson.reading_paragraphs as string[]) || []),
  ];
  const sources: SourceEntry[] = [];
  for (const html of all) {
    if (!isEmbed(html)) continue;
    const src = extractIframeSrc(html);
    if (!src) continue;
    let type: SourceEntry["type"] = "embedded-media";
    let label = "Embedded media";
    if (/youtube\.com|youtu\.be/i.test(src)) { type = "embedded-video"; label = "YouTube video"; }
    else if (/vimeo\.com/i.test(src)) { type = "embedded-video"; label = "Vimeo video"; }
    else if (/h5p|activity|interactive/i.test(src)) { type = "embedded-activity"; label = "Embedded activity"; }
    sources.push({ label, url: src, type });
  }
  return sources;
}

/** Today's date in citation form: "Accessed Month D, YYYY" */
function accessedToday(): string {
  const d = new Date();
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/* ─── Sources & Citations page ─── */

function buildSourcesPage(
  lesson: CurriculumLesson,
  standards: { ngss_code: string; ngss_description: string }[],
): Paragraph[] {
  const out: Paragraph[] = [];
  const embeds = collectEmbeddedSources(lesson);
  const today = accessedToday();

  out.push(PageBreakP());
  out.push(H1("Sources, Citations & Further Reading"));
  out.push(Muted(`Compiled ${today} — for teacher reference and student bibliography practice.`));

  // Standards alignment
  if (standards.length > 0) {
    out.push(H2("Standards alignment"));
    for (const s of standards) {
      out.push(Bullet(`${s.ngss_code} — ${s.ngss_description}`));
    }
    out.push(Muted("NGSS Lead States. (2013). Next Generation Science Standards: For States, By States. Washington, DC: The National Academies Press. https://www.nextgenscience.org"));
  }

  // Scientist roster reference (drives Act 2 of every reading)
  out.push(H2("Scientist roster reference"));
  out.push(P(
    "This reading prioritizes one of ten historically documented scientists drawn from Discover Magazine's profile of major figures in the history of science. If a different scientist appears, they were chosen because the targeted standard required someone closer to the source of the discovery."
  ));
  out.push(HyperlinkP(
    "Discover Magazine — The 10 Greatest Scientists of All Time",
    "https://www.discovermagazine.com/the-10-greatest-scientists-of-all-time-919",
  ));

  // Embedded media
  if (embeds.length > 0) {
    out.push(H2("Embedded media in this reading"));
    for (const e of embeds) {
      out.push(HyperlinkP(e.label, e.url));
    }
  }

  // Suggested student-facing citation format
  out.push(H2("Citation format for students"));
  out.push(P("For any source above that you reference in your own writing, use this APA-style template:"));
  out.push(P("Author Last, First Initial. (Year). Title of work. Publisher or Site Name. URL", { italics: true }));
  out.push(P("Example:"));
  out.push(P("NGSS Lead States. (2013). Next Generation Science Standards: For States, By States. The National Academies Press. https://www.nextgenscience.org", { italics: true }));

  // Generation provenance
  out.push(H2("About this reading"));
  out.push(P(
    "This narrative was generated using a five-act storytelling framework (Exposition → Rising Action → Climax → Falling Action → Denouement) designed to humanize scientific concepts while preserving technical rigor. The structure is invisible to students and acts as scaffolding for teachers reviewing the text."
  ));
  out.push(Muted(`Reading: "${stripHtml(lesson.reading_title || lesson.title)}" · Lesson: "${stripHtml(lesson.title)}" · Exported ${today}`));

  return out;
}

/* ─── Lesson body ─── */

function buildLessonBody(
  lesson: CurriculumLesson,
  opts: Required<ReadingExportOptions>,
): Paragraph[] {
  const out: Paragraph[] = [];

  const objectives = (lesson.objectives as string[]) || [];
  const keyTerms = (lesson.key_terms as { term: string; definition: string }[]) || [];
  const intro = (lesson.intro as string[]) || [];
  const explanation = (lesson.explanation as string[]) || [];
  const readingParagraphs = (lesson.reading_paragraphs as string[]) || [];
  const readingTitle = lesson.reading_title || "Reading";

  // Title block
  out.push(H1(stripHtml(lesson.title)));
  if (lesson.reading_title) {
    out.push(Muted(stripHtml(lesson.reading_title)));
  }

  // Learning objectives
  if (opts.includeObjectives && objectives.length > 0) {
    out.push(H2("Learning Objectives"));
    for (const o of objectives) {
      const text = stripHtml(o);
      if (text) out.push(Bullet(text));
    }
  }

  // Key terms
  if (opts.includeKeyTerms && keyTerms.length > 0) {
    out.push(H2("Key Terms"));
    for (const kt of keyTerms) {
      const term = stripHtml(kt.term);
      const def = stripHtml(kt.definition);
      if (!term && !def) continue;
      out.push(new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: `${term}: `, bold: true, size: 22 }),
          new TextRun({ text: def, size: 22 }),
        ],
      }));
    }
  }

  // Intro
  if (opts.includeIntro && intro.length > 0) {
    out.push(H2("Introduction"));
    for (const p of intro) {
      const text = stripHtml(p);
      if (text) out.push(P(text));
    }
  }

  // Explanation
  if (opts.includeExplanation && explanation.length > 0) {
    out.push(H2("Explanation"));
    for (const p of explanation) {
      const text = stripHtml(p);
      if (text) out.push(P(text));
    }
  }

  // Reading — full 5-act arc with explicit act headings
  if (readingParagraphs.length > 0) {
    out.push(H2(stripHtml(readingTitle)));

    // Filter out embeds — they get listed on the sources page
    const proseOnly = readingParagraphs.filter(p => !isEmbed(p));
    const { acts, closing } = splitIntoActs(proseOnly);

    for (let i = 0; i < 5; i++) {
      if (acts[i].length === 0) continue;
      out.push(ActHeading(FIVE_ACT_LABELS[i]));
      for (const para of acts[i]) {
        const text = stripHtml(para);
        if (text) out.push(P(text));
      }
    }

    if (opts.includeClosingUdl && closing.length > 0) {
      out.push(ActHeading("Closing & UDL prompts"));
      for (const para of closing) {
        const text = stripHtml(para);
        if (text) out.push(P(text));
      }
    }

    // Note any embeds that got skipped
    const embedCount = readingParagraphs.length - proseOnly.length;
    if (embedCount > 0) {
      out.push(Muted(`(${embedCount} embedded media item${embedCount === 1 ? "" : "s"} in the original reading — links listed on the Sources page.)`));
    }
  }

  return out;
}

/* ─── Public API ─── */

export interface ReadingExportOptions {
  includeObjectives?: boolean;
  includeKeyTerms?: boolean;
  includeIntro?: boolean;
  includeExplanation?: boolean;
  includeClosingUdl?: boolean;
  includeSourcesPage?: boolean;
}

const DEFAULT_OPTIONS: Required<ReadingExportOptions> = {
  includeObjectives: true,
  includeKeyTerms: true,
  includeIntro: true,
  includeExplanation: true,
  includeClosingUdl: true,
  includeSourcesPage: true,
};

export async function exportReadingAsDocx(
  lesson: CurriculumLesson,
  standards: { ngss_code: string; ngss_description: string }[] = [],
  options: ReadingExportOptions = {},
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  try {
    const children: Paragraph[] = [
      ...buildLessonBody(lesson, opts),
      ...(opts.includeSourcesPage ? buildSourcesPage(lesson, standards) : []),
    ];

    const doc = new Document({
      creator: "Lovable Curriculum",
      title: stripHtml(lesson.title),
      description: stripHtml(lesson.reading_title || lesson.title),
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // US Letter
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    const safe = stripHtml(lesson.title).replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 60) || "Reading";
    saveAs(blob, `${safe}.docx`);
  } catch (err) {
    console.error("Failed to export reading as DOCX", err);
    throw err;
  }
}
