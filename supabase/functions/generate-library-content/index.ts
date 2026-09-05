// Generates a reading, activity, or lesson plan draft aligned to selected standards.
// Input: { kind, standard_ids: uuid[], grade?, subject?, options?: { length?, reading_level?, format?, topic? } }
// Output: { title, body (markdown), suggested_standard_ids }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import {
  aiProviderErrorMessage,
  fetchChatCompletion,
  getAiProviderConfig,
  isAiProviderHardError,
} from "../_shared/openrouter.ts";
import { aiJson, HttpError } from "../_shared/curriculum-ai.ts";
import { CHAPTER_RULES, CHAPTER_SCHEMA, CHAPTER_SYSTEM, chapterToMarkdown, normalizeChapterOut } from "../_shared/textbook-chapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  kind: z.enum(["reading", "activity", "lesson_plan"]),
  standard_ids: z.array(z.string().uuid()).min(1).max(8),
  grade: z.string().max(10).optional().nullable(),
  subject: z.string().max(60).optional().nullable(),
  options: z.object({
    length: z.enum(["short", "medium", "long"]).optional(),
    format: z.string().max(60).optional(),
    topic: z.string().max(300).optional(),
    /** Target Depth of Knowledge: a single level, or "mix" for a spread across levels. */
    dok: z.enum(["1", "2", "3", "4", "mix"]).optional(),
  }).optional(),
});

const KIND_GUIDE: Record<string, string> = {
  reading: "an informational reading passage for students with a short title, 3-6 paragraphs that teach the concept with bolded key vocabulary, then a section headed \"## In the Real World\" (a case study or an actual documented event — real place, date, and people/organizations — that illustrates the concept, ending with 1-2 sentences tying it back to the main idea; never invent an event: if you cannot name a real one, label it clearly as a realistic case study), then 3-5 comprehension questions at the end",
  activity: "a hands-on classroom activity with sections: Overview, Materials, Time, Steps (numbered), Differentiation, and a short Exit Ticket",
  lesson_plan: "a complete lesson plan designed around Kolb's experiential learning cycle with sections in this order: Objective(s), Standards, Materials, Concrete Experience (students do or observe something first-hand), Reflective Observation (students discuss/journal what they noticed), Abstract Conceptualization (the concept, vocabulary and models are named and explained), Active Experimentation (students apply the idea to a new problem or design), Assessment / Check for Understanding, Differentiation, and Extension. Give each of the four Kolb sections a time allotment. End EVERY section with an italic line starting \"*Why this works:*\" giving a 1-2 sentence instructional rationale for that choice",
};

const READING_LEVEL_GUIDE = "Write at a 7th-grade reading level (Flesch-Kincaid grade ~7): mostly short sentences, familiar words, and any technical term defined in plain language when it first appears.";

const LENGTH_GUIDE: Record<string, string> = {
  short: "Keep it concise (roughly 300-450 words).",
  medium: "Aim for roughly 600-900 words.",
  long: "Be thorough (roughly 1000-1500 words).",
};

const DOK_DESC: Record<string, string> = {
  "1": "DOK 1 — Recall & reproduction: define, identify, list, recall facts, follow a simple procedure.",
  "2": "DOK 2 — Skills & concepts: classify, compare, summarize, interpret data, apply a concept.",
  "3": "DOK 3 — Strategic thinking: justify with evidence, analyze, draw conclusions, explain phenomena.",
  "4": "DOK 4 — Extended thinking: design investigations, synthesize across sources, sustained projects.",
};

function dokGuide(dok: string | undefined, kind: string): { text: string; levels: number[] } {
  if (!dok) return { text: "", levels: [] };
  if (dok === "mix") {
    const levels = kind === "reading" ? [1, 2, 3] : [1, 2, 3];
    return {
      levels,
      text: `Depth of Knowledge: deliberately span DOK ${levels.join(", ")} so the standards are covered at multiple cognitive levels. Build up from recall (DOK 1) through concept application (DOK 2) to evidence-based reasoning (DOK 3). Label each question/task with its DOK level in brackets, e.g. "[DOK 2]".\n${levels.map((l) => DOK_DESC[String(l)]).join("\n")}`,
    };
  }
  const lvl = Number(dok);
  return {
    levels: [lvl],
    text: `Depth of Knowledge: target ${DOK_DESC[dok]} Every task and question should sit at DOK ${lvl}; label them "[DOK ${lvl}]".`,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { kind, standard_ids, grade, subject, options } = parsed.data;

    // Standards are readable by the user (RLS), so use the user client.
    const { data: stds, error: sErr } = await userClient
      .from("standards").select("id, code, description, subject, grade, framework").in("id", standard_ids);
    if (sErr) throw sErr;
    if (!stds?.length) return json({ error: "No matching standards found." }, 400);

    const stdLines = stds.map((s) => `- ${s.code} (${s.framework ?? "STATE"}, ${s.subject}, grade ${s.grade}): ${s.description}`).join("\n");
    const effGrade = grade ?? stds[0].grade;
    const effSubject = subject ?? stds[0].subject;
    const length = options?.length ?? "medium";
    const dok = dokGuide(options?.dok, kind);

    // Readings are generated as structured textbook chapters; the markdown body
    // is derived from the chapter so search/export keep working.
    if (kind === "reading") {
      try {
        const out = await aiJson<Record<string, unknown>>({
          system: CHAPTER_SYSTEM,
          user: [
            `Write a student-facing textbook chapter. Grade: ${effGrade}. Subject: ${effSubject}.`,
            options?.format ? `Format preference: ${options.format}.` : "",
            options?.topic ? `Topic focus: ${options.topic}.` : "",
            dok.text ? dok.text.replace("Label each question/task", "Label each review question") : "",
            LENGTH_GUIDE[length].replace("Aim for", "Total length: aim for").replace("Keep it concise", "Total length: keep it concise").replace("Be thorough", "Total length: be thorough"),
            `Align tightly to these standards and reference their codes where relevant:\n${stdLines}`,
            CHAPTER_RULES,
            `Return JSON exactly in this shape:\n${CHAPTER_SCHEMA}`,
          ].filter(Boolean).join("\n\n"),
          maxTokens: length === "long" ? 9000 : 7000,
          tier: "heavy",
        });
        const chapter = normalizeChapterOut(out, options?.topic ?? `${effSubject} chapter`);
        if (!chapter.sections.length) return json({ error: "The AI returned an empty chapter. Try again." }, 500);
        const levels = Array.from(new Set(chapter.review_questions.map((q) => q.dok))).sort();
        return json({
          title: chapter.title.slice(0, 200), body: chapterToMarkdown(chapter), chapter,
          suggested_standard_ids: stds.map((s) => s.id), grade: effGrade, subject: effSubject,
          dok_levels: levels.length ? levels : dok.levels,
        });
      } catch (e) {
        if (e instanceof HttpError) return json({ error: e.message }, e.status);
        throw e;
      }
    }

    const system = `You are an expert ${effSubject} teacher and curriculum designer. Write classroom-ready materials in clean Markdown. Never include preamble or commentary — output only the material itself.`;
    const user = [
      `Create ${KIND_GUIDE[kind]}.`,
      `Grade: ${effGrade}. Subject: ${effSubject}.`,
      kind === "reading" ? READING_LEVEL_GUIDE : "",
      options?.format ? `Format preference: ${options.format}.` : "",
      options?.topic ? `Topic focus: ${options.topic}.` : "",
      dok.text,
      LENGTH_GUIDE[length],
      `Align tightly to these standards and reference their codes where relevant:\n${stdLines}`,
      `Start the response with a single H1 title line ("# Title"), then the content.`,
    ].filter(Boolean).join("\n\n");

    const res = await fetchChatCompletion({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.7,
      max_tokens: length === "long" ? 4000 : 2500,
    });
    if (!res.ok) {
      const provider = (await getAiProviderConfig()).provider;
      const text = await res.text().catch(() => "");
      console.error("AI error", res.status, text.slice(0, 300));
      return json({ error: aiProviderErrorMessage(res.status, provider) }, isAiProviderHardError(res.status) ? res.status : 500);
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) return json({ error: "The AI returned an empty response. Try again." }, 500);

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = (titleMatch?.[1] ?? `${effSubject} ${kind.replace("_", " ")}`).trim().slice(0, 200);
    const body = titleMatch ? content.replace(titleMatch[0], "").trim() : content.trim();

    return json({ title, body, suggested_standard_ids: stds.map((s) => s.id), grade: effGrade, subject: effSubject, dok_levels: dok.levels });
  } catch (e) {
    console.error("generate-library-content error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
