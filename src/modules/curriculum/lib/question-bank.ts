import { supabase } from "@/modules/curriculum/config/supabase";
import type { QuizQuestion } from "../config/canvas-api";
import type { NGSSStandard } from "./ngss-api";

/** Strip HTML tags and normalize whitespace for comparison */
function normalizeQuestionText(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export interface QuestionBankItem {
  id: string;
  canvas_question_id: number;
  question_text: string;
  question_type: string;
  points_possible: number;
  answers: any[];
  source_course: string | null;
  source_quiz: string | null;
  created_at: string;
  dok_level: number | null;
  blooms_level: string | null;
  standards: { ngss_code: string; ngss_description: string }[];
}

/**
 * Auto-suggest DOK level and Bloom's taxonomy based on question type and text.
 */
export function suggestDokAndBlooms(questionType: string, questionText: string): { dok: number; blooms: string } {
  const text = questionText.toLowerCase();

  // Check for higher-order verbs first (highest priority)
  const createVerbs = /\b(design|create|construct|develop|formulate|propose|invent|compose)\b/;
  const evaluateVerbs = /\b(evaluate|justify|defend|critique|judge|assess|argue|support your)\b/;
  const analyzeVerbs = /\b(analyze|compare|contrast|differentiate|distinguish|examine|investigate|categorize|classify|relationship|cause and effect|evidence)\b/;
  const applyVerbs = /\b(apply|calculate|solve|demonstrate|predict|model|use .+ to|determine|compute)\b/;
  const understandVerbs = /\b(explain|describe|summarize|interpret|paraphrase|infer|conclude|illustrate)\b/;

  if (createVerbs.test(text)) return { dok: 4, blooms: "Create" };
  if (evaluateVerbs.test(text)) return { dok: 3, blooms: "Evaluate" };
  if (analyzeVerbs.test(text)) return { dok: 3, blooms: "Analyze" };
  if (applyVerbs.test(text)) return { dok: 2, blooms: "Apply" };
  if (understandVerbs.test(text)) return { dok: 2, blooms: "Understand" };

  // Fall back to question type heuristics
  switch (questionType) {
    case "essay_question":
      return { dok: 3, blooms: "Analyze" };
    case "short_answer_question":
    case "fill_in_multiple_blanks_question":
      return { dok: 2, blooms: "Apply" };
    case "matching_question":
      return { dok: 2, blooms: "Understand" };
    case "numerical_question":
    case "calculated_question":
      return { dok: 2, blooms: "Apply" };
    case "multiple_choice_question":
    case "true_false_question":
    case "multiple_answers_question":
    default:
      return { dok: 1, blooms: "Remember" };
  }
}

export async function saveQuestionsToBank(
  questions: QuizQuestion[],
  ngssTags: Map<number, NGSSStandard[]>,
  courseName: string,
  quizTitle: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in to save to question bank");

  const filtered = questions.filter(q => q.question_type !== "text_only_question");

  // Pre-fetch existing questions to check duplicates efficiently
  const { data: existingQuestions } = await supabase
    .from("question_bank")
    .select("id, canvas_question_id, question_text, question_type")
    .eq("user_id", user.id);

  const existingCanvasIds = new Set((existingQuestions || []).filter(q => q.canvas_question_id != null).map(q => q.canvas_question_id));
  const existingTextKeys = new Set(
    (existingQuestions || []).map(q => `${q.question_type}::${normalizeQuestionText(q.question_text)}`)
  );

  for (const q of filtered) {
    // Skip if canvas_question_id already exists
    if (existingCanvasIds.has(q.id)) continue;

    // Skip if identical normalized text + type already exists
    const normalized = normalizeQuestionText(q.question_text);
    const textKey = `${q.question_type}::${normalized}`;
    if (normalized.length > 0 && existingTextKeys.has(textKey)) continue;

    const { dok, blooms } = suggestDokAndBlooms(q.question_type, q.question_text);

    const { data: inserted, error } = await supabase
      .from("question_bank")
      .insert({
        user_id: user.id,
        canvas_question_id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        points_possible: q.points_possible,
        answers: q.answers as any,
        source_course: courseName,
        source_quiz: quizTitle,
        dok_level: dok,
        blooms_level: blooms,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to save question:", error);
      continue;
    }

    const standards = ngssTags.get(q.id) || [];
    if (standards.length > 0 && inserted) {
      await supabase.from("question_bank_standards").insert(
        standards.map(s => ({
          question_bank_id: inserted.id,
          ngss_code: s.code,
          ngss_description: s.description,
        }))
      );
    }
  }
}

export async function getQuestionBank(): Promise<QuestionBankItem[]> {
  // Fetch all questions (paginate past the 1000-row default limit)
  let allQuestions: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("question_bank")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allQuestions = allQuestions.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  if (allQuestions.length === 0) return [];

  // Fetch all standards in batches (to avoid URL length limits and row caps)
  const ids = allQuestions.map((q: any) => q.id);
  let allStandards: any[] = [];
  const batchSize = 200;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { data: standards } = await supabase
      .from("question_bank_standards")
      .select("*")
      .in("question_bank_id", batch);
    if (standards) allStandards = allStandards.concat(standards);
  }

  const standardsMap = new Map<string, { ngss_code: string; ngss_description: string }[]>();
  for (const s of allStandards) {
    const list = standardsMap.get(s.question_bank_id) || [];
    list.push({ ngss_code: s.ngss_code, ngss_description: s.ngss_description });
    standardsMap.set(s.question_bank_id, list);
  }

  return allQuestions.map((q: any) => ({
    id: q.id,
    canvas_question_id: q.canvas_question_id,
    question_text: q.question_text,
    question_type: q.question_type,
    points_possible: q.points_possible,
    answers: (q.answers as any[]) || [],
    source_course: q.source_course,
    source_quiz: q.source_quiz,
    created_at: q.created_at,
    dok_level: q.dok_level,
    blooms_level: q.blooms_level,
    standards: standardsMap.get(q.id) || [],
  }));
}

export async function createQuestion(data: {
  question_text: string;
  question_type: string;
  points_possible: number;
  answers: any;
  dok_level?: number | null;
  blooms_level?: string | null;
  source_course?: string | null;
  source_quiz?: string | null;
  standards?: { ngss_code: string; ngss_description: string }[];
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in to create a question");

  // Check for duplicate by question text + type
  const normalized = normalizeQuestionText(data.question_text);
  if (normalized.length > 0) {
    const { data: candidates } = await supabase
      .from("question_bank")
      .select("id, question_text")
      .eq("user_id", user.id)
      .eq("question_type", data.question_type);

    const isDuplicate = (candidates || []).some(
      c => normalizeQuestionText(c.question_text) === normalized
    );
    if (isDuplicate) throw new Error("A question with this text already exists in your question bank");
  }

  const { data: inserted, error } = await supabase.from("question_bank").insert({
    user_id: user.id,
    question_text: data.question_text,
    question_type: data.question_type,
    points_possible: data.points_possible,
    answers: data.answers as any,
    dok_level: data.dok_level ?? null,
    blooms_level: data.blooms_level ?? null,
    source_course: data.source_course ?? null,
    source_quiz: data.source_quiz ?? null,
  }).select("id").single();

  if (error) throw error;

  if (data.standards && data.standards.length > 0 && inserted) {
    const { error: stdError } = await supabase.from("question_bank_standards").insert(
      data.standards.map(s => ({
        question_bank_id: inserted.id,
        ngss_code: s.ngss_code,
        ngss_description: s.ngss_description,
      }))
    );
    if (stdError) console.error("Failed to save standards:", stdError);
  }
}

export async function deleteFromBank(id: string) {
  // Delete standards first (foreign key)
  await supabase.from("question_bank_standards").delete().eq("question_bank_id", id);
  const { error } = await supabase.from("question_bank").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteManyFromBank(ids: string[]) {
  if (ids.length === 0) return;
  const batchSize = 200;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    await supabase.from("question_bank_standards").delete().in("question_bank_id", batch);
    const { error } = await supabase.from("question_bank").delete().in("id", batch);
    if (error) throw error;
  }
}

export async function backfillDokAndBlooms(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in");

  const { data: questions, error } = await supabase
    .from("question_bank")
    .select("id, question_type, question_text, dok_level, blooms_level")
    .eq("user_id", user.id);

  if (error) throw error;
  if (!questions) return 0;

  const toUpdate = questions.filter(q => q.dok_level == null || q.blooms_level == null);
  let updated = 0;

  for (const q of toUpdate) {
    const { dok, blooms } = suggestDokAndBlooms(q.question_type, q.question_text);
    const updates: Record<string, unknown> = {};
    if (q.dok_level == null) updates.dok_level = dok;
    if (q.blooms_level == null) updates.blooms_level = blooms;

    const { error: updateError } = await supabase
      .from("question_bank")
      .update(updates as never)
      .eq("id", q.id);

    if (!updateError) updated++;
  }

  return updated;
}

export async function updateQuestion(
  id: string,
  updates: { question_text?: string; points_possible?: number; question_type?: string; answers?: any[]; dok_level?: number | null; blooms_level?: string | null },
  standards?: { ngss_code: string; ngss_description: string }[]
) {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.question_text !== undefined) dbUpdates.question_text = updates.question_text;
  if (updates.points_possible !== undefined) dbUpdates.points_possible = updates.points_possible;
  if (updates.question_type !== undefined) dbUpdates.question_type = updates.question_type;
  if (updates.answers !== undefined) dbUpdates.answers = updates.answers;
  if (updates.dok_level !== undefined) dbUpdates.dok_level = updates.dok_level;
  if (updates.blooms_level !== undefined) dbUpdates.blooms_level = updates.blooms_level;

  if (Object.keys(dbUpdates).length > 0) {
    const { error } = await supabase.from("question_bank").update(dbUpdates as never).eq("id", id);
    if (error) throw error;
  }

  if (standards !== undefined) {
    // Replace all standards
    await supabase.from("question_bank_standards").delete().eq("question_bank_id", id);
    if (standards.length > 0) {
      const { error } = await supabase.from("question_bank_standards").insert(
        standards.map(s => ({ question_bank_id: id, ngss_code: s.ngss_code, ngss_description: s.ngss_description }))
      );
      if (error) throw error;
    }
  }
}
