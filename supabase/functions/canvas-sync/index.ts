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

class CanvasApiError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`Canvas request failed (${status})`);
  }
}

function optionalCanvasRequest<T>(request: Promise<T[]>): Promise<T[]> {
  return request.catch((error) => {
    if (error instanceof CanvasApiError && (error.status === 401 || error.status === 403)) throw error;
    return [];
  });
}

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
      throw new CanvasApiError(res.status, t.slice(0, 500));
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
        // NEW: capture Canvas archive signals (used by run_auto_archive)
        canvas_workflow_state: c.workflow_state ?? null,
        end_at: c.end_at ?? null,
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
      const students = await optionalCanvasRequest(canvasFetchAll<any>(creds, `/api/v1/courses/${c.id}/students`));
      // Also pull enrollments so we can capture each student's enrollment_state for auto-archive.
      const enrollments = await optionalCanvasRequest(canvasFetchAll<any>(creds, `/api/v1/courses/${c.id}/enrollments?type[]=StudentEnrollment&state[]=active&state[]=completed&state[]=inactive`));
      const enrollmentByUserId = new Map<number, string>();
      for (const e of enrollments) {
        if (e?.user_id != null && typeof e.enrollment_state === "string") {
          enrollmentByUserId.set(Number(e.user_id), e.enrollment_state);
        }
      }

      if (students.length) {
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
          let pseudo = existing?.pseudonym ?? null;
          if (!pseudo) {
            // Generate a globally-unique 6-digit code via the SECURITY DEFINER helper.
            const { data: codeData, error: codeErr } = await admin
              .rpc("generate_unique_student_code");
            if (codeErr || !codeData) {
              console.error("generate_unique_student_code", codeErr);
              continue;
            }
            pseudo = codeData as string;
          }
          studentRows.push({
            teacher_id: teacherId,
            course_id: courseId,
            canvas_user_id: s.id,
            name: pseudo,
            sortable_name: pseudo,
            pseudonym: pseudo,
            pseudonym_seq: existing?.pseudonym_seq ?? null,
            email: null,
            // NEW: enrollment state for auto-archive
            enrollment_state: enrollmentByUserId.get(Number(s.id)) ?? "active",
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
      const assignments = await optionalCanvasRequest(canvasFetchAll<any>(creds, `/api/v1/courses/${c.id}/assignments`));
      const aRows = assignments.map((a) => {
        const isClassicQuiz = !!a.quiz_id;
        const isNewQuiz = !!a.is_quiz_lti_assignment && !isClassicQuiz;
        const isQuiz = isClassicQuiz || isNewQuiz || !!a.is_quiz_assignment;
        return {
        teacher_id: teacherId,
        course_id: courseId,
        canvas_assignment_id: a.id,
        // For New Quizzes, Canvas uses the assignment id as the quiz id in /api/quiz/v1
        canvas_quiz_id: isClassicQuiz ? a.quiz_id : (isNewQuiz ? a.id : null),
        kind: isQuiz ? "quiz" : "assignment",
        quiz_engine: isClassicQuiz ? "classic" : (isNewQuiz ? "new" : null),
        name: a.name ?? `Assignment ${a.id}`,
        description: a.description ? String(a.description).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000) : null,
        points_possible: a.points_possible ?? null,
        due_at: a.due_at ?? null,
        };
      });
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

      // 3c) New Quizzes items (LTI-based New Quizzes — separate API surface)
      // Failures are non-fatal; some Canvas instances disable the public API.
      const newQuizAssignments = assignments.filter((a) => !!a.is_quiz_lti_assignment && !a.quiz_id);
      if (newQuizAssignments.length) {
        const { data: assignMapForNQ } = await admin
          .from("assignments").select("id, canvas_assignment_id").eq("course_id", courseId);
        const aIdByCanvasNQ = new Map((assignMapForNQ ?? []).map((r) => [Number(r.canvas_assignment_id), r.id as string]));

        for (const nq of newQuizAssignments) {
          const internalAid = aIdByCanvasNQ.get(Number(nq.id));
          if (!internalAid) continue;
          let items: any[] = [];
          try {
            items = await canvasFetchAll<any>(creds, `/api/quiz/v1/courses/${c.id}/quizzes/${nq.id}/items`);
          } catch (e) {
            console.warn(`new-quiz ${nq.id} items fetch failed`, (e as Error).message);
            continue;
          }
          const qRows = items.map((it, i) => {
            const entry = it.entry ?? it; // some shapes nest under "entry"
            const interaction = entry?.interaction_type_slug ?? entry?.interaction_type ?? null;
            const data = entry?.interaction_data ?? {};
            // Normalize answer choices for the common interaction types
            let answers: any[] | null = null;
            if (interaction === "choice" || interaction === "multi-answer") {
              if (Array.isArray(data?.choices)) {
                answers = data.choices.slice(0, 12).map((ch: any) => ({
                  text: typeof ch?.item_body === "string"
                    ? String(ch.item_body).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600)
                    : null,
                  html: typeof ch?.item_body === "string" ? String(ch.item_body).slice(0, 800) : null,
                  weight: null,
                }));
              }
            } else if (interaction === "true-false") {
              answers = [
                { text: "True", html: "True", weight: null },
                { text: "False", html: "False", weight: null },
              ];
            } else if (interaction === "matching" && Array.isArray(data?.questions)) {
              answers = data.questions.slice(0, 12).map((q: any) => ({
                text: typeof q?.item_body === "string" ? String(q.item_body).replace(/<[^>]*>/g, " ").trim().slice(0, 600) : null,
                html: null, weight: null,
              }));
            } else if (interaction === "categorization" && Array.isArray(data?.categories)) {
              answers = data.categories.slice(0, 12).map((cat: any) => ({
                text: typeof cat?.item_body === "string" ? String(cat.item_body).replace(/<[^>]*>/g, " ").trim().slice(0, 600) : null,
                html: null, weight: null,
              }));
            } else if (interaction === "ordering" && Array.isArray(data?.choices)) {
              answers = data.choices.slice(0, 12).map((ch: any) => ({
                text: typeof ch?.item_body === "string" ? String(ch.item_body).replace(/<[^>]*>/g, " ").trim().slice(0, 600) : null,
                html: null, weight: null,
              }));
            }
            return {
              teacher_id: teacherId,
              assignment_id: internalAid,
              canvas_question_id: it.id ?? entry?.id,
              position: it.position ?? i + 1,
              question_text: entry?.item_body
                ? String(entry.item_body).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000)
                : (it.title ?? null),
              points_possible: it.points_possible ?? entry?.points_possible ?? null,
              answers,
              item_type: interaction,
            };
          }).filter((r) => r.canvas_question_id != null);
          if (qRows.length) {
            const { error: nqErr } = await admin.from("quiz_questions")
              .upsert(qRows, { onConflict: "assignment_id,canvas_question_id" });
            if (nqErr) console.error("quiz_questions (new) upsert", nqErr);
          }
        }
      }

      // Build student/assignment ID maps for submissions
      const { data: studentMap } = await admin.from("students").select("id, canvas_user_id").eq("course_id", courseId);
      const { data: assignMap } = await admin.from("assignments").select("id, canvas_assignment_id").eq("course_id", courseId);
      const sById = new Map((studentMap ?? []).map((r) => [Number(r.canvas_user_id), r.id as string]));
      const aById = new Map((assignMap ?? []).map((r) => [Number(r.canvas_assignment_id), r.id as string]));

      // 4) Submissions (per assignment, all students)
      const subs = await optionalCanvasRequest(canvasFetchAll<any>(creds, `/api/v1/courses/${c.id}/students/submissions?student_ids[]=all&per_page=100`));
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

    // 6) Auto-archive: roll any course whose Canvas state + school year both indicate "done"
    let archived = { courses_archived: 0, students_archived: 0 };
    try {
      const { data: archResult, error: archErr } = await admin.rpc("run_auto_archive", { _teacher_id: teacherId });
      if (archErr) console.warn("run_auto_archive failed:", archErr.message);
      else if (Array.isArray(archResult) && archResult[0]) archived = archResult[0] as typeof archived;
    } catch (e) {
      console.warn("run_auto_archive call failed:", (e as Error).message);
    }

    // 7) Auto-tag: queue any newly imported, still-untagged quiz questions for background AI tagging.
    let autoTag: { job_id?: string; added?: number } | null = null;
    try {
      const { data: ts } = await admin.from("teacher_settings").select("auto_tag_on_import").eq("teacher_id", teacherId).maybeSingle();
      const enabled = ts ? ts.auto_tag_on_import !== false : true;
      if (enabled && syncedCourseIds.length) {
        const { data: quizAssignRows } = await admin.from("assignments").select("id")
          .in("course_id", syncedCourseIds).eq("kind", "quiz");
        const ids = (quizAssignRows ?? []).map((r) => r.id as string);
        if (ids.length) {
          const { data: enq, error: enqErr } = await admin.rpc("enqueue_untagged_questions_for", {
            _teacher_id: teacherId, _scope: "import", _assignment_ids: ids,
          });
          if (enqErr) console.warn("enqueue_untagged_questions_for failed:", enqErr.message);
          else autoTag = enq as any;
        }
      }
    } catch (e) {
      console.warn("auto-tag enqueue failed:", (e as Error).message);
    }

    return new Response(JSON.stringify({ success: true, stats, question_scores: questionScores, archived, auto_tag: autoTag }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("canvas-sync error", e);
    if (e instanceof CanvasApiError && (e.status === 401 || e.status === 403)) {
      const tokenExpired = /expired access token|expired_at/i.test(e.responseBody);
      return new Response(JSON.stringify({
        error: tokenExpired
          ? "Your Canvas access token has expired. Create a new token in Canvas, then update it in Settings."
          : "Canvas rejected your access token. Update your Canvas connection in Settings.",
        code: tokenExpired ? "CANVAS_TOKEN_EXPIRED" : "CANVAS_TOKEN_INVALID",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
