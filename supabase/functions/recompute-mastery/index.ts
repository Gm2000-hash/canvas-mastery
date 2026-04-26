// Recomputes mastery_snapshots for the teacher.
//
// Per (student, standard):
//   - If there are question_responses on questions CONFIRMED-tagged to that standard,
//     mastery = average (points/points_possible) over the most recent N responses.
//   - Otherwise (assignment-grain fallback): mastery = average percentage over the
//     most recent N submissions on assignments CONFIRMED-tagged to that standard.
//   - mastered = mastery >= threshold && attempts >= 1
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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: settings } = await admin.from("teacher_settings")
      .select("mastery_threshold, attempt_window").eq("teacher_id", teacherId).maybeSingle();
    const threshold = Number(settings?.mastery_threshold ?? 0.8);
    const window = Number(settings?.attempt_window ?? 3);

    type Row = { pct: number; ts: number };
    const grouped = new Map<string, Row[]>();
    const standardHasQuestionSignal = new Set<string>(); // standard_ids with any question-grain data

    // ---- 1) Question-grain signal (preferred) ----
    // Pull confirmed question-level tags + responses
    const { data: qTags, error: qtErr } = await admin
      .from("question_standards")
      .select("question_id, standard_id, quiz_questions!inner(id, assignment_id)")
      .eq("teacher_id", teacherId)
      .eq("confirmed", true);
    if (qtErr) throw qtErr;

    const questionToStandards = new Map<string, string[]>();
    for (const t of qTags ?? []) {
      const arr = questionToStandards.get(t.question_id as string) ?? [];
      arr.push(t.standard_id as string);
      questionToStandards.set(t.question_id as string, arr);
    }
    const questionIds = Array.from(questionToStandards.keys());

    if (questionIds.length) {
      // Pull responses for those questions (chunk if large)
      const responses: any[] = [];
      for (let i = 0; i < questionIds.length; i += 200) {
        const chunk = questionIds.slice(i, i + 200);
        const { data: rs, error: rErr } = await admin
          .from("question_responses")
          .select("student_id, question_id, points, points_possible, created_at")
          .eq("teacher_id", teacherId)
          .in("question_id", chunk)
          .not("points", "is", null)
          .not("points_possible", "is", null);
        if (rErr) throw rErr;
        responses.push(...(rs ?? []));
      }
      for (const r of responses) {
        const pp = Number(r.points_possible);
        if (!pp || pp <= 0) continue;
        const pct = Math.max(0, Math.min(1, Number(r.points) / pp));
        const ts = new Date((r.created_at ?? 0) as string).getTime() || 0;
        const stds = questionToStandards.get(r.question_id as string) ?? [];
        for (const stdId of stds) {
          const key = `${r.student_id}::${stdId}`;
          const arr = grouped.get(key) ?? [];
          arr.push({ pct, ts });
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
      // Skip standards that already have question-grain data — we don't want to mix grains.
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
          arr.push({ pct, ts });
          grouped.set(key, arr);
        }
      }
    }

    if (grouped.size === 0) {
      return new Response(JSON.stringify({ success: true, snapshots: 0, note: "No confirmed standard tags or responses yet." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const snapshots: any[] = [];
    for (const [key, arr] of grouped) {
      const [student_id, standard_id] = key.split("::");
      arr.sort((a, b) => b.ts - a.ts); // newest first
      const recent = arr.slice(0, window);
      if (!recent.length) continue;
      const avg = recent.reduce((s, r) => s + r.pct, 0) / recent.length;
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

    return new Response(JSON.stringify({
      success: true,
      snapshots: snapshots.length,
      question_grain_standards: standardHasQuestionSignal.size,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recompute-mastery error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
