// Pulls per-student per-question scores from Canvas Classic Quizzes and
// upserts them into question_responses.
//
// Body (all optional):
//   {
//     course_id?: string;          // internal course UUID — sync all quizzes in this course
//     assignment_ids?: string[];   // internal assignment UUIDs — sync just these quizzes
//   }
//
// At least one filter must be provided. Returns per-quiz results so the UI can
// show which quizzes succeeded, were skipped, or failed.
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

async function canvasFetchAll<T>(creds: CanvasCreds, path: string): Promise<T[]> {
  const items: T[] = [];
  let url = `${creds.base_url}${path}${path.includes("?") ? "&" : "?"}per_page=100`;
  let safety = 0;
  while (url && safety < 30) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${creds.api_token}` } });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Canvas ${res.status}: ${t.slice(0, 200)}`);
    }
    const page = (await res.json()) as any;
    // Some Canvas endpoints wrap the array in a key (e.g. quiz_submissions, quiz_submission_questions)
    if (Array.isArray(page)) items.push(...page);
    else if (page && typeof page === "object") {
      // pull whichever key holds the array
      const arrKey = Object.keys(page).find((k) => Array.isArray((page as any)[k]));
      if (arrKey) items.push(...((page as any)[arrKey] as T[]));
    }
    const links = parseLinkHeader(res.headers.get("Link"));
    url = links.next ?? "";
    safety++;
  }
  return items;
}

type QuizResult = {
  assignment_id: string;
  name: string;
  status: "ok" | "skipped" | "error";
  responses: number;
  reason?: string;
};

export async function syncQuestionScoresForTeacher(opts: {
  teacherId: string;
  courseId?: string | null;
  assignmentIds?: string[] | null;
}): Promise<{ stats: { quizzes: number; responses: number }; results: QuizResult[] }> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: creds } = await admin
    .from("canvas_credentials").select("base_url, api_token")
    .eq("teacher_id", opts.teacherId).maybeSingle();
  if (!creds) throw new Error("No Canvas credentials. Connect Canvas first.");

  // Find candidate quiz assignments
  let aQuery = admin
    .from("assignments")
    .select("id, name, course_id, canvas_assignment_id, canvas_quiz_id, kind, quiz_engine, courses!inner(canvas_course_id)")
    .eq("teacher_id", opts.teacherId)
    .eq("kind", "quiz")
    .not("canvas_quiz_id", "is", null);
  if (opts.courseId) aQuery = aQuery.eq("course_id", opts.courseId);
  if (opts.assignmentIds && opts.assignmentIds.length) aQuery = aQuery.in("id", opts.assignmentIds);
  const { data: quizAssignments, error: aErr } = await aQuery;
  if (aErr) throw aErr;

  const stats = { quizzes: 0, responses: 0 };
  const results: QuizResult[] = [];

  for (const qa of quizAssignments ?? []) {
    const result: QuizResult = { assignment_id: qa.id as string, name: qa.name as string, status: "ok", responses: 0 };
    const courseCanvasId = (qa as any).courses?.canvas_course_id as number | undefined;
    const quizId = qa.canvas_quiz_id as number | null;
    if (!courseCanvasId || !quizId) {
      result.status = "skipped"; result.reason = "Missing Canvas IDs";
      results.push(result); continue;
    }

    // Map canvas_question_id -> internal question.id
    const { data: qRows } = await admin
      .from("quiz_questions").select("id, canvas_question_id")
      .eq("assignment_id", qa.id);
    const qIdByCanvas = new Map((qRows ?? []).map((r) => [Number(r.canvas_question_id), r.id as string]));
    if (qIdByCanvas.size === 0) {
      result.status = "skipped"; result.reason = "No synced questions";
      results.push(result); continue;
    }

    // Map canvas_user_id -> internal student.id
    const { data: sRows } = await admin
      .from("students").select("id, canvas_user_id")
      .eq("course_id", qa.course_id);
    const sIdByCanvas = new Map((sRows ?? []).map((r) => [Number(r.canvas_user_id), r.id as string]));

    // 1) List quiz submissions (one per student attempt). Use submission attempts to pick latest per student.
    let quizSubs: any[] = [];
    try {
      quizSubs = await canvasFetchAll<any>(
        creds,
        `/api/v1/courses/${courseCanvasId}/quizzes/${quizId}/submissions`,
      );
    } catch (e) {
      result.status = "error"; result.reason = (e as Error).message.slice(0, 200);
      results.push(result); continue;
    }
    if (quizSubs.length === 0) {
      result.status = "ok"; result.reason = "No submissions yet";
      results.push(result); continue;
    }

    // Pick latest attempt per student
    const latestByStudent = new Map<number, any>();
    for (const qs of quizSubs) {
      const uid = Number(qs.user_id);
      const cur = latestByStudent.get(uid);
      if (!cur || (Number(qs.attempt ?? 1) > Number(cur.attempt ?? 1))) {
        latestByStudent.set(uid, qs);
      }
    }

    // 2) For each chosen submission, fetch per-question answers
    const responseRows: any[] = [];
    for (const [uid, qs] of latestByStudent) {
      const studentId = sIdByCanvas.get(uid);
      if (!studentId) continue; // student not synced
      const qsId = Number(qs.id);
      if (!Number.isFinite(qsId)) continue;
      let answers: any[] = [];
      try {
        answers = await canvasFetchAll<any>(creds, `/api/v1/quiz_submissions/${qsId}/questions`);
      } catch (e) {
        // Some attempts (in-progress, untaken) yield 4xx. Non-fatal.
        console.warn(`quiz_submission ${qsId} answers failed:`, (e as Error).message);
        continue;
      }
      for (const ans of answers) {
        const qid = qIdByCanvas.get(Number(ans.quiz_question_id ?? ans.id));
        if (!qid) continue;
        const points = ans.points == null ? null : Number(ans.points);
        // Canvas returns `correct` as boolean | "partial" | "undefined" | null. Normalize.
        let correct: boolean | null = null;
        if (typeof ans.correct === "boolean") correct = ans.correct;
        else if (ans.correct === "true") correct = true;
        else if (ans.correct === "false") correct = false;
        // points_possible isn't on the answer payload; pull from quiz_questions later
        responseRows.push({
          teacher_id: opts.teacherId,
          question_id: qid,
          student_id: studentId,
          points,
          correct,
        });
      }
    }

    // Fill in points_possible from quiz_questions and derive points from
    // correctness when Canvas's /quiz_submissions/:id/questions endpoint
    // omits per-question points (the common case for Classic Quizzes).
    if (responseRows.length) {
      const { data: qPoints } = await admin
        .from("quiz_questions").select("id, points_possible")
        .eq("assignment_id", qa.id);
      const ptsById = new Map((qPoints ?? []).map((r) => [r.id as string, r.points_possible as number | null]));
      for (const r of responseRows) {
        const pp = ptsById.get(r.question_id) ?? null;
        r.points_possible = pp;
        // If correctness is known but points are missing, derive points.
        if (r.points == null && r.correct != null && pp != null && pp > 0) {
          r.points = r.correct ? pp : 0;
        }
        // If points are known but correctness isn't, derive correctness.
        if (r.correct == null && r.points != null && pp != null && pp > 0) {
          r.correct = r.points >= pp * 0.999;
        }
      }
      // Upsert in chunks
      for (let i = 0; i < responseRows.length; i += 500) {
        const chunk = responseRows.slice(i, i + 500);
        const { error: upErr } = await admin
          .from("question_responses")
          .upsert(chunk, { onConflict: "question_id,student_id" });
        if (upErr) {
          result.status = "error"; result.reason = upErr.message.slice(0, 200);
          break;
        }
        result.responses += chunk.length;
      }
    }
    if (result.status === "ok") {
      stats.quizzes++;
      stats.responses += result.responses;
    }
    results.push(result);
  }

  return { stats, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const teacherId = userData.user.id;

    let body: any = {};
    try { body = req.method === "POST" ? await req.json() : {}; } catch { /* empty ok */ }
    const courseId: string | null = body?.course_id ?? null;
    const assignmentIds: string[] | null = Array.isArray(body?.assignment_ids) ? body.assignment_ids : null;
    // No filter = sync every quiz the teacher owns.

    const out = await syncQuestionScoresForTeacher({ teacherId, courseId, assignmentIds });

    // Auto-recompute mastery so freshly imported scores roll up to standards
    // immediately. Best-effort — failures here don't fail the import.
    let recompute: { snapshots: number; error?: string } | null = null;
    if ((out.stats?.responses ?? 0) > 0) {
      try {
        const authHeader = req.headers.get("Authorization") ?? "";
        const r = await fetch(`${SUPABASE_URL}/functions/v1/recompute-mastery`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
            "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          },
          body: "{}",
        });
        const j = await r.json().catch(() => ({}));
        recompute = { snapshots: Number(j?.snapshots ?? 0), error: j?.error };
      } catch (e) {
        recompute = { snapshots: 0, error: (e as Error).message.slice(0, 200) };
      }
    }

    return new Response(JSON.stringify({ success: true, ...out, recompute }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("canvas-sync-question-scores error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
