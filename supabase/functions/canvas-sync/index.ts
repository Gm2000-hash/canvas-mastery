// Pulls courses, students, assignments, and submissions from Canvas
// and upserts them into the teacher's tables.
//
// Optional body:
//   {
//     course_ids?: number[];                                    // limit sync to these Canvas course IDs
//     discipline_assignments?: { canvas_course_id: number; discipline_id: string | null }[];
//   }
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

    let body: any = {};
    try { body = req.method === "POST" ? await req.json() : {}; } catch { /* empty body ok */ }
    const courseIdFilter: Set<number> | null = Array.isArray(body?.course_ids) && body.course_ids.length
      ? new Set(body.course_ids.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n)))
      : null;
    const disciplineMap = new Map<number, string | null>();
    if (Array.isArray(body?.discipline_assignments)) {
      for (const a of body.discipline_assignments) {
        if (a && Number.isFinite(Number(a.canvas_course_id))) {
          disciplineMap.set(Number(a.canvas_course_id), a.discipline_id ?? null);
        }
      }
    }

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
    const syncedCourseIds: string[] = [];

    // 1) Courses (active teacher enrollment by default; if course_ids provided we widen state filter)
    const allCourses = courseIdFilter
      ? await canvasFetchAll<any>(creds, "/api/v1/courses?enrollment_type=teacher&include[]=term&state[]=available&state[]=completed&state[]=unpublished")
      : await canvasFetchAll<any>(creds, "/api/v1/courses?enrollment_type=teacher&enrollment_state=active&state[]=available&include[]=term");

    const courses = courseIdFilter ? allCourses.filter((c) => courseIdFilter.has(Number(c.id))) : allCourses;

    for (const c of courses) {
      const overrideDiscipline = disciplineMap.has(Number(c.id)) ? disciplineMap.get(Number(c.id)) : undefined;

      const upsertRow: Record<string, unknown> = {
        teacher_id: teacherId,
        canvas_course_id: c.id,
        name: c.name ?? `Course ${c.id}`,
        course_code: c.course_code ?? null,
        term: c.term?.name ?? null,
        last_synced_at: new Date().toISOString(),
      };
      // Only set discipline_id when caller explicitly provided one (allows null to clear)
      if (overrideDiscipline !== undefined) upsertRow.discipline_id = overrideDiscipline;

      const { data: courseRow, error: insErr } = await admin
        .from("courses").upsert(upsertRow, { onConflict: "teacher_id,canvas_course_id" })
        .select("id").single();
      if (insErr) { console.error("course upsert", insErr); continue; }
      stats.courses++;
      const courseId = courseRow!.id as string;
      syncedCourseIds.push(courseId);

      // 2) Students — pseudonymize: real names go ONLY to student_identities;
      // the public students table stores a per-teacher "Student NNN" pseudonym.
      const students = await canvasFetchAll<any>(creds, `/api/v1/courses/${c.id}/students`).catch(() => []);

      if (students.length) {
        // Find current max pseudonym_seq for this teacher to assign new ones
        const { data: maxRow } = await admin
          .from("students").select("pseudonym_seq")
          .eq("teacher_id", teacherId)
          .order("pseudonym_seq", { ascending: false, nullsFirst: false })
          .limit(1).maybeSingle();
        let nextSeq = (maxRow?.pseudonym_seq ?? 0) + 1;

        // Existing students for this course/teacher (by canvas_user_id) so we
        // preserve their existing pseudonym instead of regenerating it.
        const canvasIds = students.map((s) => Number(s.id));
        const { data: existingRows } = await admin
          .from("students")
          .select("id, canvas_user_id, pseudonym, pseudonym_seq")
          .eq("teacher_id", teacherId)
          .eq("course_id", courseId)
          .in("canvas_user_id", canvasIds);
        const existingByCanvas = new Map(
          (existingRows ?? []).map((r) => [Number(r.canvas_user_id), r])
        );

        const studentRows: any[] = [];
        const identityRows: any[] = [];

        for (const s of students) {
          const existing = existingByCanvas.get(Number(s.id));
          let seq = existing?.pseudonym_seq ?? null;
          let pseudo = existing?.pseudonym ?? null;
          if (!pseudo) {
            seq = nextSeq++;
            pseudo = `Student ${String(seq).padStart(3, "0")}`;
          }
          studentRows.push({
            teacher_id: teacherId,
            course_id: courseId,
            canvas_user_id: s.id,
            name: pseudo,
            sortable_name: pseudo,
            pseudonym: pseudo,
            pseudonym_seq: seq,
            email: null,
          });
        }

        const { data: upserted, error: sErr } = await admin
          .from("students")
          .upsert(studentRows, { onConflict: "course_id,canvas_user_id" })
          .select("id, canvas_user_id");
        if (sErr) {
          console.error("students upsert", sErr);
        } else {
          stats.students += studentRows.length;
          const idByCanvas = new Map((upserted ?? []).map((r) => [Number(r.canvas_user_id), r.id as string]));
          for (const s of students) {
            const studentId = idByCanvas.get(Number(s.id));
            if (!studentId) continue;
            identityRows.push({
              student_id: studentId,
              teacher_id: teacherId,
              real_name: s.name ?? `Student ${s.id}`,
              real_sortable_name: s.sortable_name ?? null,
              email: s.email ?? s.login_id ?? null,
              canvas_user_id: s.id,
            });
          }
          if (identityRows.length) {
            const { error: idErr } = await admin
              .from("student_identities")
              .upsert(identityRows, { onConflict: "student_id" });
            if (idErr) console.error("student_identities upsert", idErr);
          }
        }
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

      // 3b) Quiz questions for any quiz assignments
      // (Classic Quizzes API; New Quizzes are not exposed here. Failures are non-fatal.)
      const quizAssignments = assignments.filter((a) => a.quiz_id);
      if (quizAssignments.length) {
        // Build canvas_assignment_id -> internal assignment.id map (re-read after upsert)
        const { data: assignMapForQ } = await admin
          .from("assignments").select("id, canvas_assignment_id").eq("course_id", courseId);
        const aIdByCanvas = new Map((assignMapForQ ?? []).map((r) => [Number(r.canvas_assignment_id), r.id as string]));
        for (const qa of quizAssignments) {
          const internalAid = aIdByCanvas.get(Number(qa.id));
          if (!internalAid) continue;
          let questions: any[] = [];
          try {
            questions = await canvasFetchAll<any>(creds, `/api/v1/courses/${c.id}/quizzes/${qa.quiz_id}/questions`);
          } catch (e) {
            console.warn(`quiz ${qa.quiz_id} questions fetch failed`, (e as Error).message);
            continue;
          }
          const qRows = questions.map((q, i) => ({
            teacher_id: teacherId,
            assignment_id: internalAid,
            canvas_question_id: q.id,
            position: q.position ?? i + 1,
            question_text: q.question_text
              ? String(q.question_text).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000)
              : null,
            points_possible: q.points_possible ?? null,
            // Persist answer choices so the AI tagger can read CHOICES (vocabulary often anchors the standard)
            answers: Array.isArray(q.answers)
              ? q.answers.slice(0, 12).map((a: any) => ({
                  text: typeof a?.text === "string" ? a.text.slice(0, 600) : null,
                  html: typeof a?.html === "string" ? a.html.slice(0, 800) : null,
                  weight: a?.weight ?? null,
                }))
              : null,
          }));
          if (qRows.length) {
            const { error: qErr } = await admin.from("quiz_questions")
              .upsert(qRows, { onConflict: "assignment_id,canvas_question_id" });
            if (qErr) console.error("quiz_questions upsert", qErr);
          }
        }
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
        for (let i = 0; i < subRows.length; i += 500) {
          const chunk = subRows.slice(i, i + 500);
          const { error: subErr } = await admin.from("submissions").upsert(chunk, { onConflict: "assignment_id,student_id" });
          if (subErr) console.error("submissions upsert", subErr); else stats.submissions += chunk.length;
        }
      }
    }

    await admin.from("canvas_credentials").update({ last_sync_at: new Date().toISOString() }).eq("teacher_id", teacherId);

    // 5) Per-question scores (best-effort; never fails the sync)
    const questionScores = { quizzes: 0, responses: 0 };
    try {
      const { syncQuestionScoresForTeacher } = await import("../canvas-sync-question-scores/index.ts");
      for (const cid of syncedCourseIds) {
        try {
          const out = await syncQuestionScoresForTeacher({ teacherId, courseId: cid, assignmentIds: null });
          questionScores.quizzes += out.stats.quizzes;
          questionScores.responses += out.stats.responses;
        } catch (e) {
          console.warn(`question-score sync failed for course ${cid}:`, (e as Error).message);
        }
      }
    } catch (e) {
      console.warn("question-score helper unavailable:", (e as Error).message);
    }

    return new Response(JSON.stringify({ success: true, stats, question_scores: questionScores }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("canvas-sync error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
