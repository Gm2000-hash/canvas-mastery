// Shared per-question AI standards tagger. Used by `tag-question-standards`
// (interactive, one assignment) and `tag-queue-worker` (background queue).
//
// Sends batches of ~10 questions (stem + answer choices) to the AI provider
// and stores ai_suggested rows in question_standards, rolling a union up to
// assignment_standards.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchChatCompletion } from "./openrouter.ts";

export type Tag = { code: string; description: string; matched_terms?: string[] };
type BatchResult = { question_id: number; standards: Tag[] };

/** Configuration problems the caller must surface (no discipline, no standards, no questions). */
export class TaggerConfigError extends Error {
  constructor(message: string) { super(message); this.name = "TaggerConfigError"; }
}

/** AI provider returned a hard error (401/402/403/429) — caller decides retry/pause semantics. */
export class TaggerProviderError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; this.name = "TaggerProviderError"; }
}

export interface TagResult {
  questions_total: number;
  questions_tagged: number;
  total_question_matches: number;
  assignment_rollup_count: number;
  batches: number;
  /** Question ids that were processed (sent to the AI) — regardless of whether a tag came back. */
  processed_question_ids: string[];
  discipline: { state: string | null; subject: string; grade: string; framework: string | null };
}

export function inferGradeFromText(text: string): string | null {
  const t = text.toLowerCase();
  const m1 = t.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/);
  if (m1) return m1[1];
  const m2 = t.match(/\bgrade\s*(\d{1,2})\b/);
  if (m2) return m2[1];
  const m3 = t.match(/\b(\d{1,2})\s*grade\b/);
  if (m3) return m3[1];
  if (/\b(kindergarten|kinder)\b/.test(t)) return "K";
  return null;
}

export function stripHtmlForTagger(input: string): string {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<img[^>]*>/gi, " ");
  s = s.replace(/<br\s*\/?>/gi, " ");
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|td)>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export function buildTaggerText(q: { question_text: string | null; answers: unknown }): string {
  const stem = stripHtmlForTagger(q.question_text || "");
  let out = `STEM: ${stem}`;
  const answers = Array.isArray(q.answers) ? q.answers : null;
  if (answers && answers.length > 0) {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const choices = answers
      .slice(0, 8)
      .map((a: any, i: number) => {
        const txt = stripHtmlForTagger(a?.text || a?.html || "");
        return txt ? `${letters[i]}) ${txt}` : null;
      })
      .filter(Boolean)
      .join(" ");
    if (choices) out += `\nCHOICES: ${choices}`;
  }
  if (out.length > 1500) out = out.slice(0, 1497) + "...";
  return out;
}

/** Resolve the effective discipline for an assignment's course. */
export async function resolveDiscipline(admin: SupabaseClient, teacherId: string, courseId: string) {
  let state: string | null = null, subject: string | null = null, grade: string | null = null;
  let framework: string | null = null;
  const { data: course } = await admin
    .from("courses").select("discipline_id, name, course_code").eq("id", courseId).maybeSingle();
  const disciplineId: string | null = course?.discipline_id ?? null;
  if (disciplineId) {
    const { data: d } = await admin
      .from("teacher_disciplines").select("state, subject, grade, framework").eq("id", disciplineId).maybeSingle();
    if (d) { state = d.state; subject = d.subject; grade = d.grade; framework = (d as any).framework ?? null; }
  } else {
    const { data: allDisc } = await admin
      .from("teacher_disciplines").select("id, state, subject, grade, framework, is_default")
      .eq("teacher_id", teacherId);
    const def = (allDisc ?? []).find((d) => d.is_default) ?? (allDisc ?? [])[0] ?? null;
    const haystack = `${course?.name ?? ""} ${course?.course_code ?? ""}`.toLowerCase();
    const inferredGrade = inferGradeFromText(haystack);
    let matched: typeof def | null = null;
    if (inferredGrade && def && allDisc) {
      matched = allDisc.find((d) =>
        String(d.grade).trim() === inferredGrade &&
        d.subject === def.subject &&
        (d.framework ?? null) === (def.framework ?? null),
      ) ?? null;
    }
    const chosen = matched ?? def;
    if (chosen) {
      state = chosen.state; subject = chosen.subject; grade = chosen.grade;
      framework = (chosen as any).framework ?? null;
    }
  }
  if (!subject || !grade) {
    const { data: profile } = await admin
      .from("profiles").select("state, default_subject, default_grade").eq("id", teacherId).maybeSingle();
    state ??= profile?.state ?? null;
    subject ??= profile?.default_subject ?? null;
    grade ??= profile?.default_grade ?? null;
  }
  if (state === "") state = null;
  if (!subject || !grade) {
    throw new TaggerConfigError("No discipline set. Add a discipline in Settings (or assign one to this course).");
  }
  return { state, subject, grade, framework };
}

export interface TagOptions {
  /** Restrict to these question ids (and clear their prior unconfirmed AI suggestions first). */
  questionIds?: string[] | null;
  /** When false, prior unconfirmed suggestions for the selected questions are kept. Default true when questionIds given. */
  clearPrior?: boolean;
}

export async function tagQuestionsForAssignment(
  admin: SupabaseClient,
  teacherId: string,
  assignmentId: string,
  opts: TagOptions = {},
): Promise<TagResult> {
  const onlyIds = opts.questionIds && opts.questionIds.length ? opts.questionIds : null;

  const { data: assignment, error: aErr } = await admin
    .from("assignments").select("id, name, kind, teacher_id, course_id").eq("id", assignmentId).single();
  if (aErr || !assignment) throw new TaggerConfigError("Assignment not found");
  if (assignment.teacher_id !== teacherId) throw new TaggerConfigError("Forbidden");

  const { state, subject, grade, framework } = await resolveDiscipline(admin, teacherId, assignment.course_id);

  let qQuery = admin
    .from("quiz_questions").select("id, position, question_text, points_possible, answers")
    .eq("assignment_id", assignmentId).order("position");
  if (onlyIds) qQuery = qQuery.in("id", onlyIds);
  const { data: questions, error: qErr } = await qQuery;
  if (qErr) throw qErr;
  if (onlyIds && questions?.length && (opts.clearPrior ?? true)) {
    await admin.from("question_standards").delete()
      .eq("teacher_id", teacherId).eq("confirmed", false).eq("ai_suggested", true)
      .in("question_id", questions.map((q) => q.id));
  }
  if (!questions || questions.length === 0) {
    throw new TaggerConfigError("This assignment has no synced questions. Run a Canvas sync first (Classic Quizzes only).");
  }

  let stdQuery = admin.from("standards").select("id, code, description, framework")
    .eq("subject", subject).eq("grade", grade).limit(500);
  if (framework && framework !== "STATE") stdQuery = stdQuery.eq("framework", framework);
  else stdQuery = stdQuery.eq("state", state);
  let { data: standards, error: sErr } = await stdQuery;
  if (sErr) throw sErr;
  if (!standards || standards.length === 0) {
    const fb = await admin.from("standards").select("id, code, description, framework")
      .eq("state", state).eq("subject", subject).eq("grade", grade).limit(500);
    standards = fb.data ?? [];
  }
  if (!standards || standards.length === 0) {
    throw new TaggerConfigError(
      `No standards found for ${framework ?? "STATE"} ${state ?? ""} ${subject} grade ${grade}. Seed them in Settings.`,
    );
  }
  const codeToId = new Map(standards.map((s) => [s.code, s.id]));
  const codes = standards.map((s) => s.code);
  const standardsListText = standards.map((s) => `- ${s.code}: ${s.description}`).join("\n");

  const sysPrompt = `You are an expert curriculum specialist for ${framework ?? "STATE"} ${subject} (Grade ${grade}). Given a batch of quiz questions, identify the most relevant standard(s) for each question.

You may ONLY use standards from this exact list:

${standardsListText}

RULES:
- ONLY use codes from the list above. Do NOT invent codes.
- The input may include answer choices after a \`CHOICES:\` marker — use them as PRIMARY evidence for the topic, since they often contain the key vocabulary (e.g. "mitochondria", "tectonic plates", "photosynthesis") that anchors the standard.
- If the stem is generic ("Which of the following…"), rely heavily on the CHOICES.
- KEYWORD MATCHING from the STANDARD'S LANGUAGE: Pay close attention to the specific verbs and nouns used in each standard's description. Look for those same words or close synonyms in the content.
- Try HARD to match every question. Use inference: content about "dinosaurs" relates to fossils; "weather" relates to atmosphere/climate standards; "cells" relates to cell-biology standards.
- Strip HTML tags mentally — focus on the actual content words.
- If content partially overlaps with a standard, tag it. Only return an empty array if the question is truly unrelated to ANY standard in the list.
- Prefer the most specific standard that matches the content (1–3 standards per question).
- For each match, return the standard code, brief description, and 2–5 matched_terms — terms from the question that led you to choose this standard.

Use the tool provided to return your analysis.`;

  const BATCH_SIZE = 10;
  const allResults: { question_id: string; tags: Tag[] }[] = [];
  const processed: string[] = [];
  let batchesRun = 0;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const slice = questions.slice(i, i + BATCH_SIZE);
    const questionListText = slice.map((q, idx) => `Question ${idx}: "${buildTaggerText(q)}"`).join("\n\n");

    const aiRes = await fetchChatCompletion({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: `Tag these quiz questions with standards:\n\n${questionListText}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "tag_standards",
          description: "Tag quiz questions with matching standards from the candidate list.",
          parameters: {
            type: "object",
            properties: {
              tags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question_id: { type: "number", description: "The question's index in this batch (0..N-1)." },
                    standards: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          code: { type: "string", enum: codes },
                          description: { type: "string" },
                          matched_terms: {
                            type: "array",
                            items: { type: "string", minLength: 2 },
                            description: "2-5 key terms from the question that justify this standard.",
                          },
                        },
                        required: ["code", "description", "matched_terms"],
                        additionalProperties: false,
                      },
                      maxItems: 3,
                    },
                  },
                  required: ["question_id", "standards"],
                  additionalProperties: false,
                },
              },
            },
            required: ["tags"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "tag_standards" } },
    });

    if (!aiRes.ok) {
      const status = aiRes.status;
      const t = await aiRes.text().catch(() => "");
      if (status === 401 || status === 402 || status === 403 || status === 429) {
        // Persist whatever we have so far before bubbling up.
        await persistResults(admin, teacherId, assignmentId, allResults, codeToId, questions.length);
        throw new TaggerProviderError(status, t.slice(0, 300));
      }
      console.error(`AI provider ${status} on batch ${batchesRun}: ${t.slice(0, 200)}`);
      batchesRun++;
      continue; // transient — skip this batch
    }

    batchesRun++;
    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    let batchTags: BatchResult[] = [];
    if (toolCall?.function?.arguments) {
      try { batchTags = JSON.parse(toolCall.function.arguments).tags ?? []; }
      catch (e) { console.error("parse args", e); }
    }
    const tagsByIdx = new Map<number, Tag[]>();
    for (const t of batchTags) tagsByIdx.set(t.question_id, t.standards ?? []);
    for (let k = 0; k < slice.length; k++) {
      processed.push(slice[k].id);
      const tags = tagsByIdx.get(k) ?? [];
      if (tags.length > 0) allResults.push({ question_id: slice[k].id, tags });
    }
  }

  const { qRows, aRows } = await persistResults(admin, teacherId, assignmentId, allResults, codeToId, questions.length);

  return {
    questions_total: questions.length,
    questions_tagged: allResults.length,
    total_question_matches: qRows,
    assignment_rollup_count: aRows,
    batches: batchesRun,
    processed_question_ids: processed,
    discipline: { state, subject, grade, framework },
  };
}

async function persistResults(
  admin: SupabaseClient,
  teacherId: string,
  assignmentId: string,
  allResults: { question_id: string; tags: Tag[] }[],
  codeToId: Map<string, string>,
  totalQuestions: number,
): Promise<{ qRows: number; aRows: number }> {
  const qRows: Record<string, unknown>[] = [];
  for (const r of allResults) {
    for (const t of r.tags) {
      const sid = codeToId.get(t.code);
      if (!sid) continue;
      const terms = Array.isArray(t.matched_terms) ? t.matched_terms.slice(0, 8) : [];
      qRows.push({
        teacher_id: teacherId,
        question_id: r.question_id,
        standard_id: sid,
        ai_suggested: true,
        // Question-level AI tags apply immediately (there is no separate review step).
        confirmed: true,
        confidence: 0.75,
        rationale: terms.length ? `AI match · key terms: ${terms.join(", ")}` : "AI match",
      });
    }
  }
  if (qRows.length) {
    const { error: insErr } = await admin.from("question_standards")
      .upsert(qRows, { onConflict: "question_id,standard_id", ignoreDuplicates: true });
    if (insErr) console.error("question_standards upsert", insErr);
  }

  const standardCounts = new Map<string, { count: number }>();
  for (const r of allResults) {
    const seen = new Set<string>();
    for (const t of r.tags) {
      const sid = codeToId.get(t.code);
      if (!sid || seen.has(sid)) continue;
      seen.add(sid);
      const cur = standardCounts.get(sid) ?? { count: 0 };
      cur.count += 1;
      standardCounts.set(sid, cur);
    }
  }
  const aRows = Array.from(standardCounts.entries()).map(([sid, info]) => ({
    teacher_id: teacherId,
    assignment_id: assignmentId,
    standard_id: sid,
    ai_suggested: true,
    confirmed: false,
    confidence: Math.min(0.95, 0.5 + (info.count / Math.max(totalQuestions, 1)) * 0.5),
    rationale: `Question-level rollup: matched on ${info.count} of ${totalQuestions} question${totalQuestions === 1 ? "" : "s"}.`,
  }));
  if (aRows.length) {
    const { error: rErr } = await admin.from("assignment_standards")
      .upsert(aRows, { onConflict: "assignment_id,standard_id", ignoreDuplicates: true });
    if (rErr) console.error("assignment_standards rollup", rErr);
  }
  return { qRows: qRows.length, aRows: aRows.length };
}
