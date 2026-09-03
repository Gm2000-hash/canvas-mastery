import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useAuth } from "../config/auth";
import { useToast } from "../config/toast";

export interface CurriculumLesson {
  id: string;
  unit_id: string;
  user_id: string;
  sort_order: number;
  title: string;
  objectives: string[];
  intro: string[];
  explanation: string[];
  key_terms: { term: string; definition: string }[];
  quiz: any[];
  reading_title: string | null;
  reading_paragraphs: string[];
  interactive_activities: any[];
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useCurriculumLessons(unitId?: string, refreshTrigger?: number) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lessons, setLessons] = useState<CurriculumLesson[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLessons = useCallback(async () => {
    if (!user || !unitId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("curriculum_lessons")
      .select("*")
      .eq("unit_id", unitId)
      .eq("user_id", user.id)
      .order("sort_order");
    if (error) {
      toast({ title: "Error loading lessons", description: error.message, variant: "destructive" });
    } else {
      setLessons((data || []) as unknown as CurriculumLesson[]);
    }
    setLoading(false);
  }, [user, unitId, refreshTrigger]);

  useEffect(() => { fetchLessons(); }, [fetchLessons]);

  const createLesson = async (lesson: Partial<CurriculumLesson> & { unit_id: string; title: string }) => {
    if (!user) return;
    const { error } = await supabase.from("curriculum_lessons").insert({
      ...lesson,
      user_id: user.id,
    } as any);
    if (error) {
      toast({ title: "Error creating lesson", description: error.message, variant: "destructive" });
      return false;
    }
    await fetchLessons();
    return true;
  };

  const updateLesson = async (id: string, updates: Partial<CurriculumLesson>) => {
    const { error } = await supabase
      .from("curriculum_lessons")
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Error updating lesson", description: error.message, variant: "destructive" });
      return false;
    }
    await fetchLessons();
    return true;
  };

  const deleteLesson = async (id: string) => {
    const { error } = await supabase.from("curriculum_lessons").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting lesson", description: error.message, variant: "destructive" });
      return false;
    }
    await fetchLessons();
    return true;
  };

  const reorderLessons = async (reordered: CurriculumLesson[]) => {
    setLessons(reordered);
    await Promise.all(reordered.map((l, i) =>
      supabase.from("curriculum_lessons").update({ sort_order: i } as any).eq("id", l.id)
    ));
  };

  return { lessons, loading, fetchLessons, createLesson, updateLesson, deleteLesson, reorderLessons };
}
