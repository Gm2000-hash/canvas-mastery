import { supabase } from "@/modules/curriculum/config/supabase";

export interface NGSSStandard {
  code: string;
  description: string;
}

export interface NGSSTag {
  question_id: number;
  standards: NGSSStandard[];
}

export async function tagQuestionsWithNGSS(
  questions: { id: number; question_text: string }[]
): Promise<Map<number, NGSSStandard[]>> {
  const { data, error } = await supabase.functions.invoke('ngss-tagger', {
    body: { questions },
  });

  if (error) throw new Error(error.message || 'Failed to tag questions with NGSS standards');
  if (data?.error) throw new Error(data.error);

  const tags: NGSSTag[] = data.tags || [];
  const map = new Map<number, NGSSStandard[]>();
  for (const tag of tags) {
    map.set(tag.question_id, tag.standards);
  }
  return map;
}
