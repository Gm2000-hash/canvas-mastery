// Generates a starter standards library for a teacher's state/subject/grade using AI,
// then inserts them as shared (teacher_id NULL) so other teachers benefit too.
// Skips if standards for that combo already exist.
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

    const { state, subject, grade } = await req.json();
    if (!state || !subject || !grade) {
      return new Response(JSON.stringify({ error: "state, subject, grade required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Skip if already seeded
    const { count } = await admin.from("standards")
      .select("id", { count: "exact", head: true })
      .eq("state", state).eq("subject", subject).eq("grade", grade)
      .is("teacher_id", null);
    if ((count ?? 0) > 0) {
      return new Response(JSON.stringify({ success: true, skipped: true, existing: count }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert on US K-12 state academic standards. Return the official standards list as accurately as you can. Use the exact published codes (e.g. CCSS.MATH.7.RP.A.2, TEKS 7.4(A), NGSS MS-PS1-1)." },
          { role: "user", content: `Return the full list of academic content standards for: STATE=${state}, SUBJECT=${subject}, GRADE=${grade}. If the state uses Common Core / NGSS, use those codes. Include every standard at the most granular level that's typically assessed.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_standards",
            description: "Return an array of standards.",
            parameters: {
              type: "object",
              properties: {
                standards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      code: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["code", "description"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["standards"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_standards" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiRes.text();
      throw new Error(`AI ${aiRes.status}: ${t.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI returned no tool call");
    const parsed = JSON.parse(args);
    const standards: Array<{ code: string; description: string }> = parsed.standards ?? [];

    if (!standards.length) {
      return new Response(JSON.stringify({ error: "AI returned no standards" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedupe by code
    const seen = new Set<string>();
    const rows = standards
      .filter((s) => s.code && s.description && !seen.has(s.code) && (seen.add(s.code), true))
      .map((s) => ({
        teacher_id: null,
        code: s.code.trim(),
        description: s.description.trim().slice(0, 1000),
        state, subject, grade,
      }));

    const { error: insErr } = await admin.from("standards").insert(rows);
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ success: true, inserted: rows.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-standards error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
