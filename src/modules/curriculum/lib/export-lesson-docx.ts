import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, BorderStyle } from "docx";
import { KOLB_STAGE_LABELS } from "@/modules/curriculum/components/ActivityList";
import { saveAs } from "file-saver";

interface Activity {
  name: string;
  duration: number;
  description: string;
  type?: string;
  rationale?: string;
}

interface VocabScaffold {
  term: string;
  student_friendly: string;
  visual_cue: string;
}

interface UdlSupports {
  lesson_flow?: string;
  vocabulary_scaffolds?: VocabScaffold[];
  reflection_prompt?: string;
  // Legacy fields (back-compat read-only)
  engagement?: any;
  representation?: { vocabulary_scaffolds?: VocabScaffold[]; [k: string]: any };
  action_expression?: any;
}

interface LessonPlan {
  id: string;
  title: string;
  lesson_date: string | null;
  duration_minutes: number;
  objectives: string;
  activities: Activity[];
  materials: string;
  assessment: string;
  differentiation: string;
  notes: string;
  vocabulary?: { term: string; definition: string }[];
  standards?: { ngss_code: string; ngss_description: string }[];
  udl_supports?: UdlSupports;
}

interface Unit {
  title: string;
  description: string;
  grade_level: string;
  discipline: string;
  date_start: string | null;
  date_end: string | null;
}

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

function buildLessonParagraphs(lesson: LessonPlan, index: number): Paragraph[] {
  const paras: Paragraph[] = [];

  // Lesson heading
  paras.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 100 },
      children: [
        new TextRun({ text: `Lesson ${index + 1}: ${lesson.title}`, bold: true, size: 28 }),
        ...(lesson.lesson_date
          ? [new TextRun({ text: `  (${lesson.lesson_date})`, size: 22, color: "666666" })]
          : []),
        new TextRun({ text: `  •  ${lesson.duration_minutes} min`, size: 22, color: "666666" }),
      ],
    })
  );

  // Separator
  paras.push(new Paragraph({
    spacing: { after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC", space: 1 } },
    children: [],
  }));

  // Standards
  if (lesson.standards && lesson.standards.length > 0) {
    paras.push(sectionTitle("NGSS Standards"));
    lesson.standards.forEach(s => {
      paras.push(bodyText(`${s.ngss_code} — ${s.ngss_description}`));
    });
  }

  // Objectives
  if (lesson.objectives) {
    paras.push(sectionTitle("Learning Objectives"));
    lesson.objectives.split("\n").filter(Boolean).forEach(line => paras.push(bodyText(line)));
  }

  // Key Vocabulary
  if (lesson.vocabulary && lesson.vocabulary.length > 0) {
    paras.push(sectionTitle("Key Vocabulary"));
    lesson.vocabulary.forEach(v => {
      paras.push(new Paragraph({
        spacing: { before: 40, after: 40 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: v.term, bold: true, size: 22 }),
          new TextRun({ text: ` — ${v.definition}`, size: 22 }),
        ],
      }));
    });
  }

  // ─── PRIMARY: Lesson Flow (UDL-Aligned) ───────────────────────────────
  const udl = lesson.udl_supports;
  const hasLessonFlow = !!udl?.lesson_flow && udl.lesson_flow.trim().length > 0;

  if (hasLessonFlow) {
    paras.push(sectionTitle("Lesson Flow (UDL-Aligned)"));
    // Strip HTML tags into plain lines while preserving paragraph + list structure.
    const html = udl!.lesson_flow!;
    const blocks = html
      .replace(/<\/(p|h1|h2|h3|h4|li|div)>/gi, "\n")
      .replace(/<br\s*\/?>(?!\n)/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);
    blocks.forEach(line => paras.push(bodyText(line)));
  } else {
    // ─── LEGACY FALLBACK: render the older fragmented sections ──────────
    if (lesson.activities.length > 0) {
      paras.push(sectionTitle("Activities & Timing"));
      lesson.activities.forEach(act => {
        paras.push(new Paragraph({
          spacing: { before: 80, after: 40 },
          indent: { left: 360 },
          children: [
            new TextRun({ text: `${act.name}`, bold: true, size: 22 }),
            new TextRun({ text: ` (${act.duration} min)`, size: 20, color: "666666" }),
            ...(act.type && KOLB_STAGE_LABELS[act.type]
              ? [new TextRun({ text: `  ·  ${KOLB_STAGE_LABELS[act.type]}`, size: 18, color: "8A5A00" })]
              : []),
          ],
        }));
        if (act.description) {
          paras.push(new Paragraph({
            indent: { left: 720 },
            spacing: { after: 60 },
            children: [new TextRun({ text: act.description, size: 20 })],
          }));
        }
        if (act.rationale) {
          paras.push(new Paragraph({
            indent: { left: 720 },
            spacing: { after: 80 },
            children: [new TextRun({ text: `Why this works: ${act.rationale}`, size: 18, italics: true, color: "555555" })],
          }));
        }
      });
    }
    if (lesson.assessment) {
      paras.push(sectionTitle("Assessment"));
      lesson.assessment.split("\n").filter(Boolean).forEach(line => paras.push(bodyText(line)));
    }
    if (lesson.differentiation) {
      paras.push(sectionTitle("Differentiation"));
      lesson.differentiation.split("\n").filter(Boolean).forEach(line => paras.push(bodyText(line)));
    }
  }

  // Materials (always)
  if (lesson.materials) {
    paras.push(sectionTitle("Materials & Resources"));
    lesson.materials.split("\n").filter(Boolean).forEach(line => paras.push(bodyText(line)));
  }

  // Notes (always)
  if (lesson.notes) {
    paras.push(sectionTitle("Teacher Notes"));
    lesson.notes.split("\n").filter(Boolean).forEach(line => paras.push(bodyText(line)));
  }

  // ─── UDL Reference Details ─────────────────────────────────────────────
  const scaffolds = udl?.vocabulary_scaffolds || udl?.representation?.vocabulary_scaffolds || [];
  if (scaffolds.length > 0 || udl?.reflection_prompt) {
    paras.push(sectionTitle("UDL Reference Details"));
    if (scaffolds.length > 0) {
      paras.push(new Paragraph({
        spacing: { before: 60, after: 20 },
        indent: { left: 360 },
        children: [new TextRun({ text: "Vocabulary Scaffolds", bold: true, size: 20 })],
      }));
      scaffolds.forEach(vs => {
        paras.push(new Paragraph({
          spacing: { after: 20 },
          indent: { left: 720 },
          children: [
            new TextRun({ text: `${vs.term}: `, bold: true, size: 20 }),
            new TextRun({ text: vs.student_friendly, size: 20 }),
            new TextRun({ text: ` (cue: ${vs.visual_cue})`, italics: true, size: 18, color: "666666" }),
          ],
        }));
      });
    }
    if (udl?.reflection_prompt) {
      paras.push(new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: "Closing Reflection Prompt", bold: true, size: 22, color: "7E22CE" })],
      }));
      paras.push(bodyText(udl.reflection_prompt));
    }
  }

  return paras;
}

export async function exportUnitToDocx(unit: Unit, lessons: LessonPlan[]) {
  const children: Paragraph[] = [];

  // Title
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: unit.title, bold: true, size: 36 })],
  }));

  // Subtitle
  const meta = [unit.discipline, unit.grade_level].filter(Boolean).join(" • ");
  if (meta) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
      children: [new TextRun({ text: meta, size: 24, color: "666666" })],
    }));
  }

  // Date range
  if (unit.date_start) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
      children: [new TextRun({ text: `${unit.date_start}${unit.date_end ? " – " + unit.date_end : ""}`, size: 22, color: "666666" })],
    }));
  }

  // Description
  if (unit.description) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: unit.description, size: 22, italics: true })],
    }));
  }

  // Info line
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [new TextRun({ text: `${lessons.length} Lessons`, size: 22, color: "666666" })],
  }));

  // Separator
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "333333", space: 1 } },
    children: [],
  }));

  // Lessons
  lessons.forEach((lesson, idx) => {
    children.push(...buildLessonParagraphs(lesson, idx));
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const safeName = unit.title.replace(/[^a-zA-Z0-9]/g, "_");
  saveAs(blob, `${safeName}_Unit_Plan.docx`);
}

export async function exportLessonToDocx(lesson: LessonPlan) {
  const children: Paragraph[] = [];

  // Title
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 100 },
    children: [new TextRun({ text: lesson.title, bold: true, size: 36 })],
  }));

  // Meta line
  const metaParts: string[] = [];
  if (lesson.lesson_date) metaParts.push(lesson.lesson_date);
  metaParts.push(`${lesson.duration_minutes} minutes`);
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: metaParts.join("  •  "), size: 22, color: "666666" })],
  }));

  // Separator
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "333333", space: 1 } },
    spacing: { after: 100 },
    children: [],
  }));

  children.push(...buildLessonParagraphs(lesson, 0).slice(2)); // skip heading + separator since we already have them

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const safeName = lesson.title.replace(/[^a-zA-Z0-9]/g, "_");
  saveAs(blob, `${safeName}_Lesson_Plan.docx`);
}
