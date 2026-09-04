import questionsImg from "@/assets/library-questions.jpg";
import readingsImg from "@/assets/library-readings.jpg";
import activitiesImg from "@/assets/library-activities.jpg";
import lessonPlansImg from "@/assets/library-lesson-plans.jpg";

export type LibraryKind = "reading" | "activity" | "lesson_plan";
export type LibrarySection = "question" | LibraryKind;
export type LibrarySource = "upload" | "created" | "ai" | "canvas" | "google";

/** Where a resource lives on an external platform (Canvas / Google Classroom / Drive). */
export type ResourceLink = {
  id: string;
  platform: "canvas" | "google_classroom" | "google_drive";
  external_course_id: string | null;
  external_course_name: string | null;
  external_item_id: string;
  external_type: string;
  url: string | null;
  direction: "imported" | "exported";
  synced_at: string;
};

export const PLATFORM_LABEL: Record<ResourceLink["platform"], string> = { canvas: "Canvas", google_classroom: "Google Classroom", google_drive: "Google Drive" };

export type LibraryItem = {
  id: string;
  kind: LibraryKind;
  title: string;
  body: string | null;
  source: LibrarySource;
  file_path: string | null;
  file_mime: string | null;
  file_name: string | null;
  grade: string | null;
  subject: string | null;
  canvas_course_id: number | null;
  created_at: string;
  updated_at: string;
  dok_levels: number[];
  standards: { id: string; code: string; description: string }[];
  links?: ResourceLink[];
};

export const SECTIONS: { key: LibrarySection; label: string; singular: string; blurb: string; image: string }[] = [
  { key: "question", label: "Question bank", singular: "question", blurb: "Quiz questions imported from Canvas, organized by standard.", image: questionsImg },
  { key: "reading", label: "Readings", singular: "reading", blurb: "Passages, articles, and Canvas pages for students.", image: readingsImg },
  { key: "activity", label: "Activities", singular: "activity", blurb: "Labs, stations, and practice tasks.", image: activitiesImg },
  { key: "lesson_plan", label: "Lesson plans", singular: "lesson plan", blurb: "Full lessons ready to teach.", image: lessonPlansImg },
];

export const SOURCE_LABEL: Record<LibrarySource, string> = { upload: "Uploaded", created: "Created", ai: "AI", canvas: "Canvas" };

/** Webb's Depth of Knowledge levels. */
export const DOK_LEVELS: { level: number; name: string; blurb: string }[] = [
  { level: 1, name: "Recall", blurb: "Define, identify, list, recall facts" },
  { level: 2, name: "Skill / Concept", blurb: "Classify, compare, summarize, apply" },
  { level: 3, name: "Strategic Thinking", blurb: "Justify with evidence, analyze, explain" },
  { level: 4, name: "Extended Thinking", blurb: "Design, synthesize, investigate" },
];

export function dokName(level: number) {
  return DOK_LEVELS.find((d) => d.level === level)?.name ?? `DOK ${level}`;
}

/** Compact "DOK 1–3" / "DOK 2" label for a set of levels. */
export function dokLabel(levels: number[] | null | undefined) {
  const l = Array.from(new Set(levels ?? [])).sort();
  if (!l.length) return null;
  if (l.length === 1) return `DOK ${l[0]}`;
  const contiguous = l.every((v, i) => i === 0 || v === l[i - 1] + 1);
  return contiguous ? `DOK ${l[0]}–${l[l.length - 1]}` : `DOK ${l.join(", ")}`;
}

export function sectionMeta(key: LibrarySection) {
  return SECTIONS.find((s) => s.key === key)!;
}
