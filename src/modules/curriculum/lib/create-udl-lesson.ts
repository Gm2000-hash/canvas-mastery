import { supabase } from "@/modules/curriculum/config/supabase";

export interface CreateUdlLessonInput {
  userId: string;
  unitId: string;
  unitTitle: string;
  discipline?: string;
  gradeLevel?: string;
  title: string;
  durationMinutes?: number;
  lessonDate?: string | null;
  /** Existing standards on the unit, used to anchor AI generation when available. */
  standards?: { ngss_code: string; ngss_description: string }[];
  sortOrder?: number;
  /** Forwarded to the edge function (per-user model preferences). */
  aiPreferences?: any;
  modelOverride?: string;
}

/**
 * Calls the UDL-wrapped `generate-lesson-plans` edge function for ONE lesson,
 * then inserts a fully-populated `lesson_plans` row (with `udl_supports`) and
 * any AI-returned NGSS standards. Returns the inserted lesson id.
 *
 * Throws on AI / DB failure so the caller can fall back to an empty stub.
 */
export async function createUdlLessonPlan(input: CreateUdlLessonInput): Promise<string> {
  const {
    userId, unitId, unitTitle, discipline, gradeLevel, title,
    durationMinutes = 50, lessonDate = null, standards = [], sortOrder = 0,
    aiPreferences, modelOverride,
  } = input;

  const standardsContext = standards.length > 0
    ? `\n\nAnchor the lesson to one or more of these NGSS standards already tagged on the unit (echo them in standards_json):\n${standards.map(s => `- ${s.ngss_code}: ${s.ngss_description}`).join("\n")}`
    : "";

  const { data, error } = await supabase.functions.invoke("generate-lesson-plans", {
    body: {
      unitTitle,
      discipline: discipline || "Science",
      gradeLevel: gradeLevel || "Middle School",
      topic: title,
      numLessons: 1,
      additionalContext: `Create ONE fully-scripted UDL lesson titled "${title}". The teacher requested this lesson by name — keep the title and design every phase to deliver it.${standardsContext}`,
      ...(modelOverride ? { model_override: modelOverride } : {}),
      ...(aiPreferences ? { ai_preferences: aiPreferences } : {}),
    },
  });

  if (error) {
    let msg = error.message || "AI generation failed";
    try {
      const ctxBody = (error as any)?.context?.body;
      if (ctxBody) {
        const body = typeof ctxBody === "string" ? JSON.parse(ctxBody) : ctxBody;
        if (body?.error) msg = body.error;
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const ai = data?.lessons?.[0];
  if (!ai) throw new Error("AI did not return a lesson");

  const insertRow: Record<string, any> = {
    user_id: userId,
    unit_id: unitId,
    title: ai.title || title,
    lesson_date: lessonDate,
    duration_minutes: ai.duration_minutes || durationMinutes,
    objectives: ai.objectives || "",
    activities: ai.activities || [],
    materials: ai.materials || "",
    assessment: ai.assessment || "",
    differentiation: ai.differentiation || "",
    notes: ai.notes || "",
    vocabulary: ai.vocabulary || [],
    resources: ai.resources || [],
    udl_supports: ai.udl_supports || {},
    sort_order: sortOrder,
  };

  const { data: inserted, error: insertError } = await (supabase.from("lesson_plans") as any)
    .insert(insertRow)
    .select("id")
    .single();

  if (insertError) throw insertError;

  // Standards: prefer AI-returned, fall back to the unit's tagged standards.
  const aiStandards = (ai.standards || []).map((s: any) => ({
    lesson_plan_id: inserted.id,
    ngss_code: s.code || s.ngss_code,
    ngss_description: s.description || s.ngss_description,
  })).filter((s: any) => s.ngss_code);

  const fallbackStandards = standards.map(s => ({
    lesson_plan_id: inserted.id,
    ngss_code: s.ngss_code,
    ngss_description: s.ngss_description,
  }));

  const stdRows = aiStandards.length > 0 ? aiStandards : fallbackStandards;
  if (stdRows.length > 0) {
    await supabase.from("lesson_plan_standards").insert(stdRows);
  }

  return inserted.id as string;
}
