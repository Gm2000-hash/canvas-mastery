import { supabase } from "@/modules/curriculum/config/supabase";
import { ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";
import { ALL_IDAHO_STANDARDS, type IdahoGradeStandards } from "@/modules/curriculum/lib/idaho-standards-data";

export interface StandardMatch {
  code: string;
  description: string;
  matched_terms?: string[];
}

export interface StandardTag {
  question_id: number;
  standards: StandardMatch[];
}

/**
 * Build key terms map from NGSS data + custom DB terms
 */
async function buildKeyTermsMap(framework: "ngss" | "idaho"): Promise<Record<string, string[]>> {
  const keyTermsMap: Record<string, string[]> = {};

  // Get default terms from NGSS data (only NGSS has built-in keyTerms for now)
  if (framework === "ngss") {
    for (const group of Object.values(ALL_SUBSTANDARDS)) {
      for (const std of group) {
        if (std.keyTerms?.length > 0) {
          keyTermsMap[std.code] = [...std.keyTerms];
        }
      }
    }
  }

  // Fetch teacher-customized key terms and merge
  try {
    const { data: customTerms } = await supabase
      .from('standard_key_terms')
      .select('standard_code, key_terms');
    if (customTerms) {
      for (const ct of customTerms) {
        if (ct.key_terms?.length > 0) {
          keyTermsMap[ct.standard_code] = [
            ...new Set([...(keyTermsMap[ct.standard_code] || []), ...ct.key_terms])
          ];
        }
      }
    }
  } catch (e) {
    console.warn('Could not fetch custom key terms:', e);
  }

  return keyTermsMap;
}

/**
 * Tag questions with standards using the unified standards-tagger edge function.
 * Falls back to ngss-tagger for NGSS if standards-tagger isn't available.
 */
export async function tagQuestionsWithStandards(
  questions: { id: number; question_text: string }[],
  framework: "ngss" | "idaho",
  subject?: string,
  grade?: string,
): Promise<Map<number, StandardMatch[]>> {
  const keyTermsMap = await buildKeyTermsMap(framework);

  // Build standards list for Idaho (send the full list to the edge function)
  let standardsList: { code: string; description: string }[] | undefined;
  if (framework === "idaho" && subject) {
    const matchingGrades: IdahoGradeStandards[] = ALL_IDAHO_STANDARDS.filter(gs => {
      if (gs.subject !== subject) return false;
      if (grade && gs.grade !== grade) return false;
      return true;
    });
    standardsList = matchingGrades.flatMap(gs =>
      gs.standards.map(s => ({ code: s.code, description: s.description }))
    );
  }

  // Chunk questions to stay well under the 150s edge-function idle timeout.
  // Tagging ~8 questions per call keeps each invocation under ~30s.
  const BATCH = 8;
  const chunks: typeof questions[] = [];
  for (let i = 0; i < questions.length; i += BATCH) chunks.push(questions.slice(i, i + BATCH));

  const map = new Map<number, StandardMatch[]>();
  // Run a few batches in parallel; keep CONCURRENCY modest to avoid model rate limits.
  const CONCURRENCY = 3;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const slice = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(batch =>
        supabase.functions.invoke('standards-tagger', {
          body: { questions: batch, framework, subject, grade, keyTermsMap, standardsList },
        })
      )
    );
    for (const { data, error } of results) {
      if (error) throw new Error(error.message || 'Failed to tag questions with standards');
      if (data?.error) throw new Error(data.error);
      const tags: StandardTag[] = data.tags || [];
      for (const tag of tags) map.set(tag.question_id, tag.standards);
    }
  }
  return map;
}
