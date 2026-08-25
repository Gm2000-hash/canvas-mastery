// Generates a starter standards library for a teacher's (framework, state, subject, grade)
// using AI, then inserts them as shared (teacher_id NULL) so other teachers benefit too.
// Skips if standards for that combo already exist (unless replace=true).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  aiProviderErrorMessage,
  fetchChatCompletion,
  getAiProviderConfig,
  isAiProviderHardError,
} from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type FrameworkId = "STATE" | "NGSS" | "CCSS_MATH" | "CCSS_ELA" | "C3_SS" | "AP" | "IB" | "CUSTOM";

function frameworkPrompt(framework: FrameworkId, state: string, subject: string, grade: string) {
  switch (framework) {
    case "NGSS":
      return {
        sys: "You are an expert on the Next Generation Science Standards (NGSS), a national K-12 framework. Return the official NGSS performance expectations using the exact published codes (e.g. MS-PS1-1, HS-LS3-2, 5-PS2-1). NGSS is national; the state field is just context.",
        user: `Return the full list of NGSS performance expectations relevant to GRADE=${grade}, SUBJECT=${subject}. Use NGSS codes only.`,
      };
    case "CCSS_MATH":
      return {
        sys: "You are an expert on the Common Core State Standards for Mathematics (CCSS-M), a national framework. Use the exact published codes (e.g. CCSS.MATH.CONTENT.7.RP.A.2, CCSS.MATH.CONTENT.HSA.REI.B.3).",
        user: `Return the full list of CCSS-M standards for GRADE=${grade}. Use CCSS math codes only.`,
      };
    case "CCSS_ELA":
      return {
        sys: "You are an expert on the Common Core State Standards for English Language Arts & Literacy (CCSS-ELA), a national framework. Use the exact published codes (e.g. CCSS.ELA-LITERACY.RL.7.1, CCSS.ELA-LITERACY.W.8.2.A).",
        user: `Return the full list of CCSS-ELA standards for GRADE=${grade}. Use CCSS ELA codes only.`,
      };
    case "C3_SS":
      return {
        sys: "You are an expert on the College, Career, and Civic Life (C3) Framework for Social Studies State Standards (national). Use the published C3 indicator codes (e.g. D2.His.1.6-8, D3.4.6-8).",
        user: `Return the C3 indicators relevant to GRADE=${grade}, SUBJECT=${subject || "Social Studies"}.`,
      };
    case "AP":
      return {
        sys: "You are an expert on College Board Advanced Placement (AP) course frameworks. Return Learning Objectives and/or Essential Knowledge statements using the published codes (e.g. ENE-1.A, MUC-1.B).",
        user: `Return the published Learning Objectives for the AP ${subject} course (treat GRADE=${grade} as context for which AP course is intended, e.g. AP Biology, AP US History).`,
      };
    case "IB":
      return {
        sys: "You are an expert on International Baccalaureate (IB) subject guides. Return the assessment objectives / topic-level learning outcomes with their topic numbers (e.g. Topic 1.1, AO2).",
        user: `Return the IB subject-guide learning outcomes for SUBJECT=${subject}, GRADE/LEVEL=${grade}.`,
      };
    case "STATE":
    default:
      return {
        sys: "You are an expert on US K-12 state academic standards. Return the official standards list as accurately as you can, using the exact published codes the state uses (e.g. TEKS 7.4(A), Idaho 6.PS1.1, NJSLS-S.MS-PS1-1).",
        user: `Return the full list of ${state}'s official content standards for SUBJECT=${subject}, GRADE=${grade}. Use ${state}'s own published codes — NOT Common Core or NGSS unless ${state} has officially adopted them verbatim. Include every standard at the most granular level that's typically assessed.`,
      };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { provider } = getAiProviderConfig();

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

    const body = await req.json().catch(() => ({}));
    const state: string = (body.state ?? "").toString().trim();
    const subject: string = (body.subject ?? "").toString().trim();
    const grade: string = (body.grade ?? "").toString().trim();
    const framework: FrameworkId = ((body.framework ?? "STATE").toString().trim().toUpperCase() as FrameworkId);
    const replace: boolean = !!body.replace;

    if (!subject || !grade) {
      return new Response(JSON.stringify({ error: "subject and grade required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (framework === "STATE" && !state) {
      return new Response(JSON.stringify({ error: "state required for STATE framework" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (framework === "CUSTOM") {
      return new Response(JSON.stringify({ error: "Custom libraries can't be auto-seeded — add standards by hand on the Standards page." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // For national frameworks the state isn't really a key — store empty string so
    // every teacher shares one library per (framework, subject, grade).
    const storedState = framework === "STATE" ? state : (state || "");

    // Skip if already seeded (unless replace=true)
    {
      let countQuery = admin.from("standards")
        .select("id", { count: "exact", head: true })
        .eq("subject", subject).eq("grade", grade)
        .eq("framework", framework)
        .is("teacher_id", null);
      if (storedState) countQuery = countQuery.eq("state", storedState);
      else countQuery = countQuery.or("state.is.null,state.eq.");
      const { count } = await countQuery;
      if ((count ?? 0) > 0 && !replace) {
        return new Response(JSON.stringify({ success: true, skipped: true, existing: count }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if ((count ?? 0) > 0 && replace) {
        let delQuery = admin.from("standards").delete()
          .eq("subject", subject).eq("grade", grade)
          .eq("framework", framework)
          .is("teacher_id", null);
        if (storedState) delQuery = delQuery.eq("state", storedState);
        const { error: delErr } = await delQuery;
        if (delErr) console.error("replace delete error", delErr);
      }
    }

    const { sys, user } = frameworkPrompt(framework, state, subject, grade);

    const aiRes = await fetchChatCompletion({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
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
    });

    if (!aiRes.ok) {
      if (isAiProviderHardError(aiRes.status)) {
        return new Response(JSON.stringify({ error: aiProviderErrorMessage(aiRes.status, provider) }), {
          status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        state: storedState || state || "",
        subject,
        grade,
        framework,
      }));

    const { error: insErr } = await admin.from("standards").insert(rows);
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ success: true, inserted: rows.length, framework }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-standards error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
