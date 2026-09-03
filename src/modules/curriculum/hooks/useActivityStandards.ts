import { useState } from "react";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useToast } from "@/modules/curriculum/config/toast";

export interface ActivityStandard {
  id: string;
  activity_id: string;
  ngss_code: string;
  ngss_description: string;
  matched_terms: string[];
}

/** Extract a flat question-like text from H5P activity content for standards tagging */
function extractTextFromContent(activityType: string, content: any): string {
  if (!content) return "";
  const parts: string[] = [];

  switch (activityType) {
    case "fill_in_blanks":
    case "drag_the_words":
    case "mark_the_words":
      if (content.text) parts.push(content.text.replace(/\*/g, ""));
      break;
    case "multiple_choice":
      if (content.question) parts.push(content.question);
      content.options?.forEach((o: any) => parts.push(o.text));
      break;
    case "true_false":
      if (content.statement) parts.push(content.statement);
      if (content.feedback) parts.push(content.feedback);
      break;
    case "single_choice_set":
    case "question_set":
      (content.questions || []).forEach((q: any) => {
        const qContent = q.content || q;
        if (qContent.question) parts.push(qContent.question);
        (qContent.options || []).forEach((o: any) => parts.push(typeof o === "string" ? o : o.text));
      });
      break;
    case "flashcards":
      (content.cards || []).forEach((c: any) => { parts.push(c.term, c.definition); });
      break;
    case "dialog_cards":
      (content.cards || []).forEach((c: any) => { parts.push(c.front, c.back); });
      break;
    case "memory_game":
      (content.pairs || []).forEach((p: any) => { parts.push(p.cardA, p.cardB); });
      break;
    case "crossword":
      (content.words || []).forEach((w: any) => { parts.push(w.word, w.clue); });
      break;
    case "timeline":
      if (content.headline) parts.push(content.headline);
      (content.events || []).forEach((e: any) => { parts.push(e.title, e.description); });
      break;
    case "accordion":
      (content.panels || []).forEach((p: any) => { parts.push(p.title, p.content); });
      break;
    case "game_map":
      if (content.title) parts.push(content.title);
      (content.stages || []).forEach((s: any) => {
        parts.push(s.label);
        if (s.content?.question) parts.push(s.content.question);
        s.content?.options?.forEach((o: any) => parts.push(o.text));
      });
      break;
    case "essay":
      if (content.question) parts.push(content.question);
      break;
    case "summary":
      (content.groups || []).forEach((g: any) => g.statements?.forEach((s: string) => parts.push(s)));
      break;
    case "drag_and_drop":
      content.items?.forEach((i: any) => parts.push(i.label));
      content.zones?.forEach((z: any) => parts.push(z.label));
      break;
    case "course_presentation":
      (content.slides || []).forEach((s: any) => { parts.push(s.title, s.content); });
      break;
    case "interactive_book":
      (content.chapters || []).forEach((c: any) => { parts.push(c.title, c.content); });
      break;
    default:
      parts.push(JSON.stringify(content).substring(0, 2000));
  }

  return parts.filter(Boolean).join(" ");
}

export function useActivityStandards() {
  const [tagging, setTagging] = useState(false);
  const { toast } = useToast();

  const tagActivity = async (activityId: string, activityType: string, content: any, title: string) => {
    const text = extractTextFromContent(activityType, content);
    if (!text || text.length < 20) return;

    setTagging(true);
    try {
      const questionText = `${title}. ${text}`.substring(0, 3000);
      const { data, error } = await supabase.functions.invoke("standards-tagger", {
        body: {
          questions: [{ id: 1, question_text: questionText }],
          framework: "ngss",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const tags = data?.tags?.[0]?.standards || [];
      if (tags.length === 0) return;

      // Clear old standards for this activity
      await supabase.from("h5p_activity_standards" as any).delete().eq("activity_id", activityId);

      // Insert new ones
      const rows = tags.map((t: any) => ({
        activity_id: activityId,
        ngss_code: t.code,
        ngss_description: t.description,
        matched_terms: t.matched_terms || [],
      }));
      await supabase.from("h5p_activity_standards" as any).insert(rows);
    } catch (err: any) {
      console.error("Standards tagging failed:", err);
      // Non-blocking — don't show error toast for auto-tagging
    } finally {
      setTagging(false);
    }
  };

  const fetchStandards = async (activityIds: string[]): Promise<Record<string, ActivityStandard[]>> => {
    if (activityIds.length === 0) return {};
    const { data } = await supabase
      .from("h5p_activity_standards" as any)
      .select("*")
      .in("activity_id", activityIds);
    const map: Record<string, ActivityStandard[]> = {};
    (data || []).forEach((s: any) => {
      if (!map[s.activity_id]) map[s.activity_id] = [];
      map[s.activity_id].push(s as ActivityStandard);
    });
    return map;
  };

  const addStandard = async (activityId: string, code: string, description: string) => {
    const { error } = await supabase
      .from("h5p_activity_standards" as any)
      .insert({ activity_id: activityId, ngss_code: code, ngss_description: description, matched_terms: [] });
    if (error && !error.message.includes("duplicate")) {
      toast({ title: "Error adding standard", description: error.message, variant: "destructive" });
    }
  };

  const removeStandard = async (standardId: string) => {
    await supabase.from("h5p_activity_standards" as any).delete().eq("id", standardId);
  };

  return { tagActivity, fetchStandards, addStandard, removeStandard, tagging };
}
