// Extracts a list of content standards from a teacher-supplied URL or PDF.
// Returns the parsed list (does NOT insert) so the teacher can review/edit
// before saving. Saving happens client-side via a normal supabase insert
// (RLS allows teachers to insert their own standards rows).
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

const MAX_PDF_BYTES = 12 * 1024 * 1024; // 12 MB safety cap
const MAX_URL_TEXT_CHARS = 250_000;

function stripHtml(html: string): string {
  // Remove scripts/styles, then tags, then collapse whitespace.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const { provider } = await getAiProviderConfig();

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
    const sourceUrl: string = (body.url ?? "").toString().trim();
    const pdfBase64: string = (body.pdfBase64 ?? "").toString();
    const fileName: string = (body.fileName ?? "uploaded.pdf").toString();
    const subject: string = (body.subject ?? "").toString().trim();
    const grade: string = (body.grade ?? "").toString().trim();
    const state: string = (body.state ?? "").toString().trim();
    const framework: string = (body.framework ?? "CUSTOM").toString().trim();

    if (!sourceUrl && !pdfBase64) {
      return new Response(JSON.stringify({ error: "Provide either a url or a pdfBase64." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the user content: either text scraped from the URL, or the PDF as a data URI.
    const userContent: any[] = [];
    let sourceLabel = "";

    if (sourceUrl) {
      try {
        new URL(sourceUrl);
      } catch {
        return new Response(JSON.stringify({ error: "Invalid URL." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const fetched = await fetch(sourceUrl, {
        headers: { "User-Agent": "StandardsTrack/1.0 (+import)" },
      });
      if (!fetched.ok) {
        return new Response(JSON.stringify({ error: `Could not fetch URL (HTTP ${fetched.status}).` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const contentType = fetched.headers.get("content-type") ?? "";
      if (contentType.includes("application/pdf")) {
        // URL points directly to a PDF — pull bytes and pass as data URI.
        const buf = new Uint8Array(await fetched.arrayBuffer());
        if (buf.byteLength > MAX_PDF_BYTES) {
          return new Response(JSON.stringify({ error: "PDF at URL is too large (max 12 MB)." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const b64 = btoa(String.fromCharCode(...buf));
        userContent.push({
          type: "image_url",
          image_url: { url: `data:application/pdf;base64,${b64}` },
        });
        sourceLabel = `PDF at ${sourceUrl}`;
      } else {
        const html = await fetched.text();
        const text = stripHtml(html).slice(0, MAX_URL_TEXT_CHARS);
        if (!text || text.length < 50) {
          return new Response(JSON.stringify({ error: "Could not extract readable text from that URL." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userContent.push({ type: "text", text: `WEBPAGE CONTENT (from ${sourceUrl}):\n\n${text}` });
        sourceLabel = sourceUrl;
      }
    } else {
      // Inline PDF upload
      const cleaned = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      // Cheap size check — base64 is ~4/3 of bytes
      if (cleaned.length * 0.75 > MAX_PDF_BYTES) {
        return new Response(JSON.stringify({ error: "PDF is too large (max 12 MB)." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userContent.push({
        type: "image_url",
        image_url: { url: `data:application/pdf;base64,${cleaned}` },
      });
      sourceLabel = fileName;
    }

    const sys = `You are an expert at extracting K-12 academic content standards from official documents.
You will receive either the text of a webpage or a PDF document. Identify every distinct content standard / learning objective / performance expectation in it.
For each one return:
- "code": the exact published identifier (e.g. "SS.WGH.1.1", "MS-PS1-1", "CCSS.MATH.CONTENT.7.RP.A.2"). If the document does not give an explicit code, invent a short stable label like "Theme 1 — Geography".
- "description": the standard's full text, cleaned up (remove page numbers, header/footer noise, hyphenated line breaks). Keep it under 800 characters.

Rules:
- Do NOT include section headers, table-of-contents lines, or page numbers as standards.
- Do NOT duplicate the same standard.
- Preserve the document's hierarchy in the code (e.g. "1.1.A") when present.
- Return EVERY standard you find — do not summarize or sample.`;

    const userInstruction = `Extract every content standard from the source below.
Context (use as a hint, but trust the document):
- Framework: ${framework}
- State: ${state || "(n/a)"}
- Subject: ${subject || "(unspecified)"}
- Grade: ${grade || "(unspecified)"}
- Source: ${sourceLabel}`;

    userContent.unshift({ type: "text", text: userInstruction });

    const aiRes = await fetchChatCompletion({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userContent },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_standards",
          description: "Return an array of standards extracted from the source.",
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
      console.error("AI provider error", aiRes.status, t.slice(0, 400));
      throw new Error(`AI ${aiRes.status}`);
    }

    const aiJson = await aiRes.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI returned no tool call");
    const parsed = JSON.parse(args);
    const raw: Array<{ code: string; description: string }> = parsed.standards ?? [];

    // Dedupe by code, trim, cap.
    const seen = new Set<string>();
    const standards = raw
      .map((s) => ({
        code: (s.code ?? "").toString().trim(),
        description: (s.description ?? "").toString().trim().slice(0, 1000),
      }))
      .filter((s) => s.code && s.description && !seen.has(s.code) && (seen.add(s.code), true))
      .slice(0, 500);

    return new Response(JSON.stringify({ success: true, standards, source: sourceLabel }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-standards error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
