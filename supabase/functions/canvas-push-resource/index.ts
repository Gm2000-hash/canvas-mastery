// Pushes a library resource to Canvas as a Page, Assignment, or classic Quiz.
// Uses the teacher's stored Canvas credentials; the token never leaves the server.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { canvasFetch } from "../_shared/canvasFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Answer = z.object({ text: z.string().max(4000), correct: z.boolean() });
const Question = z.object({
  text: z.string().min(1).max(20000),
  points: z.number().min(0).max(1000).default(1),
  itemType: z.string().nullable().optional(),
  answers: z.array(Answer).max(20).default([]),
});
const Body = z.object({
  canvas_course_id: z.number().int().positive(),
  target: z.enum(["page", "assignment", "quiz"]),
  title: z.string().min(1).max(255),
  html: z.string().max(500_000).default(""),
  published: z.boolean().default(false),
  points: z.number().min(0).max(1000).optional(),
  questions: z.array(Question).max(200).default([]),
  library_item_id: z.string().uuid().nullable().optional(),
  question_set_key: z.string().max(200).nullable().optional(),
});

function canvasQuestionType(q: z.infer<typeof Question>): string {
  const n = q.answers.length;
  const correct = q.answers.filter((a) => a.correct).length;
  if (n === 0) return q.itemType?.toLowerCase().includes("short") ? "short_answer_question" : "essay_question";
  const tf = n === 2 && q.answers.every((a) => /^(true|false)$/i.test(a.text.trim()));
  if (tf) return "true_false_question";
  if (correct > 1) return "multiple_answers_question";
  return "multiple_choice_question";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const teacherId = userData.user.id;

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: creds, error: cErr } = await admin
      .from("canvas_credentials").select("base_url, api_token").eq("teacher_id", teacherId).maybeSingle();
    if (cErr) throw cErr;
    if (!creds) return json({ error: "No Canvas credentials. Connect Canvas in Settings first." }, 400);

    const api = async (path: string, payload: unknown) => {
      const res = await canvasFetch(`${creds.base_url}/api/v1${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.api_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Canvas ${res.status}: ${text.slice(0, 300)}`);
      return text ? JSON.parse(text) : {};
    };
    const base = `/courses/${b.canvas_course_id}`;
    const link = async (external_type: string, external_item_id: unknown, url: string | null) => {
      const { error } = await admin.from("resource_links").upsert({
        teacher_id: teacherId, library_item_id: b.library_item_id ?? null, question_set_key: b.question_set_key ?? null,
        platform: "canvas", external_course_id: String(b.canvas_course_id), external_item_id: String(external_item_id), external_type,
        url, direction: "exported", synced_at: new Date().toISOString(),
      }, { onConflict: "teacher_id,platform,external_type,external_item_id" });
      if (error) console.warn("resource_links", error.message);
    };

    if (b.target === "page") {
      const page = await api(`${base}/pages`, { wiki_page: { title: b.title, body: b.html, published: b.published } });
      await link("page", page.page_id ?? page.url, page.html_url ?? null);
      return json({ success: true, target: "page", id: page.page_id ?? page.url, html_url: page.html_url });
    }

    if (b.target === "assignment") {
      const a = await api(`${base}/assignments`, {
        assignment: {
          name: b.title,
          description: b.html,
          published: b.published,
          points_possible: b.points ?? (b.questions.length ? b.questions.reduce((s, q) => s + q.points, 0) : 10),
          submission_types: ["online_text_entry", "online_upload"],
        },
      });
      await link("assignment", a.id, a.html_url ?? null);
      return json({ success: true, target: "assignment", id: a.id, html_url: a.html_url });
    }

    // Classic quiz + questions
    const quiz = await api(`${base}/quizzes`, {
      quiz: { title: b.title, description: b.html, quiz_type: "assignment", published: false },
    });
    let added = 0;
    for (const q of b.questions) {
      const type = canvasQuestionType(q);
      const answers = q.answers.map((a) => ({ answer_text: a.text, answer_weight: a.correct ? 100 : 0 }));
      await api(`${base}/quizzes/${quiz.id}/questions`, {
        question: {
          question_name: `Question ${added + 1}`,
          question_text: q.text,
          question_type: type,
          points_possible: q.points,
          answers: type === "essay_question" ? undefined : answers,
        },
      });
      added++;
    }
    if (b.published) {
      // Publish only after all questions exist so students never see a half-built quiz.
      const res = await canvasFetch(`${creds.base_url}/api/v1${base}/quizzes/${quiz.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${creds.api_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ quiz: { published: true } }),
      });
      if (!res.ok) console.warn("quiz publish failed", res.status);
    }
    await link("quiz", quiz.id, quiz.html_url ?? null);
    return json({ success: true, target: "quiz", id: quiz.id, html_url: quiz.html_url, questions: added });
  } catch (e) {
    console.error("canvas-push-resource error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
