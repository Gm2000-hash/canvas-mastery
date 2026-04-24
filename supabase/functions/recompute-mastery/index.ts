// Recomputes mastery_snapshots for the teacher based on confirmed assignment_standards
// and current submissions. Per student per standard:
//   mastery = average of (last N submissions on assignments tagged with that standard)
//   mastered = mastery >= threshold && attempts >= 1
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

    // Pull confirmed standard tags for this teacher's assignments
    const { data: tagged, error: tErr } = await admin
      .from("assignment_standards")
      .select("assignment_id, standard_id, confirmed")
      .eq("teacher_id", teacherId)
      .eq("confirmed", true);
    if (tErr) throw tErr;
    if (!tagged || !tagged.length) {
      return new Response(JSON.stringify({ success: true, snapshots: 0, note: "No confirmed standard tags yet." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map assignment -> standards
    const assignmentToStandards = new Map<string, string[]>();
    for (const t of tagged) {
      const arr = assignmentToStandards.get(t.assignment_id) ?? [];
      arr.push(t.standard_id);
      assignmentToStandards.set(t.assignment_id, arr);
    }
    const assignmentIds = Array.from(assignmentToStandards.keys());

    // Pull submissions for those assignments
    const { data: subs, error: sErr } = await admin
      .from("submissions")
      .select("student_id, assignment_id, percentage, submitted_at, graded_at")
      .eq("teacher_id", teacherId)
      .in("assignment_id", assignmentIds)
      .not("percentage", "is", null);
    if (sErr) throw sErr;

    // Group: student + standard -> list of {pct, ts}
    type Row = { pct: number; ts: number };
    const grouped = new Map<string, Row[]>();
    for (const s of subs ?? []) {
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

    // Replace previous snapshots with the latest run for this teacher
    // (Keeping history would explode storage; instead keep the latest plus a periodic snapshot.)
    // For Phase 1 simplicity: always insert new rows so growth-over-time works in Phase 2.
    if (snapshots.length) {
      for (let i = 0; i < snapshots.length; i += 500) {
        const chunk = snapshots.slice(i, i + 500);
        const { error: insErr } = await admin.from("mastery_snapshots").insert(chunk);
        if (insErr) throw insErr;
      }
    }

    return new Response(JSON.stringify({ success: true, snapshots: snapshots.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recompute-mastery error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
