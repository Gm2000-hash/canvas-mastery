import { supabase } from "@/modules/curriculum/config/supabase";
import { ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";

export type ContentType = "questions" | "lesson_plan" | "reading";

export interface GenerationProgress {
  total: number;
  completed: number;
  current: string | null;
  errors: string[];
  itemsGenerated: number;
  contentType: ContentType;
}

export type ProgressCallback = (progress: GenerationProgress) => void;

interface GenerateOptions {
  framework?: "NGSS" | "Idaho";
  subject?: string;
  dokLevel?: number | null;
  unitId?: string; // needed for lesson_plan and reading saves
  modelOverride?: string; // optional AI engine override (model id)
  /** User's saved AI preferences — forwarded so the edge resolver can apply per-tier defaults. */
  aiPreferences?: { default_model?: string; overrides?: Record<string, string> } | null;
}

/**
 * Generate content for a specific standard and save to the appropriate table.
 */
async function generateForSubstandard(
  contentType: ContentType,
  code: string,
  description: string,
  count: number,
  options: GenerateOptions = {}
): Promise<{ saved: number; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in");

  const { data, error } = await supabase.functions.invoke("generate-content", {
    body: {
      content_type: contentType,
      standard_code: code,
      standard_description: description,
      count,
      framework: options.framework || "NGSS",
      subject: options.subject || "Science",
      ...(options.dokLevel ? { dok_level: options.dokLevel } : {}),
      ...(options.modelOverride ? { model_override: options.modelOverride } : {}),
      ...(options.aiPreferences ? { ai_preferences: options.aiPreferences } : {}),
    },
  });

  if (error) return { saved: 0, error: error.message || "Edge function error" };
  if (data?.error) return { saved: 0, error: data.error };

  if (contentType === "questions") {
    return saveQuestions(data, user.id, code, description, options);
  } else if (contentType === "lesson_plan") {
    return saveLessonPlans(data, user.id, code, description, options);
  } else {
    return saveReadings(data, user.id, code, description, options);
  }
}

async function saveQuestions(
  data: any, userId: string, code: string, description: string, options: GenerateOptions
): Promise<{ saved: number }> {
  const questions = data?.questions || [];
  let saved = 0;

  for (const q of questions) {
    try {
      let answers = q.answers;
      if (Array.isArray(answers)) {
        answers = answers.map((a: any, i: number) => ({
          id: Date.now() + i,
          text: a.text || "",
          weight: a.weight ?? (a.correct ? 100 : 0),
        }));
      }

      const sourceLabel = options.framework === "Idaho" ? `Idaho ${options.subject}` : "NGSS Science";

      const { data: inserted, error: insertError } = await supabase
        .from("question_bank")
        .insert({
          user_id: userId,
          question_text: q.question_text,
          question_type: q.question_type,
          points_possible: q.points_possible || 1,
          answers: answers as any,
          dok_level: q.dok_level || 1,
          blooms_level: q.blooms_level || "Remember",
          source_course: `AI Generated (${sourceLabel})`,
          source_quiz: `ISAT Sample - ${code}`,
        })
        .select("id")
        .single();

      if (insertError) { console.error("Failed to save question:", insertError); continue; }

      if (inserted) {
        await supabase.from("question_bank_standards").insert({
          question_bank_id: inserted.id,
          ngss_code: code,
          ngss_description: description,
        });
        saved++;
      }
    } catch (e) {
      console.error("Error saving generated question:", e);
    }
  }
  return { saved };
}

async function saveLessonPlans(
  data: any, userId: string, code: string, description: string, options: GenerateOptions
): Promise<{ saved: number }> {
  const lessons = data?.lessons || [];
  let saved = 0;

  // Get existing sort_order if unitId provided
  let sortOrder = 0;
  if (options.unitId) {
    const { count } = await supabase
      .from("lesson_plans")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", options.unitId);
    sortOrder = count || 0;
  }

  for (const lesson of lessons) {
    try {
      const { data: inserted, error: insertError } = await supabase
        .from("lesson_plans")
        .insert({
          user_id: userId,
          unit_id: options.unitId || null,
          title: lesson.title,
          duration_minutes: lesson.duration_minutes || 50,
          objectives: lesson.objectives || "",
          activities: lesson.activities || [],
          materials: lesson.materials || "",
          assessment: lesson.assessment || "",
          differentiation: lesson.differentiation || "",
          vocabulary: lesson.vocabulary || [],
          resources: lesson.resources || [],
          sort_order: sortOrder++,
        } as any)
        .select("id")
        .single();

      if (insertError) { console.error("Failed to save lesson:", insertError); continue; }

      if (inserted) {
        await supabase.from("lesson_plan_standards").insert({
          lesson_plan_id: inserted.id,
          ngss_code: code,
          ngss_description: description,
        });
        saved++;
      }
    } catch (e) {
      console.error("Error saving lesson plan:", e);
    }
  }
  return { saved };
}

async function saveReadings(
  data: any, userId: string, code: string, description: string, options: GenerateOptions
): Promise<{ saved: number }> {
  const readings = data?.readings || [];
  let saved = 0;

  // Determine discipline for library sync
  const discipline = options.subject === "Science" || !options.subject
    ? getDisciplineFromCode(code)
    : options.subject;

  let sortOrder = 0;
  if (options.unitId) {
    const { count } = await supabase
      .from("curriculum_lessons")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", options.unitId);
    sortOrder = count || 0;
  }

  for (const reading of readings) {
    try {
      const insertData: any = {
        user_id: userId,
        unit_id: options.unitId || null,
        title: reading.title,
        sort_order: sortOrder++,
        objectives: reading.objectives || [],
        intro: reading.intro || [],
        explanation: reading.explanation || [],
        key_terms: reading.key_terms || [],
        reading_title: reading.reading_title || null,
        reading_paragraphs: reading.reading_paragraphs || [],
      };

      // unit_id is required for curriculum_lessons
      if (!options.unitId) {
        const unitTitle = discipline ? `AI Generated - ${discipline}` : "AI Generated Readings";
        const { data: unitData } = await supabase
          .from("units")
          .select("id")
          .eq("user_id", userId)
          .eq("title", unitTitle)
          .maybeSingle();

        if (unitData) {
          insertData.unit_id = unitData.id;
        } else {
          const { data: newUnit } = await supabase
            .from("units")
            .insert({
              user_id: userId,
              title: unitTitle,
              description: `Auto-generated curriculum readings${discipline ? ` for ${discipline}` : ""}`,
              discipline: discipline || null,
            })
            .select("id")
            .single();
          if (newUnit) insertData.unit_id = newUnit.id;
        }
      }

      const { data: inserted, error: insertError } = await supabase
        .from("curriculum_lessons")
        .insert(insertData)
        .select("id")
        .single();

      if (insertError) { console.error("Failed to save reading:", insertError); continue; }

      if (inserted) {
        await supabase.from("curriculum_lesson_standards").insert({
          lesson_id: inserted.id,
          ngss_code: code,
          ngss_description: description,
        });
        saved++;
      }
    } catch (e) {
      console.error("Error saving reading:", e);
    }
  }

  // Auto-populate reading library if any readings were saved
  if (saved > 0 && discipline) {
    await syncDisciplineToLibrary(userId, discipline);
  }

  return { saved };
}

/** Map standard codes to science disciplines */
function getDisciplineFromCode(code: string): string | null {
  if (code.startsWith("MS-LS")) return "Life Science";
  if (code.startsWith("MS-PS")) return "Physical Science";
  if (code.startsWith("MS-ESS")) return "Earth & Space Science";
  return "Science";
}

/** Ensure a library_books entry exists for the given discipline */
export async function syncDisciplineToLibrary(userId: string, discipline: string) {
  try {
    const { data: existing } = await supabase
      .from("library_books")
      .select("id")
      .eq("source_discipline", discipline)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("library_books")
        .update({ updated_at: new Date().toISOString(), is_published: true } as any)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("library_books")
        .insert({
          user_id: userId,
          title: `${discipline} Readings`,
          file_path: `curriculum/${discipline.toLowerCase().replace(/\s+/g, "-")}`,
          file_size: 0,
          is_published: true,
          source_discipline: discipline,
        } as any);
    }
  } catch (e) {
    console.error("Failed to sync to reading library:", e);
  }
}

/**
 * Generate content for a list of standards with progress tracking.
 */
export async function generateForStandards(
  contentType: ContentType,
  standards: { code: string; description: string }[],
  countPerStandard: number,
  onProgress: ProgressCallback,
  options: GenerateOptions = {}
): Promise<void> {
  const progress: GenerationProgress = {
    total: standards.length,
    completed: 0,
    current: null,
    errors: [],
    itemsGenerated: 0,
    contentType,
  };

  onProgress({ ...progress });

  for (const sub of standards) {
    progress.current = sub.code;
    onProgress({ ...progress });

    const result = await generateForSubstandard(contentType, sub.code, sub.description, countPerStandard, options);

    if (result.error) {
      progress.errors.push(`${sub.code}: ${result.error}`);
    }
    progress.itemsGenerated += result.saved;
    progress.completed++;
    progress.current = null;
    onProgress({ ...progress });

    if (progress.completed < progress.total) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

/**
 * Generate content for all substandards in a core idea.
 */
export async function generateForCoreIdea(
  contentType: ContentType,
  coreIdea: string,
  countPerStandard: number,
  onProgress: ProgressCallback,
  options: GenerateOptions = {}
): Promise<void> {
  const substandards = ALL_SUBSTANDARDS[coreIdea] || [];
  return generateForStandards(contentType, substandards, countPerStandard, onProgress, {
    framework: "NGSS",
    subject: "Science",
    ...options,
  });
}

/**
 * Generate content for all substandards in a discipline.
 */
export async function generateForDiscipline(
  contentType: ContentType,
  coreIdeas: string[],
  countPerStandard: number,
  onProgress: ProgressCallback,
  options: GenerateOptions = {}
): Promise<void> {
  const allSubs = coreIdeas.flatMap(ci => ALL_SUBSTANDARDS[ci] || []);
  return generateForStandards(contentType, allSubs, countPerStandard, onProgress, {
    framework: "NGSS",
    subject: "Science",
    ...options,
  });
}

/**
 * Get count of all substandards.
 */
export function getTotalSubstandardCount(): number {
  return Object.values(ALL_SUBSTANDARDS).reduce((sum, subs) => sum + subs.length, 0);
}

/** Content type labels for UI */
export const CONTENT_TYPE_LABELS: Record<ContentType, { singular: string; plural: string }> = {
  questions: { singular: "question", plural: "questions" },
  lesson_plan: { singular: "lesson plan", plural: "lesson plans" },
  reading: { singular: "reading", plural: "readings" },
};
