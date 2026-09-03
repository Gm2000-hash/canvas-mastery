import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { ActivityType, ActivityContent } from "./h5p-types";

/**
 * Maps our internal activity types to H5P library machine names.
 */
const H5P_LIBRARY_MAP: Record<ActivityType, { machineName: string; majorVersion: number; minorVersion: number }> = {
  fill_in_blanks: { machineName: "H5P.Blanks", majorVersion: 1, minorVersion: 14 },
  drag_the_words: { machineName: "H5P.DragText", majorVersion: 1, minorVersion: 10 },
  accordion: { machineName: "H5P.Accordion", majorVersion: 1, minorVersion: 0 },
  timeline: { machineName: "H5P.Timeline", majorVersion: 1, minorVersion: 1 },
  multiple_choice: { machineName: "H5P.MultiChoice", majorVersion: 1, minorVersion: 16 },
  true_false: { machineName: "H5P.TrueFalse", majorVersion: 1, minorVersion: 8 },
  single_choice_set: { machineName: "H5P.SingleChoiceSet", majorVersion: 1, minorVersion: 11 },
  mark_the_words: { machineName: "H5P.MarkTheWords", majorVersion: 1, minorVersion: 11 },
  essay: { machineName: "H5P.Essay", majorVersion: 1, minorVersion: 5 },
  summary: { machineName: "H5P.Summary", majorVersion: 1, minorVersion: 10 },
  dialog_cards: { machineName: "H5P.DialogCards", majorVersion: 1, minorVersion: 9 },
  flashcards: { machineName: "H5P.Flashcards", majorVersion: 1, minorVersion: 7 },
  memory_game: { machineName: "H5P.MemoryGame", majorVersion: 1, minorVersion: 3 },
  arithmetic_quiz: { machineName: "H5P.ArithmeticQuiz", majorVersion: 1, minorVersion: 1 },
  drag_and_drop: { machineName: "H5P.DragQuestion", majorVersion: 1, minorVersion: 14 },
  question_set: { machineName: "H5P.QuestionSet", majorVersion: 1, minorVersion: 20 },
  personality_quiz: { machineName: "H5P.PersonalityQuiz", majorVersion: 1, minorVersion: 0 },
  game_map: { machineName: "H5P.GameMap", majorVersion: 1, minorVersion: 0 },
  column: { machineName: "H5P.Column", majorVersion: 1, minorVersion: 16 },
  course_presentation: { machineName: "H5P.CoursePresentation", majorVersion: 1, minorVersion: 25 },
  documentation_tool: { machineName: "H5P.DocumentationTool", majorVersion: 1, minorVersion: 8 },
  image_hotspots: { machineName: "H5P.ImageHotspots", majorVersion: 1, minorVersion: 10 },
  interactive_book: { machineName: "H5P.InteractiveBook", majorVersion: 1, minorVersion: 7 },
  interactive_video: { machineName: "H5P.InteractiveVideo", majorVersion: 1, minorVersion: 26 },
  virtual_tour: { machineName: "H5P.ThreeImage", majorVersion: 0, minorVersion: 6 },
  crossword: { machineName: "H5P.Crossword", majorVersion: 0, minorVersion: 4 },
  agamotto: { machineName: "H5P.Agamotto", majorVersion: 1, minorVersion: 5 },
};

export async function exportActivityAsH5P(
  title: string,
  activityType: ActivityType,
  content: ActivityContent,
) {
  const lib = H5P_LIBRARY_MAP[activityType];
  if (!lib) throw new Error(`Unsupported activity type: ${activityType}`);

  const zip = new JSZip();

  // h5p.json — H5P metadata
  const h5pJson = {
    title,
    language: "en",
    mainLibrary: lib.machineName,
    preloadedDependencies: [
      { machineName: lib.machineName, majorVersion: lib.majorVersion, minorVersion: lib.minorVersion },
    ],
    embedTypes: ["div"],
    license: "U",
  };
  zip.file("h5p.json", JSON.stringify(h5pJson, null, 2));

  // content/content.json — the actual activity content
  zip.file("content/content.json", JSON.stringify(content, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.h5p`);
}

export async function exportMultipleActivitiesAsH5P(
  activities: { title: string; activityType: ActivityType; content: ActivityContent }[],
  filename: string,
) {
  const zip = new JSZip();

  activities.forEach((act, idx) => {
    const lib = H5P_LIBRARY_MAP[act.activityType];
    if (!lib) return;

    const folder = zip.folder(`activity-${idx + 1}`)!;

    folder.file("h5p.json", JSON.stringify({
      title: act.title,
      language: "en",
      mainLibrary: lib.machineName,
      preloadedDependencies: [
        { machineName: lib.machineName, majorVersion: lib.majorVersion, minorVersion: lib.minorVersion },
      ],
      embedTypes: ["div"],
      license: "U",
    }, null, 2));

    folder.file("content/content.json", JSON.stringify(act.content, null, 2));
  });

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${filename.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.zip`);
}
