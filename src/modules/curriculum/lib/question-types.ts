/**
 * Question type definitions for traditional and ISAT-style questions.
 */

// All supported question types
export const QUESTION_TYPE_CATEGORIES = {
  traditional: [
    { value: "multiple_choice_question", label: "Multiple Choice" },
    { value: "multiple_answers_question", label: "Select All That Apply" },
    { value: "true_false_question", label: "True / False" },
    { value: "short_answer_question", label: "Short Answer" },
    { value: "essay_question", label: "Essay / Open Response" },
    { value: "matching_question", label: "Matching" },
    { value: "fill_in_multiple_blanks_question", label: "Fill in the Blank" },
  ],
  isat: [
    { value: "multi_step_question", label: "Multi-Step (Part A / B / C)" },
    { value: "drag_and_drop_question", label: "Drag & Drop / Sorting" },
    { value: "text_highlight_question", label: "Text Highlight / Select" },
  ],
} as const;

export const ALL_QUESTION_TYPES = [
  ...QUESTION_TYPE_CATEGORIES.traditional,
  ...QUESTION_TYPE_CATEGORIES.isat,
];

export function getQuestionTypeLabel(typeValue: string): string {
  return ALL_QUESTION_TYPES.find(t => t.value === typeValue)?.label || typeValue;
}

export function isISATType(typeValue: string): boolean {
  return QUESTION_TYPE_CATEGORIES.isat.some(t => t.value === typeValue);
}

// ─── Answer data shapes stored in JSONB ───

export interface MCAnswer {
  id: number;
  text: string;
  weight: number; // 100 = correct, 0 = incorrect
}

export interface MatchingPair {
  id: number;
  left: string;
  right: string;
}

export interface MultiStepPart {
  label: string; // "Part A", "Part B", etc.
  prompt: string;
  type: "multiple_choice" | "short_answer" | "select_all";
  options?: { text: string; correct: boolean }[];
  correctText?: string; // for short_answer
}

export interface DragDropCategory {
  label: string;
  items: string[];
}

export interface TextHighlightData {
  passage: string;
  correctSelections: { start: number; end: number; text: string }[];
}

// ─── Defaults for new questions ───

export function createDefaultAnswers(type: string): any {
  switch (type) {
    case "multiple_choice_question":
      return [
        { id: 1, text: "", weight: 100 },
        { id: 2, text: "", weight: 0 },
        { id: 3, text: "", weight: 0 },
        { id: 4, text: "", weight: 0 },
      ];
    case "true_false_question":
      return [
        { id: 1, text: "True", weight: 100 },
        { id: 2, text: "False", weight: 0 },
      ];
    case "multiple_answers_question":
      return [
        { id: 1, text: "", weight: 0 },
        { id: 2, text: "", weight: 0 },
        { id: 3, text: "", weight: 0 },
        { id: 4, text: "", weight: 0 },
      ];
    case "matching_question":
      return [
        { id: 1, left: "", right: "" },
        { id: 2, left: "", right: "" },
        { id: 3, left: "", right: "" },
      ];
    case "multi_step_question":
      return {
        parts: [
          { label: "Part A", prompt: "", type: "multiple_choice", options: [{ text: "", correct: true }, { text: "", correct: false }, { text: "", correct: false }, { text: "", correct: false }] },
          { label: "Part B", prompt: "", type: "short_answer", correctText: "" },
        ],
      };
    case "drag_and_drop_question":
      return {
        categories: [
          { label: "Category 1", items: [""] },
          { label: "Category 2", items: [""] },
        ],
      };
    case "text_highlight_question":
      return {
        passage: "",
        correctSelections: [],
      };
    default:
      return [];
  }
}
