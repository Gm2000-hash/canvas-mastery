import type { CurriculumLesson } from "@/modules/curriculum/hooks/useCurriculum";
import { toast } from "sonner";
import { flattenEmbedsForExport } from "@/modules/curriculum/lib/sanitize-rich-html";

/** Strip HTML tags to plain text */
function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

/** Build a single lesson's HTML content */
function buildLessonHtml(lesson: CurriculumLesson, lessonIndex: number, includePageBreak: boolean): string {
  const objectives = (lesson.objectives as string[]) || [];
  const keyTerms = (lesson.key_terms as { term: string; definition: string }[]) || [];
  const intro = (lesson.intro as string[]) || [];
  const explanation = (lesson.explanation as string[]) || [];
  const readingParagraphs = (lesson.reading_paragraphs as string[]) || [];
  const readingTitle = lesson.reading_title || "Reading";

  let html = "";

  if (includePageBreak && lessonIndex > 0) {
    html += `<div style="page-break-before: always;"></div>`;
  }

  // Lesson title
  html += `<h2 style="color: #1a5276; margin-bottom: 4px; font-size: 20px; border-bottom: 2px solid #1a5276; padding-bottom: 6px;">
    Lesson ${lessonIndex + 1}: ${stripHtml(lesson.title)}
  </h2>`;

  // Objectives
  if (objectives.length > 0) {
    html += `<h3 style="color: #2c3e50; font-size: 14px; margin-top: 16px; margin-bottom: 6px;">Learning Objectives</h3>`;
    html += `<ul style="margin: 0 0 12px 20px; font-size: 12px; line-height: 1.6;">`;
    for (const obj of objectives) {
      html += `<li>${stripHtml(obj)}</li>`;
    }
    html += `</ul>`;
  }

  // Key Terms
  if (keyTerms.length > 0) {
    html += `<h3 style="color: #2c3e50; font-size: 14px; margin-top: 16px; margin-bottom: 6px;">Key Terms</h3>`;
    html += `<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px;">`;
    for (const kt of keyTerms) {
      html += `<tr>
        <td style="padding: 4px 8px; border: 1px solid #ddd; font-weight: 600; width: 30%; vertical-align: top;">${stripHtml(kt.term)}</td>
        <td style="padding: 4px 8px; border: 1px solid #ddd;">${stripHtml(kt.definition)}</td>
      </tr>`;
    }
    html += `</table>`;
  }

  // Introduction
  if (intro.length > 0) {
    html += `<h3 style="color: #2c3e50; font-size: 14px; margin-top: 16px; margin-bottom: 6px;">Introduction</h3>`;
    for (const p of intro) {
      html += `<div style="font-size: 12px; line-height: 1.7; margin-bottom: 8px;">${flattenEmbedsForExport(p)}</div>`;
    }
  }

  // Explanation
  if (explanation.length > 0) {
    html += `<h3 style="color: #2c3e50; font-size: 14px; margin-top: 16px; margin-bottom: 6px;">Explanation</h3>`;
    for (const p of explanation) {
      html += `<div style="font-size: 12px; line-height: 1.7; margin-bottom: 8px;">${flattenEmbedsForExport(p)}</div>`;
    }
  }

  // Reading Content
  if (readingParagraphs.length > 0) {
    html += `<h3 style="color: #2c3e50; font-size: 14px; margin-top: 16px; margin-bottom: 6px;">${stripHtml(readingTitle)}</h3>`;
    for (const p of readingParagraphs) {
      html += `<div style="font-size: 12px; line-height: 1.7; margin-bottom: 8px;">${flattenEmbedsForExport(p)}</div>`;
    }
  }

  return html;
}

/** Build a Table of Contents for full textbooks */
function buildTocHtml(lessons: CurriculumLesson[], unitMap: Record<string, string>): string {
  let html = `<h2 style="color: #1a5276; font-size: 20px; margin-bottom: 12px;">Table of Contents</h2>`;

  let currentUnit = "";
  lessons.forEach((lesson, i) => {
    const unitTitle = unitMap[lesson.unit_id] || "Unknown Unit";
    if (unitTitle !== currentUnit) {
      currentUnit = unitTitle;
      html += `<p style="font-size: 14px; font-weight: 600; color: #2c3e50; margin-top: 12px; margin-bottom: 4px;">${unitTitle}</p>`;
    }
    html += `<p style="font-size: 12px; margin: 2px 0 2px 20px; color: #555;">Lesson ${i + 1}: ${stripHtml(lesson.title)}</p>`;
  });

  html += `<div style="page-break-after: always;"></div>`;
  return html;
}

/** Open a print window with formatted HTML for PDF export */
function printHtml(html: string, documentTitle: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Pop-up blocked — please allow pop-ups for PDF export");
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${documentTitle}</title>
  <style>
    @media print {
      body { margin: 0; }
      @page { margin: 0.75in; size: letter; }
    }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      color: #333;
      max-width: 7in;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { font-size: 28px; text-align: center; color: #1a5276; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #777; font-size: 13px; margin-bottom: 24px; }
    img { max-width: 100%; height: auto; }
    table { page-break-inside: avoid; }
  </style>
</head>
<body>
  ${html}
  <script>
    // Auto-trigger print dialog after content loads
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  <\/script>
</body>
</html>`);
  printWindow.document.close();
}

/** Export a single reading/lesson as PDF */
export function exportReadingAsPdf(lesson: CurriculumLesson, lessonIndex: number) {
  const html = buildLessonHtml(lesson, lessonIndex, false);
  const title = `${stripHtml(lesson.title)} — Reading`;

  const fullHtml = `
    <h1>${stripHtml(lesson.title)}</h1>
    <p class="subtitle">Curriculum Reading</p>
    ${html}
  `;

  printHtml(fullHtml, title);
  toast.success("PDF print dialog opened — choose 'Save as PDF' to download");
}

/** Export all readings in a discipline as a full textbook PDF */
export function exportTextbookAsPdf(
  lessons: CurriculumLesson[],
  unitMap: Record<string, string>,
  disciplineTitle: string,
) {
  if (lessons.length === 0) {
    toast.error("No readings to export");
    return;
  }

  const toc = buildTocHtml(lessons, unitMap);
  const lessonsHtml = lessons
    .map((lesson, i) => buildLessonHtml(lesson, i, true))
    .join("");

  const fullHtml = `
    <h1>${stripHtml(disciplineTitle)}</h1>
    <p class="subtitle">Curriculum Textbook — ${lessons.length} Lesson${lessons.length !== 1 ? "s" : ""}</p>
    <div style="page-break-after: always;"></div>
    ${toc}
    ${lessonsHtml}
  `;

  printHtml(fullHtml, `${disciplineTitle} — Textbook`);
  toast.success("PDF print dialog opened — choose 'Save as PDF' to download");
}
