// Recomputes mastery_snapshots for the teacher.
//
// Per (student, standard):
//   - If there are question_responses on questions tagged to that standard
//     (confirmed OR ai_suggested), mastery = confidence-weighted average
//     (points/points_possible) over the most recent N responses. Confirmed tags
//     are weighted 1.0; ai-suggested tags use their stored confidence (default 0.5).
//   - Otherwise (assignment-grain fallback): mastery = average percentage over
//     the most recent N submissions on assignments CONFIRMED-tagged to that standard.
//   - mastered = mastery >= threshold && attempts >= 1
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeQuestionText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function recomputeMasteryForTeacher(teacherId: string) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: settings } = await admin.from("teacher_settings")
    .select("mastery_threshold, attempt_window").eq("teacher_id", teacherId).maybeSingle();
  const threshold = Number(settings?.mastery_threshold ?? 0.8);
  const window = Number(settings?.attempt_window ?? 3);

  type Row = { pct: number; ts: number; weight: number };
  const grouped = new Map<string, Row[]>();
  const standardHasQuestionSignal = new Set<string>();

  // ---- 1) Question-grain signal (preferred) ----
  // Include both confirmed and ai_suggested tags so freshly-imported scores
  // surface immediately. Confirmed tags carry weight 1.0; suggested tags use
  // their confidence (default 0.5). Canvas often stores copied quizzes as
  // separate question IDs, so we also match tagged questions to scored copied
  // questions by exact normalized text.
  const { data: qTags, error: qtErr } = await admin
    .from("question_standards")
    .select("question_id, standard_id, confirmed, ai_suggested, confidence")
    .eq("teacher_id", teacherId)
    .or("confirmed.eq.true,ai_suggested.eq.true");
  if (qtErr) throw qtErr;

  // question_id/text -> Map<standard_id, weight> (best weight wins if duplicates)
  const questionToStandards = new Map<string, Map<string, number>>();
  const textToStandards = new Map<string, Map<string, number>>();
  for (const t of qTags ?? []) {
    const w = t.confirmed
      ? 1.0
      : Math.max(0.1, Math.min(1.0, Number(t.confidence ?? 0.5)));
    const m = questionToStandards.get(t.question_id as string) ?? new Map<string, number>();
    const prev = m.get(t.standard_id as string) ?? 0;
    if (w > prev) m.set(t.standard_id as string, w);
    questionToStandards.set(t.question_id as string, m);
  }

  const taggedQuestionIds = Array.from(questionToStandards.keys());
  const questionTextById = new Map<string, string>();
  for (let i = 0; i < taggedQuestionIds.length; i += 200) {
    const chunk = taggedQuestionIds.slice(i, i + 200);
    const { data: qs, error: qErr } = await admin
      .from("quiz_questions")
      .select("id, question_text")
      .eq("teacher_id", teacherId)
      .in("id", chunk);
    if (qErr) throw qErr;
    for (const q of qs ?? []) {
      const text = normalizeQuestionText(q.question_text);
      if (!text) continue;
      questionTextById.set(q.id as string, text);
      const standards = questionToStandards.get(q.id as string);
      if (!standards) continue;
      const textMap = textToStandards.get(text) ?? new Map<string, number>();
      for (const [standardId, weight] of standards) {
        const prev = textMap.get(standardId) ?? 0;
        if (weight > prev) textMap.set(standardId, weight);
      }
      textToStandards.set(text, textMap);
    }
  }

  if (taggedQuestionIds.length) {
    const responses: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: rs, error: rErr } = await admin
        .from("question_responses")
        .select("student_id, question_id, points, points_possible, created_at")
        .eq("teacher_id", teacherId)
        .not("points", "is", null)
        .not("points_possible", "is", null)
        .range(from, from + 999);
      if (rErr) throw rErr;
      responses.push(...(rs ?? []));
      if (!rs || rs.length < 1000) break;
    }

    const missingTextIds = Array.from(new Set(
      responses
        .map((r) => r.question_id as string)
        .filter((id) => !questionTextById.has(id)),
    ));
    for (let i = 0; i < missingTextIds.length; i += 200) {
      const chunk = missingTextIds.slice(i, i + 200);
      const { data: qs, error: qErr } = await admin
        .from("quiz_questions")
        .select("id, question_text")
        .eq("teacher_id", teacherId)
        .in("id", chunk);
      if (qErr) throw qErr;
      for (const q of qs ?? []) questionTextById.set(q.id as string, normalizeQuestionText(q.question_text));
    }

    for (const r of responses) {
      const pp = Number(r.points_possible);
      if (!pp || pp <= 0) continue;
      const pct = Math.max(0, Math.min(1, Number(r.points) / pp));
      const ts = new Date((r.created_at ?? 0) as string).getTime() || 0;
      const stds = questionToStandards.get(r.question_id as string)
        ?? textToStandards.get(questionTextById.get(r.question_id as string) ?? "");
      if (!stds) continue;
      for (const [stdId, weight] of stds) {
        const key = `${r.student_id}::${stdId}`;
        const arr = grouped.get(key) ?? [];
        arr.push({ pct, ts, weight });
        grouped.set(key, arr);
        standardHasQuestionSignal.add(stdId);
      }
    }
  }

  // ---- 2) Assignment-grain fallback (only for standards w/o any question signal) ----
  const { data: tagged, error: tErr } = await admin
    .from("assignment_standards")
    .select("assignment_id, standard_id")
    .eq("teacher_id", teacherId)
    .eq("confirmed", true);
  if (tErr) throw tErr;

  const assignmentToStandards = new Map<string, string[]>();
  for (const t of tagged ?? []) {
    if (standardHasQuestionSignal.has(t.standard_id as string)) continue;
    const arr = assignmentToStandards.get(t.assignment_id as string) ?? [];
    arr.push(t.standard_id as string);
    assignmentToStandards.set(t.assignment_id as string, arr);
  }
  const assignmentIds = Array.from(assignmentToStandards.keys());

  if (assignmentIds.length) {
    const subs: any[] = [];
    for (let i = 0; i < assignmentIds.length; i += 200) {
      const chunk = assignmentIds.slice(i, i + 200);
      const { data: ss, error: sErr } = await admin
        .from("submissions")
        .select("student_id, assignment_id, percentage, submitted_at, graded_at")
        .eq("teacher_id", teacherId)
        .in("assignment_id", chunk)
        .not("percentage", "is", null);
      if (sErr) throw sErr;
      subs.push(...(ss ?? []));
    }
    for (const s of subs) {
      const stds = assignmentToStandards.get(s.assignment_id as string) ?? [];
      const ts = new Date((s.graded_at ?? s.submitted_at ?? 0) as string).getTime() || 0;
      const pct = Number(s.percentage);
      for (const stdId of stds) {
        const key = `${s.student_id}::${stdId}`;
        const arr = grouped.get(key) ?? [];
        arr.push({ pct, ts, weight: 1.0 });
        grouped.set(key, arr);
      }
    }
  }

  if (grouped.size === 0) {
    return { snapshots: 0, question_grain_standards: 0, note: "No tags or responses yet." };
  }

  const now = new Date().toISOString();
  const snapshots: any[] = [];
  for (const [key, arr] of grouped) {
    const [student_id, standard_id] = key.split("::");
    arr.sort((a, b) => b.ts - a.ts); // newest first
    const recent = arr.slice(0, window);
    if (!recent.length) continue;
    const totalW = recent.reduce((s, r) => s + r.weight, 0);
    const avg = totalW > 0
      ? recent.reduce((s, r) => s + r.pct * r.weight, 0) / totalW
      : recent.reduce((s, r) => s + r.pct, 0) / recent.length;
    snapshots.push({
      teacher_id: teacherId,
      student_id, standard_id,
      mastery_score: Number(avg.toFixed(4)),
      attempts: arr.length,
      mastered: avg >= threshold,
      computed_at: now,
    });
  }

  if (snapshots.length) {
    for (let i = 0; i < snapshots.length; i += 500) {
      const chunk = snapshots.slice(i, i + 500);
      const { error: insErr } = await admin.from("mastery_snapshots").insert(chunk);
      if (insErr) throw insErr;
    }
  }

  return {
    snapshots: snapshots.length,
    question_grain_standards: standardHasQuestionSignal.size,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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
    const out = await recomputeMasteryForTeacher(userData.user.id);
    return new Response(JSON.stringify({ success: true, ...out }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recompute-mastery error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
