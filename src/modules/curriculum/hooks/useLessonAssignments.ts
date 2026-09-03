import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useAuth } from "../config/auth";
import { toast } from "sonner";

export interface RubricRow {
  criterion: string;
  exemplary?: string;
  proficient?: string;
  developing?: string;
  beginning?: string;
}

export interface QuizQuestion {
  type: "multiple_choice" | "checkbox" | "short_answer" | "paragraph" | "true_false";
  prompt: string;
  choices?: string[];
  correct?: string[];
  points: number;
  feedback_correct?: string;
  feedback_incorrect?: string;
}

export interface LessonAssignment {
  id: string;
  lesson_plan_id: string;
  user_id: string;
  title: string;
  assignment_type: string;
  instructions: string;
  points_possible: number;
  due_in_days: number | null;
  materials: string[];
  rubric: RubricRow[];
  quiz_questions: QuizQuestion[];
  ai_metadata: Record<string, unknown>;
  canvas_assignment_id: number | null;
  canvas_course_id: number | null;
  google_doc_url: string | null;
  google_sheet_url: string | null;
  google_slides_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useLessonAssignments(lessonPlanId?: string) {
  const { user } = useAuth();
  const [items, setItems] = useState<LessonAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!user || !lessonPlanId) return;
    setLoading(true);
    const { data, error } = await (supabase.from("lesson_assignments") as any)
      .select("*")
      .eq("lesson_plan_id", lessonPlanId)
      .order("sort_order");
    if (error) toast.error(error.message);
    else setItems((data || []) as LessonAssignment[]);
    setLoading(false);
  }, [user, lessonPlanId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const create = async (input: Partial<LessonAssignment> & { title: string }) => {
    if (!user || !lessonPlanId) return null;
    const { data, error } = await (supabase.from("lesson_assignments") as any)
      .insert({
        user_id: user.id,
        lesson_plan_id: lessonPlanId,
        title: input.title,
        assignment_type: input.assignment_type || "worksheet",
        instructions: input.instructions || "",
        points_possible: input.points_possible ?? 100,
        materials: input.materials || [],
        rubric: input.rubric || [],
        ai_metadata: input.ai_metadata || {},
        sort_order: items.length,
      })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return null; }
    await fetchItems();
    return data as LessonAssignment;
  };

  const update = async (id: string, patch: Partial<LessonAssignment>) => {
    const { error } = await (supabase.from("lesson_assignments") as any)
      .update(patch)
      .eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await fetchItems();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("lesson_assignments" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await fetchItems();
    return true;
  };

  return { items, loading, fetchItems, create, update, remove };
}
