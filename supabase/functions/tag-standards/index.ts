// AI-powered standards tagging for assignments.
// Input: { assignment_id }
// Resolves the assignment's effective discipline (course-level mapping or teacher default),
// loads candidate standards for THAT discipline, asks Lovable AI to pick the best matches,
// and writes ai_suggested rows into assignment_standards.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Infer a grade label (e.g. "6", "7", "8", "K") from a course name/code.
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

// Strip HTML tags and collapse whitespace — Canvas question text is usually HTML.
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

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
      .from("assignments").select("id, name, kind, description, teacher_id, course_id").eq("id", assignment_id).single();
    if (aErr || !assignment) throw new Error("Assignment not found");
    if (assignment.teacher_id !== teacherId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve effective discipline: course mapping → infer from course name → teacher default → profile fallback
    let state: string | null = null;
    let subject: string | null = null;
    let grade: string | null = null;
    let framework: string | null = null;
    let disciplineSource = "course"; // for the response, so the UI can explain mismatches

    const { data: course } = await admin
      .from("courses").select("discipline_id, name, course_code").eq("id", assignment.course_id).maybeSingle();

    let disciplineId: string | null = course?.discipline_id ?? null;
    if (disciplineId) {
      const { data: d } = await admin
        .from("teacher_disciplines").select("state, subject, grade, framework").eq("id", disciplineId).maybeSingle();
      if (d) { state = d.state; subject = d.subject; grade = d.grade; framework = (d as any).framework ?? null; }
    } else {
      // Load all the teacher's disciplines so we can both pick a default AND try grade inference
      const { data: allDisc } = await admin
        .from("teacher_disciplines").select("id, state, subject, grade, framework, is_default")
        .eq("teacher_id", teacherId);
      const def = (allDisc ?? []).find((d) => d.is_default) ?? (allDisc ?? [])[0] ?? null;

      // Try to infer the course's grade from its name/code (e.g. "8th Science B", "Grade 6 Math")
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
        disciplineSource = matched ? "inferred" : "default";
      }
    }

    // Profile fallback (legacy, before disciplines were introduced)
    if (!subject || !grade) {
      const { data: profile } = await admin
        .from("profiles").select("state, default_subject, default_grade").eq("id", teacherId).maybeSingle();
      state ??= profile?.state ?? null;
      subject ??= profile?.default_subject ?? null;
      grade ??= profile?.default_grade ?? null;
      disciplineSource = "profile";
    }

    // State is optional (national frameworks like NGSS/CCSS don't need one).
    // Normalize empty string → null so downstream queries behave consistently.
    if (state === "") state = null;

    if (!subject || !grade) {
      return new Response(JSON.stringify({
        error: "No discipline set. Add a discipline in Settings (or assign one to this course).",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load candidate standards — prefer the discipline's framework, with a
    // graceful fallback to (state, subject, grade) so legacy NULL-framework
    // libraries still match.
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
        error: `No standards found for ${framework ?? "STATE"} ${state} ${subject} grade ${grade}. Seed them in Settings.`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const codeToId = new Map(standards.map((s) => [s.code, s.id]));
    const candidateList = standards.map((s) => `${s.code} — ${s.description}`).join("\n");
    const codes = standards.map((s) => s.code);

    const sysPrompt =
      `You are an expert curriculum specialist. Given an assignment (or assessment question), choose the 1–3 state standards from the candidate list that BEST match what is being assessed. ` +
      `Only use codes that appear EXACTLY in the candidate list. Be conservative — if nothing fits well, return fewer or none.\n\n` +
      `EVIDENCE REQUIREMENT (STRICT): For every standard you propose, you MUST extract at least 8 distinct key words or short key phrases (1–4 words each) drawn from BOTH the assignment text AND the standard's description that justify the match. ` +
      `These keywords should be the specific concepts, skills, verbs, nouns, or domain terms that overlap (e.g., "linear equation", "slope", "two variables", "graph", "solve", "y-intercept", "table of values", "system"). ` +
      `Do not repeat the same word; do not use generic filler ("the", "students", "learn"). If you cannot find at least 8 substantive overlapping keywords for a standard, DO NOT include that standard in the matches.`;

    // For quizzes: pull a sampling of stored question text so the AI has real
    // content to ground its match on (descriptions are often boilerplate).
    let questionsBlock = "";
    let questionsUsed = 0;
    if ((assignment as any).kind === "quiz") {
      const { data: qs } = await admin
        .from("quiz_questions")
        .select("position, question_text")
        .eq("assignment_id", assignment_id)
        .order("position", { ascending: true, nullsFirst: false })
        .limit(40);
      if (qs && qs.length) {
        const lines: string[] = [];
        let used = 0;
        const CHAR_BUDGET = 6000;
        for (const q of qs) {
          const txt = stripHtml(q.question_text ?? "");
          if (!txt) continue;
          const line = `Q${q.position ?? "?"}: ${txt}`;
          if (used + line.length > CHAR_BUDGET) break;
          lines.push(line);
          used += line.length + 1;
          questionsUsed++;
        }
        if (lines.length) {
          questionsBlock = `\nQUIZ QUESTIONS (sample of ${lines.length} of ${qs.length}):\n${lines.join("\n")}\n`;
        }
      }
    }

    const userPrompt =
      `STATE: ${state}\nSUBJECT: ${subject}\nGRADE: ${grade}\n\n` +
      `ASSIGNMENT NAME: ${assignment.name}\n` +
      `ASSIGNMENT DESCRIPTION: ${assignment.description ?? "(none)"}\n` +
      questionsBlock + `\n` +
      `CANDIDATE STANDARDS:\n${candidateList}\n\n` +
      `Remember: each match needs ≥ 8 substantive keywords/phrases drawn from both the assignment (including any quiz questions above) and the standard description. Drop any standard that doesn't meet this bar.`;

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
            description: "Return the matching standards from the candidate list.",
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
                        description: "At least 8 distinct key words/short phrases (1-4 words) drawn from BOTH the assignment text and the standard description that justify the match.",
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
      throw new Error(`AI gateway ${aiRes.status}: ${t.slice(0, 200)}`);
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    let matches: Array<{ standard_code: string; confidence: number; rationale: string; keywords?: string[] }> = [];
    if (toolCall?.function?.arguments) {
      try { matches = JSON.parse(toolCall.function.arguments).matches ?? []; } catch (e) { console.error("parse args", e); }
    }

    const rows = matches
      .map((m: any) => {
        const sid = codeToId.get(m.standard_code);
        if (!sid) return null;
        // Enforce: drop matches that didn't supply ≥ 8 distinct substantive keywords.
        const kws: string[] = Array.isArray(m.keywords) ? m.keywords : [];
        const distinct = Array.from(new Set(kws.map((k) => String(k).trim().toLowerCase()).filter((k) => k.length >= 2)));
        if (distinct.length < 8) return null;
        const rationale = `${m.rationale}\n\nKey evidence: ${distinct.slice(0, 16).join(", ")}`;
        return {
          teacher_id: teacherId,
          assignment_id,
          standard_id: sid,
          ai_suggested: true,
          confirmed: false,
          confidence: m.confidence,
          rationale,
        };
      })
      .filter(Boolean) as any[];

    if (rows.length) {
      const { error: insErr } = await admin.from("assignment_standards")
        .upsert(rows, { onConflict: "assignment_id,standard_id", ignoreDuplicates: true });
      if (insErr) console.error("insert suggestions", insErr);
    }

    return new Response(JSON.stringify({
      success: true,
      suggestions: matches,
      stored: rows.length,
      candidate_count: standards.length,
      questions_used: questionsUsed,
      discipline: { state, subject, grade, framework, source: disciplineSource },
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tag-standards error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
