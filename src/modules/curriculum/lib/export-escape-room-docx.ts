import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, BorderStyle } from "docx";
import { saveAs } from "file-saver";

interface Puzzle {
  room_number: number;
  room_name: string;
  narrative_text: string;
  scenario_text?: string;
  challenge_steps?: string[];
  story_transition?: string;
  puzzle_type: string;
  question_text: string;
  hints: string[];
  lock_code: string;
  lock_code_explanation: string;
  form_section_instructions: string;
  distractors: string[];
}

interface EscapeRoom {
  theme_title: string;
  narrative_intro: string;
  google_form_setup: string;
  puzzles: Puzzle[];
  answer_key_summary: string;
  estimated_time_minutes: number;
}

const BLUE = "0A7AFF";
const GRAY = "666666";
const GREEN = "16A34A";
const RED = "DC2626";
const AMBER = "D97706";

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, color: BLUE })],
  });
}

function bodyText(text: string, indent = 360): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: indent },
    children: [new TextRun({ text, size: 22 })],
  });
}

function separator(): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC", space: 1 } },
    children: [],
  });
}

function buildPuzzleShared(puzzle: Puzzle, includeAnswers: boolean): Paragraph[] {
  const paras: Paragraph[] = [];

  // Room heading
  paras.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 80 },
    children: [
      new TextRun({ text: `Room ${puzzle.room_number}: ${puzzle.room_name}`, bold: true, size: 28 }),
      new TextRun({ text: `  [${puzzle.puzzle_type}]`, size: 20, color: GRAY }),
    ],
  }));

  // Narrative / Story
  paras.push(new Paragraph({
    spacing: { before: 80, after: 40 },
    indent: { left: 360 },
    children: [new TextRun({ text: "📖 Story", bold: true, size: 22, color: BLUE })],
  }));
  paras.push(bodyText(puzzle.narrative_text));

  // Scientific Scenario
  if (puzzle.scenario_text) {
    paras.push(new Paragraph({
      spacing: { before: 120, after: 40 },
      indent: { left: 360 },
      children: [new TextRun({ text: "🔬 Scientific Scenario", bold: true, size: 22, color: BLUE })],
    }));
    paras.push(bodyText(puzzle.scenario_text));
  }

  // Challenge Steps
  if (puzzle.challenge_steps && puzzle.challenge_steps.length > 0) {
    paras.push(new Paragraph({
      spacing: { before: 120, after: 40 },
      indent: { left: 360 },
      children: [new TextRun({ text: "🧩 Challenge Steps", bold: true, size: 22, color: AMBER })],
    }));
    puzzle.challenge_steps.forEach((step, i) => {
      paras.push(new Paragraph({
        spacing: { after: 60 },
        indent: { left: 720 },
        children: [
          new TextRun({ text: `Step ${i + 1}: `, bold: true, size: 22 }),
          new TextRun({ text: step, size: 22 }),
        ],
      }));
    });
  }

  // Legacy question_text fallback
  if (!puzzle.challenge_steps?.length && puzzle.question_text) {
    paras.push(new Paragraph({
      spacing: { before: 120, after: 80 },
      indent: { left: 360 },
      children: [
        new TextRun({ text: "🧩 Puzzle: ", bold: true, size: 22 }),
        new TextRun({ text: puzzle.question_text, size: 22 }),
      ],
    }));
  }

  // Answer options
  if (puzzle.distractors?.length > 0) {
    const allOptions = [...puzzle.distractors, puzzle.lock_code].sort();
    paras.push(new Paragraph({
      spacing: { before: 80, after: 40 },
      indent: { left: 360 },
      children: [new TextRun({ text: "Options:", bold: true, size: 22 })],
    }));
    allOptions.forEach((opt, i) => {
      const isCorrect = opt === puzzle.lock_code;
      paras.push(new Paragraph({
        indent: { left: 720 },
        spacing: { after: 30 },
        children: [
          new TextRun({
            text: `${String.fromCharCode(65 + i)}) ${opt}${includeAnswers && isCorrect ? "  ✅ CORRECT" : ""}`,
            size: 22,
            bold: includeAnswers && isCorrect,
            color: includeAnswers && isCorrect ? GREEN : undefined,
            highlight: includeAnswers && isCorrect ? "yellow" : undefined,
          }),
        ],
      }));
    });
  }

  // Lock code line
  if (includeAnswers) {
    paras.push(new Paragraph({
      spacing: { before: 80, after: 40 },
      indent: { left: 360 },
      children: [
        new TextRun({ text: "🔑 Answer: ", bold: true, size: 22 }),
        new TextRun({ text: puzzle.lock_code, bold: true, size: 22, color: GREEN, highlight: "yellow" }),
      ],
    }));
    paras.push(new Paragraph({
      indent: { left: 360 },
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "Explanation: ", bold: true, size: 20, color: GRAY }),
        new TextRun({ text: puzzle.lock_code_explanation, size: 20, color: GRAY }),
      ],
    }));
  } else {
    paras.push(new Paragraph({
      spacing: { before: 120, after: 40 },
      indent: { left: 360 },
      children: [
        new TextRun({ text: "🔑 Enter Lock Code: ", bold: true, size: 22 }),
        new TextRun({ text: "_______________", size: 22 }),
      ],
    }));
  }

  // Hints
  if (puzzle.hints?.length > 0) {
    paras.push(new Paragraph({
      spacing: { before: 100, after: 40 },
      indent: { left: 360 },
      children: [new TextRun({ text: "💡 Hints:", bold: true, size: 20, color: GRAY })],
    }));
    puzzle.hints.forEach((h, i) => {
      paras.push(new Paragraph({
        indent: { left: 720 },
        spacing: { after: 30 },
        children: [new TextRun({ text: `${i + 1}. ${h}`, size: 20, color: GRAY, italics: true })],
      }));
    });
  }

  // Story transition
  if (puzzle.story_transition) {
    paras.push(new Paragraph({
      spacing: { before: 100, after: 40 },
      indent: { left: 360 },
      children: [new TextRun({ text: "➡️ What Happens Next:", bold: true, size: 20 })],
    }));
    paras.push(new Paragraph({
      indent: { left: 720 },
      spacing: { after: 60 },
      children: [new TextRun({ text: puzzle.story_transition, size: 20, italics: true })],
    }));
  }

  // Form setup (teacher only)
  if (includeAnswers) {
    paras.push(new Paragraph({
      indent: { left: 360 },
      spacing: { before: 60, after: 60 },
      children: [
        new TextRun({ text: "Form Section: ", bold: true, size: 20 }),
        new TextRun({ text: puzzle.form_section_instructions, size: 20 }),
      ],
    }));
  }

  paras.push(separator());
  return paras;
}

function buildStudentVersion(escapeRoom: EscapeRoom): Paragraph[] {
  const paras: Paragraph[] = [];

  paras.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: `🔐 ${escapeRoom.theme_title}`, bold: true, size: 36 })],
  }));
  paras.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: `Estimated Time: ~${escapeRoom.estimated_time_minutes} minutes`, size: 22, color: GRAY })],
  }));
  paras.push(separator());

  paras.push(sectionHeading("📖 Your Mission"));
  paras.push(bodyText(escapeRoom.narrative_intro));
  paras.push(separator());

  for (const puzzle of escapeRoom.puzzles) {
    paras.push(...buildPuzzleShared(puzzle, false));
  }

  return paras;
}

function buildTeacherVersion(escapeRoom: EscapeRoom): Paragraph[] {
  const paras: Paragraph[] = [];

  paras.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: `🔐 ${escapeRoom.theme_title}`, bold: true, size: 36 })],
  }));
  paras.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: "TEACHER ANSWER KEY & SETUP GUIDE", bold: true, size: 24, color: RED })],
  }));
  paras.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: `~${escapeRoom.estimated_time_minutes} minutes`, size: 22, color: GRAY })],
  }));
  paras.push(separator());

  // Quick Answer Key
  paras.push(sectionHeading("🗝️ Quick Answer Key"));
  for (const puzzle of escapeRoom.puzzles) {
    paras.push(new Paragraph({
      indent: { left: 360 },
      spacing: { after: 50 },
      children: [
        new TextRun({ text: `Room ${puzzle.room_number}: `, bold: true, size: 22 }),
        new TextRun({ text: puzzle.lock_code, bold: true, size: 22, color: GREEN }),
        new TextRun({ text: ` — ${puzzle.lock_code_explanation}`, size: 20, color: GRAY }),
      ],
    }));
  }
  paras.push(separator());

  // Google Form Setup
  paras.push(sectionHeading("📋 Google Form Setup Instructions"));
  escapeRoom.google_form_setup.split("\n").filter(Boolean).forEach(line => {
    paras.push(bodyText(line));
  });
  paras.push(separator());

  // Detailed puzzles
  paras.push(sectionHeading("📝 Detailed Room Breakdown"));
  for (const puzzle of escapeRoom.puzzles) {
    paras.push(...buildPuzzleShared(puzzle, true));
  }

  // Full answer key summary
  paras.push(sectionHeading("📊 Answer Key Summary"));
  escapeRoom.answer_key_summary.split("\n").filter(Boolean).forEach(line => {
    paras.push(bodyText(line));
  });

  return paras;
}

export async function exportEscapeRoomToDocx(escapeRoom: EscapeRoom, version: "student" | "teacher" | "both" = "both") {
  const safeName = escapeRoom.theme_title.replace(/[^a-zA-Z0-9]/g, "_");

  if (version === "both") {
    const doc = new Document({
      sections: [
        { children: buildStudentVersion(escapeRoom) },
        { children: buildTeacherVersion(escapeRoom) },
      ],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${safeName}_Escape_Room.docx`);
  } else if (version === "student") {
    const doc = new Document({ sections: [{ children: buildStudentVersion(escapeRoom) }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${safeName}_Student.docx`);
  } else {
    const doc = new Document({ sections: [{ children: buildTeacherVersion(escapeRoom) }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${safeName}_Teacher_Key.docx`);
  }
}
