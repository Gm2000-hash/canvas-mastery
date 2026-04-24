// AI-powered standards tagging for assignments.
// Input: { assignment_id }
// Reads the assignment + teacher's standards library, asks Lovable AI to pick the most relevant ones,
// and writes ai_suggested rows into assignment_standards.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
      .from("assignments").select("id, name, description, teacher_id").eq("id", assignment_id).single();
    if (aErr || !assignment) throw new Error("Assignment not found");
    if (assignment.teacher_id !== teacherId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles").select("state, default_subject, default_grade").eq("id", teacherId).single();

    // Candidate standards: everything the teacher can see (shared + own) for their default state/subject/grade
    let q = admin.from("standards").select("id, code, description, subject, grade, state");
    if (profile?.state) q = q.eq("state", profile.state);
    if (profile?.default_subject) q = q.eq("subject", profile.default_subject);
    if (profile?.default_grade) q = q.eq("grade", profile.default_grade);
    const { data: standards, error: sErr } = await q.limit(500);
    if (sErr) throw sErr;
    if (!standards || standards.length === 0) {
      return new Response(JSON.stringify({ error: "No standards available. Set your state/subject/grade and seed standards first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const codeToId = new Map(standards.map((s) => [s.code, s.id]));
    const candidateList = standards.map((s) => `${s.code} — ${s.description}`).join("\n");
    const codes = standards.map((s) => s.code);

    const sysPrompt =
      `You are an expert curriculum specialist. Given an assignment, choose the 1–3 state standards from the candidate list that BEST match what the assignment assesses. Only use codes that appear EXACTLY in the candidate list. Be conservative — if nothing fits well, return fewer or none.`;

    const userPrompt =
      `STATE: ${profile?.state ?? "?"}\nSUBJECT: ${profile?.default_subject ?? "?"}\nGRADE: ${profile?.default_grade ?? "?"}\n\n` +
      `ASSIGNMENT NAME: ${assignment.name}\n` +
      `ASSIGNMENT DESCRIPTION: ${assignment.description ?? "(none)"}\n\n` +
      `CANDIDATE STANDARDS:\n${candidateList}`;

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
                    },
                    required: ["standard_code", "confidence", "rationale"],
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
    let matches: Array<{ standard_code: string; confidence: number; rationale: string }> = [];
    if (toolCall?.function?.arguments) {
      try { matches = JSON.parse(toolCall.function.arguments).matches ?? []; } catch (e) { console.error("parse args", e); }
    }

    // Insert ai_suggested rows (skip duplicates)
    const rows = matches
      .map((m) => {
        const sid = codeToId.get(m.standard_code);
        if (!sid) return null;
        return {
          teacher_id: teacherId,
          assignment_id,
          standard_id: sid,
          ai_suggested: true,
          confirmed: false,
          confidence: m.confidence,
          rationale: m.rationale,
        };
      })
      .filter(Boolean) as any[];

    if (rows.length) {
      const { error: insErr } = await admin.from("assignment_standards")
        .upsert(rows, { onConflict: "assignment_id,standard_id", ignoreDuplicates: true });
      if (insErr) console.error("insert suggestions", insErr);
    }

    return new Response(JSON.stringify({ success: true, suggestions: matches }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tag-standards error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
