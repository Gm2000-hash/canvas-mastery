// Normalizes an AI-generated lesson (from generate-lesson-plans / generate-content)
// into the shape stored in lesson_plans: activities use `duration`, carry their Kolb
// stage + rationale, and section rationales are folded into the text fields as a
// trailing "Why this works:" line so they survive without a schema change.

export interface AiLessonActivity {
  name?: string;
  duration?: number;
  duration_minutes?: number;
  description?: string;
  type?: string;
  rationale?: string;
}

export interface AiLesson {
  activities?: AiLessonActivity[];
  objectives?: string;
  materials?: string;
  assessment?: string;
  differentiation?: string;
  rationale?: Partial<Record<"objectives" | "materials" | "assessment" | "differentiation", string>>;
  [key: string]: unknown;
}

const RATIONALE_PREFIX = "Why this works:";

export function withRationale(text: string | undefined, rationale: string | undefined): string {
  const base = (text ?? "").trim();
  const why = (rationale ?? "").trim();
  if (!why || base.includes(RATIONALE_PREFIX)) return base;
  return base ? `${base}\n\n${RATIONALE_PREFIX} ${why}` : `${RATIONALE_PREFIX} ${why}`;
}

export function normalizeAiActivities(activities: unknown): Array<{ name: string; duration: number; description: string; type?: string; rationale?: string }> {
  if (!Array.isArray(activities)) return [];
  return (activities as AiLessonActivity[]).map((a) => ({
    name: a.name ?? "",
    duration: Number(a.duration ?? a.duration_minutes ?? 10) || 10,
    description: a.description ?? "",
    ...(a.type ? { type: a.type } : {}),
    ...(a.rationale ? { rationale: a.rationale } : {}),
  }));
}

export function normalizeAiLesson<T extends AiLesson>(ai: T): T {
  const r = ai.rationale ?? {};
  return {
    ...ai,
    activities: normalizeAiActivities(ai.activities),
    objectives: withRationale(ai.objectives, r.objectives),
    materials: withRationale(ai.materials, r.materials),
    assessment: withRationale(ai.assessment, r.assessment),
    differentiation: withRationale(ai.differentiation, r.differentiation),
  };
}
