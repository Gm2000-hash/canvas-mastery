import questionsImg from "@/assets/library-questions.jpg";
import readingsImg from "@/assets/library-readings.jpg";
import activitiesImg from "@/assets/library-activities.jpg";
import lessonPlansImg from "@/assets/library-lesson-plans.jpg";

export type LibraryKind = "reading" | "activity" | "lesson_plan";
export type LibrarySection = "question" | LibraryKind;
export type LibrarySource = "upload" | "created" | "ai" | "canvas";

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
  standards: { id: string; code: string; description: string }[];
};

export const SECTIONS: { key: LibrarySection; label: string; singular: string; blurb: string; image: string }[] = [
  { key: "question", label: "Question bank", singular: "question", blurb: "Quiz questions imported from Canvas, organized by standard.", image: questionsImg },
  { key: "reading", label: "Readings", singular: "reading", blurb: "Passages, articles, and Canvas pages for students.", image: readingsImg },
  { key: "activity", label: "Activities", singular: "activity", blurb: "Labs, stations, and practice tasks.", image: activitiesImg },
  { key: "lesson_plan", label: "Lesson plans", singular: "lesson plan", blurb: "Full lessons ready to teach.", image: lessonPlansImg },
];

export const SOURCE_LABEL: Record<LibrarySource, string> = { upload: "Uploaded", created: "Created", ai: "AI", canvas: "Canvas" };

export function sectionMeta(key: LibrarySection) {
  return SECTIONS.find((s) => s.key === key)!;
}
