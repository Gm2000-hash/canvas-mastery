// Per-question AI standards tagging.
// Input: { assignment_id }  (must be a quiz assignment with synced questions)
// For EACH question, asks Lovable AI to pick 1-3 standards from the candidate list,
// requiring ≥ 8 distinct keyword/phrase pieces of evidence per standard match.
// Then rolls the union of question-level matches up to assignment_standards.
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

type Match = { standard_code: string; confidence: number; rationale: string; keywords?: string[] };

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

    // Load questions
    const { data: questions, error: qErr } = await admin
      .from("quiz_questions").select("id, position, question_text, points_possible")
      .eq("assignment_id", assignment_id).order("position");
    if (qErr) throw qErr;
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({
        error: "This assignment has no synced questions. Run a Canvas sync first (Classic Quizzes only).",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load candidate standards once — prefer the discipline's framework, but
    // fall back to any framework for the same (subject, grade) so legacy
    // libraries (with NULL framework) still work.
    let stdQuery = admin.from("standards").select("id, code, description, framework")
      .eq("subject", subject).eq("grade", grade).limit(500);
    if (framework && framework !== "STATE") {
      // National framework: don't require state match
      stdQuery = stdQuery.eq("framework", framework);
    } else {
      stdQuery = stdQuery.eq("state", state);
    }
    let { data: standards, error: sErr } = await stdQuery;
    if (sErr) throw sErr;
    if (!standards || standards.length === 0) {
      // Fallback: any standards for (state, subject, grade) regardless of framework
      const fb = await admin.from("standards").select("id, code, description, framework")
        .eq("state", state).eq("subject", subject).eq("grade", grade).limit(500);
      standards = fb.data ?? [];
    }
    if (!standards || standards.length === 0) {
      return new Response(JSON.stringify({
        error: `No standards found for ${state} ${subject} grade ${grade}. Seed them in Settings.`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const codeToId = new Map(standards.map((s) => [s.code, s.id]));
    const candidateList = standards.map((s) => `${s.code} — ${s.description}`).join("\n");
    const codes = standards.map((s) => s.code);

    const sysPrompt =
      `You are an expert curriculum specialist. Given a single assessment QUESTION, choose the 1–3 state standards from the candidate list that BEST match what the question is assessing. ` +
      `Only use codes that appear EXACTLY in the candidate list. Be conservative — if nothing fits well, return fewer or none.\n\n` +
      `EVIDENCE REQUIREMENT (STRICT): For every standard you propose, you MUST extract at least 8 distinct key words or short key phrases (1–4 words each) drawn from BOTH the question text AND the standard's description that justify the match. ` +
      `Do not repeat the same word; do not use generic filler ("the", "students", "learn"). If you cannot find at least 8 substantive overlapping keywords for a standard, DO NOT include that standard.`;

    // Process each question, with light concurrency to keep the function fast
    const CONCURRENCY = 4;
    const perQuestion: { question_id: string; matches: Match[] }[] = [];

    async function tagOne(q: typeof questions[number]) {
      const userPrompt =
        `STATE: ${state}\nSUBJECT: ${subject}\nGRADE: ${grade}\n\n` +
        `ASSIGNMENT: ${assignment.name}\n` +
        `QUESTION #${q.position ?? "?"} (${q.points_possible ?? "?"} pts):\n${q.question_text ?? "(no text)"}\n\n` +
        `CANDIDATE STANDARDS:\n${candidateList}\n\n` +
        `Remember: each match needs ≥ 8 substantive keywords/phrases drawn from both the question and the standard description. Drop any standard that doesn't meet this bar.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "tag_standards",
              description: "Return the matching standards from the candidate list for this single question.",
              parameters: {
                type: "object",
                properties: {
                  matches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        standard_code: { type: "string", enum: codes },
                        confidence: { type: "number", minimum: 0, maximum: 1 },
                        rationale: { type: "string" },
                        keywords: {
                          type: "array",
                          description: "≥ 8 distinct keywords/short phrases (1-4 words) from BOTH the question and the standard description.",
                          items: { type: "string", minLength: 2 },
                          minItems: 8,
                        },
                      },
                      required: ["standard_code", "confidence", "rationale", "keywords"],
                      additionalProperties: false,
                    },
                    maxItems: 3,
                  },
                },
                required: ["matches"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "tag_standards" } },
        }),
      });

      if (!aiRes.ok) {
        if (aiRes.status === 429 || aiRes.status === 402) {
          throw { httpStatus: aiRes.status };
        }
        const t = await aiRes.text();
        console.error(`AI gateway ${aiRes.status} for q ${q.id}: ${t.slice(0, 200)}`);
        return { question_id: q.id, matches: [] as Match[] };
      }

      const aiJson = await aiRes.json();
      const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
      let matches: Match[] = [];
      if (toolCall?.function?.arguments) {
        try { matches = JSON.parse(toolCall.function.arguments).matches ?? []; } catch (e) { console.error("parse args", e); }
      }
      // Server-side enforce ≥ 8 distinct substantive keywords
      matches = matches.filter((m) => {
        const kws = Array.isArray(m.keywords) ? m.keywords : [];
        const distinct = Array.from(new Set(kws.map((k) => String(k).trim().toLowerCase()).filter((k) => k.length >= 2)));
        return distinct.length >= 8;
      });
      return { question_id: q.id, matches };
    }

    // Run with bounded concurrency
    for (let i = 0; i < questions.length; i += CONCURRENCY) {
      const slice = questions.slice(i, i + CONCURRENCY);
      try {
        const results = await Promise.all(slice.map(tagOne));
        perQuestion.push(...results);
      } catch (e: any) {
        if (e?.httpStatus === 429) {
          return new Response(JSON.stringify({ error: "AI rate limit reached. Try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (e?.httpStatus === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace Settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw e;
      }
    }

    // Persist question_standards
    const qRows: any[] = [];
    for (const r of perQuestion) {
      for (const m of r.matches) {
        const sid = codeToId.get(m.standard_code);
        if (!sid) continue;
        const distinct = Array.from(new Set((m.keywords ?? []).map((k) => String(k).trim().toLowerCase()).filter((k) => k.length >= 2)));
        qRows.push({
          teacher_id: teacherId,
          question_id: r.question_id,
          standard_id: sid,
          ai_suggested: true,
          confirmed: false,
          confidence: m.confidence,
          rationale: `${m.rationale}\n\nKey evidence: ${distinct.slice(0, 16).join(", ")}`,
        });
      }
    }
    if (qRows.length) {
      const { error: insErr } = await admin.from("question_standards")
        .upsert(qRows, { onConflict: "question_id,standard_id", ignoreDuplicates: true });
      if (insErr) console.error("question_standards upsert", insErr);
    }

    // Roll up: union of all question-level standards → assignment_standards (ai_suggested)
    // Aggregate confidence as the MAX confidence across questions for that standard,
    // and rationale = "Tagged on N of M questions"
    const totalQuestions = questions.length;
    const standardCounts = new Map<string, { count: number; maxConf: number; codes: Set<string> }>();
    for (const r of perQuestion) {
      const seenInThisQ = new Set<string>();
      for (const m of r.matches) {
        const sid = codeToId.get(m.standard_code);
        if (!sid || seenInThisQ.has(sid)) continue;
        seenInThisQ.add(sid);
        const cur = standardCounts.get(sid) ?? { count: 0, maxConf: 0, codes: new Set<string>() };
        cur.count += 1;
        cur.maxConf = Math.max(cur.maxConf, m.confidence ?? 0);
        cur.codes.add(m.standard_code);
        standardCounts.set(sid, cur);
      }
    }
    const aRows = Array.from(standardCounts.entries()).map(([sid, info]) => ({
      teacher_id: teacherId,
      assignment_id,
      standard_id: sid,
      ai_suggested: true,
      confirmed: false,
      confidence: info.maxConf,
      rationale: `Question-level rollup: matched on ${info.count} of ${totalQuestions} question${totalQuestions === 1 ? "" : "s"}.`,
    }));
    if (aRows.length) {
      const { error: rErr } = await admin.from("assignment_standards")
        .upsert(aRows, { onConflict: "assignment_id,standard_id", ignoreDuplicates: true });
      if (rErr) console.error("assignment_standards rollup", rErr);
    }

    return new Response(JSON.stringify({
      success: true,
      questions_tagged: perQuestion.length,
      total_question_matches: qRows.length,
      assignment_rollup_count: aRows.length,
      discipline: { state, subject, grade },
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
