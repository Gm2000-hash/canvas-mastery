import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, BorderStyle, PageBreak } from "docx";
import { saveAs } from "file-saver";
import type { CurriculumLesson } from "@/modules/curriculum/hooks/useCurriculum";

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, color: "0A7AFF" })],
  });
}

function bodyText(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: 360 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function buildCurriculumLessonParagraphs(lesson: CurriculumLesson, index: number): Paragraph[] {
  const paras: Paragraph[] = [];

  // Page break for lessons after the first
  if (index > 0) {
    paras.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // Lesson heading
  paras.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 100 },
      children: [
        new TextRun({ text: `Lesson ${index + 1}: ${lesson.title}`, bold: true, size: 28 }),
      ],
    })
  );

  // Separator
  paras.push(new Paragraph({
    spacing: { after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC", space: 1 } },
    children: [],
  }));

  // Objectives
  const objectives = (lesson.objectives as string[]) || [];
  if (objectives.length > 0) {
    paras.push(sectionTitle("Learning Objectives"));
    objectives.forEach((obj, i) => {
      paras.push(bodyText(`${i + 1}. ${obj}`));
    });
  }

  // Key Terms
  const keyTerms = (lesson.key_terms as { term: string; definition: string }[]) || [];
  if (keyTerms.length > 0) {
    paras.push(sectionTitle("Key Terms"));
    keyTerms.forEach(kt => {
      paras.push(new Paragraph({
        spacing: { before: 40, after: 40 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: kt.term, bold: true, size: 22 }),
          new TextRun({ text: ` — ${kt.definition}`, size: 22 }),
        ],
      }));
    });
  }

  // Introduction
  const intro = (lesson.intro as string[]) || [];
  if (intro.length > 0) {
    paras.push(sectionTitle("Introduction"));
    intro.forEach(p => paras.push(bodyText(p)));
  }

  // Explanation
  const explanation = (lesson.explanation as string[]) || [];
  if (explanation.length > 0) {
    paras.push(sectionTitle("Explanation"));
    explanation.forEach(p => paras.push(bodyText(p)));
  }

  // Reading passage
  if (lesson.reading_title) {
    paras.push(sectionTitle("Reading: " + lesson.reading_title));
    const readingParagraphs = (lesson.reading_paragraphs as string[]) || [];
    readingParagraphs.forEach(p => {
      paras.push(new Paragraph({
        spacing: { after: 120 },
        indent: { left: 360 },
        children: [new TextRun({ text: p, size: 22 })],
      }));
    });
  }

  return paras;
}

export async function exportCurriculumLessonToDocx(lesson: CurriculumLesson) {
  const children = buildCurriculumLessonParagraphs(lesson, 0);

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const safeName = lesson.title.replace(/[^a-zA-Z0-9]/g, "_");
  saveAs(blob, `${safeName}_Curriculum_Lesson.docx`);
}

export async function exportCurriculumUnitToDocx(
  unit: { title: string; discipline?: string | null; grade_level?: string | null; description?: string | null },
  lessons: CurriculumLesson[]
) {
  const children: Paragraph[] = [];

  // Title
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: unit.title, bold: true, size: 36 })],
  }));

  // Meta
  const meta = [unit.discipline, unit.grade_level].filter(Boolean).join(" • ");
  if (meta) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
      children: [new TextRun({ text: meta, size: 24, color: "666666" })],
    }));
  }

  if (unit.description) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: unit.description, size: 22, italics: true })],
    }));
  }

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [new TextRun({ text: `${lessons.length} Lessons`, size: 22, color: "666666" })],
  }));

  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "333333", space: 1 } },
    children: [],
  }));

  // Lessons
  lessons.forEach((lesson, idx) => {
    children.push(...buildCurriculumLessonParagraphs(lesson, idx));
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const safeName = unit.title.replace(/[^a-zA-Z0-9]/g, "_");
  saveAs(blob, `${safeName}_Curriculum.docx`);
}
