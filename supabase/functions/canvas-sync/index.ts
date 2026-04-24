// Pulls courses, students, assignments, and submissions from Canvas
// and upserts them into the teacher's tables.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CanvasCreds = { base_url: string; api_token: string };

function parseLinkHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(",")) {
    const m = part.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/);
    if (m) out[m[2]] = m[1];
  }
  return out;
}

async function canvasFetchAll<T>(creds: CanvasCreds, path: string, init: RequestInit = {}): Promise<T[]> {
  const items: T[] = [];
  let url = `${creds.base_url}${path}${path.includes("?") ? "&" : "?"}per_page=100`;
  let safety = 0;
  while (url && safety < 30) {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${creds.api_token}` },
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Canvas ${res.status} on ${url}: ${t.slice(0, 200)}`);
    }
    const page = (await res.json()) as T[];
    items.push(...(Array.isArray(page) ? page : []));
    const links = parseLinkHeader(res.headers.get("Link"));
    url = links.next ?? "";
    safety++;
  }
  return items;
}

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
    const { data: creds, error: cErr } = await admin
      .from("canvas_credentials").select("base_url, api_token").eq("teacher_id", teacherId).maybeSingle();
    if (cErr) throw cErr;
    if (!creds) {
      return new Response(JSON.stringify({ error: "No Canvas credentials. Connect Canvas first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stats = { courses: 0, students: 0, assignments: 0, submissions: 0 };

    // 1) Courses (active teacher enrollment)
    const courses = await canvasFetchAll<any>(creds, "/api/v1/courses?enrollment_type=teacher&enrollment_state=active&state[]=available");
    for (const c of courses) {
      const { data: courseRow, error: insErr } = await admin.from("courses").upsert({
        teacher_id: teacherId,
        canvas_course_id: c.id,
        name: c.name ?? `Course ${c.id}`,
        course_code: c.course_code ?? null,
        term: c.term?.name ?? null,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "teacher_id,canvas_course_id" }).select("id").single();
      if (insErr) { console.error("course upsert", insErr); continue; }
      stats.courses++;
      const courseId = courseRow!.id as string;

      // 2) Students
      const students = await canvasFetchAll<any>(creds, `/api/v1/courses/${c.id}/students`).catch(() => []);
      const studentRows = students.map((s) => ({
        teacher_id: teacherId,
        course_id: courseId,
        canvas_user_id: s.id,
        name: s.name ?? `Student ${s.id}`,
        sortable_name: s.sortable_name ?? null,
      }));
      if (studentRows.length) {
        const { error: sErr } = await admin.from("students").upsert(studentRows, { onConflict: "course_id,canvas_user_id" });
        if (sErr) console.error("students upsert", sErr); else stats.students += studentRows.length;
      }

      // 3) Assignments
      const assignments = await canvasFetchAll<any>(creds, `/api/v1/courses/${c.id}/assignments`).catch(() => []);
      const aRows = assignments.map((a) => ({
        teacher_id: teacherId,
        course_id: courseId,
        canvas_assignment_id: a.id,
        canvas_quiz_id: a.quiz_id ?? null,
        kind: (a.is_quiz_assignment || a.quiz_id) ? "quiz" : "assignment",
        name: a.name ?? `Assignment ${a.id}`,
        description: a.description ? String(a.description).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000) : null,
        points_possible: a.points_possible ?? null,
        due_at: a.due_at ?? null,
      }));
      if (aRows.length) {
        const { error: aErr } = await admin.from("assignments").upsert(aRows, { onConflict: "course_id,canvas_assignment_id" });
        if (aErr) console.error("assignments upsert", aErr); else stats.assignments += aRows.length;
      }

      // Build student/assignment ID maps for submissions
      const { data: studentMap } = await admin.from("students").select("id, canvas_user_id").eq("course_id", courseId);
      const { data: assignMap } = await admin.from("assignments").select("id, canvas_assignment_id").eq("course_id", courseId);
      const sById = new Map((studentMap ?? []).map((r) => [Number(r.canvas_user_id), r.id as string]));
      const aById = new Map((assignMap ?? []).map((r) => [Number(r.canvas_assignment_id), r.id as string]));

      // 4) Submissions (per assignment, all students)
      const subs = await canvasFetchAll<any>(creds, `/api/v1/courses/${c.id}/students/submissions?student_ids[]=all&per_page=100`).catch(() => []);
      const subRows = subs
        .map((s) => {
          const studentId = sById.get(Number(s.user_id));
          const assignmentId = aById.get(Number(s.assignment_id));
          if (!studentId || !assignmentId) return null;
          const score = s.score == null ? null : Number(s.score);
          const a = assignments.find((x) => x.id === s.assignment_id);
          const pts = a?.points_possible ?? null;
          const pct = score != null && pts ? Math.max(0, Math.min(1, score / pts)) : null;
          return {
            teacher_id: teacherId,
            assignment_id: assignmentId,
            student_id: studentId,
            score,
            points_possible: pts,
            percentage: pct,
            submitted_at: s.submitted_at ?? null,
            graded_at: s.graded_at ?? null,
            workflow_state: s.workflow_state ?? null,
          };
        })
        .filter(Boolean) as any[];

      if (subRows.length) {
        // Chunk to avoid huge payloads
        for (let i = 0; i < subRows.length; i += 500) {
          const chunk = subRows.slice(i, i + 500);
          const { error: subErr } = await admin.from("submissions").upsert(chunk, { onConflict: "assignment_id,student_id" });
          if (subErr) console.error("submissions upsert", subErr); else stats.submissions += chunk.length;
        }
      }
    }

    await admin.from("canvas_credentials").update({ last_sync_at: new Date().toISOString() }).eq("teacher_id", teacherId);

    return new Response(JSON.stringify({ success: true, stats }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("canvas-sync error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
