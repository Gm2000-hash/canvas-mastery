import { supabase } from "@/modules/curriculum/config/supabase";
import type { CurriculumLesson } from "@/modules/curriculum/hooks/useCurriculum";

/** Convert a curriculum lesson to printable HTML for a Google Doc. */
export function readingLessonToHtml(lesson: CurriculumLesson): string {
  const esc = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  // reading_paragraphs items may already be HTML (from TipTap) — pass through.
  const paragraphs = (lesson.reading_paragraphs || [])
    .map((p) => `<p>${p}</p>`)
    .join("\n");
  const objectives = (lesson.objectives || [])
    .map((o) => `<li>${esc(o)}</li>`)
    .join("");
  const keyTerms = (lesson.key_terms || [])
    .map((kt) => `<li><strong>${esc(kt.term)}</strong> — ${esc(kt.definition)}</li>`)
    .join("");
  return `
    <h1>${esc(lesson.reading_title || lesson.title || "Reading")}</h1>
    ${objectives ? `<h2>Learning Objectives</h2><ul>${objectives}</ul>` : ""}
    ${keyTerms ? `<h2>Key Terms</h2><ul>${keyTerms}</ul>` : ""}
    <h2>Reading</h2>
    ${paragraphs}
  `;
}

export async function exportReadingToGoogleDoc(
  lesson: CurriculumLesson,
): Promise<{ id: string; name: string; url: string }> {
  const html = readingLessonToHtml(lesson);
  const title = lesson.reading_title || lesson.title || "Reading";
  const { data, error } = await supabase.functions.invoke<{ id: string; name: string; url: string; error?: string }>(
    "google-export-doc",
    { body: { title, html } },
  );
  if (error) throw new Error(error.message);
  if (!data || (data as any).error) throw new Error((data as any)?.error || "Doc export failed");
  return data;
}

/** Map Canvas-style quiz questions (as used by QuizBuilder/question_bank) into the
 *  flexible shape the google-export-form edge function expects. */
export interface QuizBankQuestion {
  question_text: string;
  question_type: string; // multiple_choice_question, etc.
  answers?: Array<{ text?: string; weight?: number; correct?: boolean }>;
  points_possible?: number;
}

export function mapBankQuestionsForForms(qs: QuizBankQuestion[]) {
  return qs.map((q) => {
    const answers = (q.answers || []).map((a) => ({
      text: String(a.text ?? ""),
      correct: a.correct === true || (typeof a.weight === "number" && a.weight >= 100),
    }));
    let type = "multiple_choice";
    switch (q.question_type) {
      case "multiple_choice_question": type = "multiple_choice"; break;
      case "multiple_answers_question": type = "multi_select"; break;
      case "true_false_question": type = "true_false"; break;
      case "short_answer_question":
      case "fill_in_multiple_blanks_question": type = "short_answer"; break;
      case "essay_question": type = "long_answer"; break;
      default: type = "multiple_choice";
    }
    let correct_answer: string | undefined;
    if (type === "true_false") {
      const c = answers.find((a) => a.correct);
      if (c) correct_answer = /^t/i.test(c.text) ? "True" : "False";
    }
    return {
      question_text: q.question_text,
      question_type: type,
      answers,
      correct_answer,
      points_possible: q.points_possible ?? 1,
    };
  });
}

export async function exportQuizToGoogleForm(
  title: string,
  questions: QuizBankQuestion[],
  description?: string,
): Promise<{ formId: string; editUrl: string; responderUri: string }> {
  const mapped = mapBankQuestionsForForms(questions);
  const { data, error } = await supabase.functions.invoke<{
    formId: string; editUrl: string; responderUri: string; error?: string;
  }>("google-export-form", { body: { title, description, questions: mapped } });
  if (error) throw new Error(error.message);
  if (!data || (data as any).error) throw new Error((data as any)?.error || "Form export failed");
  return data;
}
