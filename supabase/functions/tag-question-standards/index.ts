// Per-question AI standards tagging — batched approach.
// Input: { assignment_id }  (must be a quiz assignment with synced questions)
//
// Calls Lovable AI with batches of ~10 questions at a time, each enriched with
// answer choices ("STEM: ... / CHOICES: A) ... B) ..."). Stores results as
// ai_suggested rows in question_standards and rolls a union up to assignment_standards.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function inferGradeFromText(text: string): string | null {
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

// Decode common HTML entities & strip tags. Drops <img>/<iframe>/<style>/<script> contents.
function stripHtmlForTagger(input: string): string {
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

// Build a sanitized payload string for the standards tagger.
// Strips HTML, decodes entities, appends answer choices when present.
function buildTaggerText(q: { question_text: string | null; answers: any }): string {
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

type Tag = { code: string; description: string; matched_terms?: string[] };
type BatchResult = { question_id: number; standards: Tag[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const teacherId = userData.user.id;

    const { assignment_id } = await req.json();
    if (!assignment_id) {
      return new Response(JSON.stringify({ error: "assignment_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: assignment, error: aErr } = await admin
      .from("assignments").select("id, name, kind, teacher_id, course_id").eq("id", assignment_id).single();
    if (aErr || !assignment) throw new Error("Assignment not found");
    if (assignment.teacher_id !== teacherId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve effective discipline (course → infer-from-name → teacher default → legacy profile)
    let state: string | null = null, subject: string | null = null, grade: string | null = null;
    let framework: string | null = null;
    const { data: course } = await admin
      .from("courses").select("discipline_id, name, course_code").eq("id", assignment.course_id).maybeSingle();
    let disciplineId: string | null = course?.discipline_id ?? null;
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
        disciplineId = chosen.id;
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
      return new Response(JSON.stringify({
        error: "No discipline set. Add a discipline in Settings (or assign one to this course).",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load questions (now including answers jsonb)
    const { data: questions, error: qErr } = await admin
      .from("quiz_questions").select("id, position, question_text, points_possible, answers")
      .eq("assignment_id", assignment_id).order("position");
    if (qErr) throw qErr;
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({
        error: "This assignment has no synced questions. Run a Canvas sync first (Classic Quizzes only).",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load candidate standards once — prefer the discipline's framework, but
    // fall back to (state, subject, grade) so legacy NULL-framework libraries match.
    let stdQuery = admin.from("standards").select("id, code, description, framework")
      .eq("subject", subject).eq("grade", grade).limit(500);
    if (framework && framework !== "STATE") {
      stdQuery = stdQuery.eq("framework", framework);
    } else {
      stdQuery = stdQuery.eq("state", state);
    }
    let { data: standards, error: sErr } = await stdQuery;
    if (sErr) throw sErr;
    if (!standards || standards.length === 0) {
      const fb = await admin.from("standards").select("id, code, description, framework")
        .eq("state", state).eq("subject", subject).eq("grade", grade).limit(500);
      standards = fb.data ?? [];
    }
    if (!standards || standards.length === 0) {
      return new Response(JSON.stringify({
        error: `No standards found for ${framework ?? "STATE"} ${state ?? ""} ${subject} grade ${grade}. Seed them in Settings.`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // Batch the questions in groups of ~10.
    const BATCH_SIZE = 10;
    const allResults: { question_id: string; tags: Tag[] }[] = [];
    let batchesRun = 0;

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const slice = questions.slice(i, i + BATCH_SIZE);
      // Use small numeric ids 0..N-1 in-prompt; we'll map back via index
      const questionListText = slice.map((q, idx) => {
        const text = buildTaggerText(q);
        return `Question ${idx}: "${text}"`;
      }).join("\n\n");

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      if (!aiRes.ok) {
        if (aiRes.status === 429) {
          return new Response(JSON.stringify({ error: "AI rate limit reached. Try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiRes.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace Settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await aiRes.text();
        console.error(`AI gateway ${aiRes.status} on batch ${batchesRun}: ${t.slice(0, 200)}`);
        // skip this batch and continue
        batchesRun++;
        continue;
      }

      batchesRun++;
      const aiJson = await aiRes.json();
      const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
      let batchTags: BatchResult[] = [];
      if (toolCall?.function?.arguments) {
        try { batchTags = JSON.parse(toolCall.function.arguments).tags ?? []; }
        catch (e) { console.error("parse args", e); }
      }
      // Map idx -> actual question id
      const tagsByIdx = new Map<number, Tag[]>();
      for (const t of batchTags) tagsByIdx.set(t.question_id, t.standards ?? []);
      for (let k = 0; k < slice.length; k++) {
        const tags = tagsByIdx.get(k) ?? [];
        if (tags.length > 0) {
          allResults.push({ question_id: slice[k].id, tags });
        }
      }
    }

    // Persist question_standards rows
    const qRows: any[] = [];
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
          confirmed: false,
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

    // Roll up question-level matches → assignment_standards
    const totalQuestions = questions.length;
    const standardCounts = new Map<string, { count: number; codes: Set<string> }>();
    for (const r of allResults) {
      const seen = new Set<string>();
      for (const t of r.tags) {
        const sid = codeToId.get(t.code);
        if (!sid || seen.has(sid)) continue;
        seen.add(sid);
        const cur = standardCounts.get(sid) ?? { count: 0, codes: new Set<string>() };
        cur.count += 1;
        cur.codes.add(t.code);
        standardCounts.set(sid, cur);
      }
    }
    const aRows = Array.from(standardCounts.entries()).map(([sid, info]) => ({
      teacher_id: teacherId,
      assignment_id,
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

    return new Response(JSON.stringify({
      success: true,
      questions_total: totalQuestions,
      questions_tagged: allResults.length,
      total_question_matches: qRows.length,
      assignment_rollup_count: aRows.length,
      batches: batchesRun,
      discipline: { state, subject, grade, framework },
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tag-question-standards error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
