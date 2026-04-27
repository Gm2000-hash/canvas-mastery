// Import a CSV of per-student per-question quiz scores.
//
// The client parses the CSV and sends rows + a column mapping. We:
//   1. Create or reuse a quiz assignment for the chosen course.
//   2. Upsert quiz_questions for each unique question text.
//   3. Match or create students by email/name within the course.
//   4. Upsert question_responses for each (student, question) cell.
//   5. Optionally call tag-question-standards and recompute-mastery.
//
// Body shape:
// {
//   course_id: string,
//   quiz_name: string,
//   due_at?: string,
//   layout: "long" | "wide",
//   mapping: { ... layout-specific },
//   rows: Array<Record<string, string>>,
//   options: { auto_tag: boolean, recompute: boolean }
// }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------- Hashing for synthetic Canvas-like IDs ----------
// We need deterministic positive bigints that fit comfortably in JS numbers and
// won't collide with real Canvas IDs (which are positive too — we use a
// large negative offset to keep them clearly separate).

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0; // unsigned 32-bit
}

function syntheticId(prefix: string, ...parts: string[]): number {
  // 32-bit hash, then offset into a negative range to never collide with Canvas.
  const h = fnv1a(`${prefix}::${parts.join("::")}`);
  // Range: -2^31 .. -1
  return -(h % 0x7fffffff) - 1;
}

function normalizeQuestionText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  // strip percent / spaces
  const cleaned = s.replace(/%/g, "").replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseBool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (["1", "true", "yes", "y", "correct", "t"].includes(s)) return true;
  if (["0", "false", "no", "n", "incorrect", "wrong", "f"].includes(s)) return false;
  return null;
}

// ---------- Pipeline ----------

type LongMapping = {
  student_email?: string;
  student_name?: string;
  question_text?: string;
  points?: string;
  points_possible?: string;
  correct?: string;
};
type WideMapping = {
  student_email?: string;
  student_name?: string;
  points_possible_row?: number; // 0-based index into rows; that row's cells are points possible
};

type Body = {
  course_id: string;
  quiz_name: string;
  due_at?: string | null;
  layout: "long" | "wide";
  mapping: LongMapping | WideMapping;
  rows: Array<Record<string, string>>;
  options?: { auto_tag?: boolean; recompute?: boolean };
};

type Stats = {
  questions_created: number;
  questions_reused: number;
  students_matched: number;
  students_created: number;
  responses_written: number;
  rows_skipped: number;
  skipped_examples: string[];
  ai_tagged?: number;
};

async function runImport(body: Body, teacherId: string, authHeader: string) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const stats: Stats = {
    questions_created: 0,
    questions_reused: 0,
    students_matched: 0,
    students_created: 0,
    responses_written: 0,
    rows_skipped: 0,
    skipped_examples: [],
  };

  // Verify course belongs to teacher
  const { data: course } = await admin
    .from("courses")
    .select("id, name")
    .eq("id", body.course_id)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  if (!course) throw new Error("Course not found");

  // ---------- 1. Assignment (create or reuse) ----------
  const quizName = (body.quiz_name || "Imported quiz").trim().slice(0, 200);
  const synthAssignmentId = syntheticId("csv-quiz", teacherId, body.course_id, quizName);

  const { data: existingAsg } = await admin
    .from("assignments")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("course_id", body.course_id)
    .eq("canvas_assignment_id", synthAssignmentId)
    .maybeSingle();

  let assignmentId: string;
  if (existingAsg) {
    assignmentId = existingAsg.id;
    // Update name/due if they were provided
    await admin
      .from("assignments")
      .update({ name: quizName, due_at: body.due_at ?? null })
      .eq("id", assignmentId);
  } else {
    const { data: newAsg, error } = await admin
      .from("assignments")
      .insert({
        teacher_id: teacherId,
        course_id: body.course_id,
        canvas_assignment_id: synthAssignmentId,
        kind: "quiz",
        name: quizName,
        due_at: body.due_at ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create assignment: ${error.message}`);
    assignmentId = newAsg.id;
  }

  // ---------- 2. Build per-row records depending on layout ----------
  type Record_ = {
    studentKey: string; // canonical key for grouping
    studentEmail: string | null;
    studentName: string;
    questionText: string;
    position: number;
    points: number | null;
    pointsPossible: number | null;
    correct: boolean | null;
  };
  const records: Record_[] = [];
  const questionPosByText = new Map<string, number>();

  function registerQuestion(text: string): number {
    const norm = normalizeQuestionText(text);
    if (!norm) return -1;
    if (!questionPosByText.has(norm)) {
      questionPosByText.set(norm, questionPosByText.size + 1);
    }
    return questionPosByText.get(norm)!;
  }

  if (body.layout === "long") {
    const m = body.mapping as LongMapping;
    if (!m.question_text || !m.points) {
      throw new Error("Long format requires question_text and points columns");
    }
    for (const row of body.rows) {
      const qText = String(row[m.question_text] ?? "").trim();
      const name = String((m.student_name && row[m.student_name]) ?? "").trim();
      const email = (m.student_email && String(row[m.student_email] ?? "").trim()) || null;
      if (!qText) {
        stats.rows_skipped++;
        if (stats.skipped_examples.length < 5) stats.skipped_examples.push("missing question text");
        continue;
      }
      if (!name && !email) {
        stats.rows_skipped++;
        if (stats.skipped_examples.length < 5) stats.skipped_examples.push("missing student name and email");
        continue;
      }
      const pts = parseNum(row[m.points]);
      const ptsPos = m.points_possible ? parseNum(row[m.points_possible]) : null;
      let correct = m.correct ? parseBool(row[m.correct]) : null;
      if (correct === null && pts !== null && ptsPos !== null && ptsPos > 0) {
        correct = pts >= ptsPos;
      }
      const pos = registerQuestion(qText);
      records.push({
        studentKey: (email ?? `name:${name.toLowerCase()}`),
        studentEmail: email,
        studentName: name || (email ?? "Unknown"),
        questionText: qText,
        position: pos,
        points: pts,
        pointsPossible: ptsPos,
        correct,
      });
    }
  } else {
    // Wide: each non-identifier column is a question; cell value = points
    const m = body.mapping as WideMapping;
    if (body.rows.length === 0) throw new Error("CSV is empty");
    const allCols = Object.keys(body.rows[0]);
    const idCols = new Set([m.student_email, m.student_name].filter(Boolean) as string[]);
    const questionCols = allCols.filter((c) => !idCols.has(c));

    // Optional points-possible row
    let perColPossible: Record<string, number | null> = {};
    let dataRows = body.rows;
    if (typeof m.points_possible_row === "number" && m.points_possible_row >= 0 && m.points_possible_row < body.rows.length) {
      const ppRow = body.rows[m.points_possible_row];
      for (const c of questionCols) perColPossible[c] = parseNum(ppRow[c]);
      dataRows = body.rows.filter((_, i) => i !== m.points_possible_row);
    }

    // Register questions in column order
    for (const c of questionCols) registerQuestion(c);

    for (const row of dataRows) {
      const name = String((m.student_name && row[m.student_name]) ?? "").trim();
      const email = (m.student_email && String(row[m.student_email] ?? "").trim()) || null;
      if (!name && !email) {
        stats.rows_skipped++;
        if (stats.skipped_examples.length < 5) stats.skipped_examples.push("missing student name and email");
        continue;
      }
      for (const c of questionCols) {
        const raw = row[c];
        if (raw === undefined || raw === null || String(raw).trim() === "") continue;
        const pts = parseNum(raw);
        if (pts === null) continue;
        const ptsPos = perColPossible[c] ?? null;
        const correct = ptsPos !== null && ptsPos > 0 ? pts >= ptsPos : null;
        records.push({
          studentKey: (email ?? `name:${name.toLowerCase()}`),
          studentEmail: email,
          studentName: name || (email ?? "Unknown"),
          questionText: c,
          position: registerQuestion(c),
          points: pts,
          pointsPossible: ptsPos,
          correct,
        });
      }
    }
  }

  if (records.length === 0) {
    throw new Error("No usable rows found in the CSV");
  }

  // ---------- 3. Upsert questions ----------
  const uniqueQuestions = new Map<string, { text: string; position: number; pointsPossible: number | null }>();
  for (const r of records) {
    const norm = normalizeQuestionText(r.questionText);
    if (!uniqueQuestions.has(norm)) {
      uniqueQuestions.set(norm, { text: r.questionText, position: r.position, pointsPossible: r.pointsPossible });
    } else if (r.pointsPossible !== null && uniqueQuestions.get(norm)!.pointsPossible === null) {
      uniqueQuestions.get(norm)!.pointsPossible = r.pointsPossible;
    }
  }

  const questionRows = Array.from(uniqueQuestions.values()).map((q) => ({
    teacher_id: teacherId,
    assignment_id: assignmentId,
    canvas_question_id: syntheticId("csv-q", String(assignmentId), normalizeQuestionText(q.text)),
    question_text: q.text,
    position: q.position,
    points_possible: q.pointsPossible,
    answers: null as any,
  }));

  // Find existing first to count reused vs created
  const synthIds = questionRows.map((q) => q.canvas_question_id);
  const { data: existingQs } = await admin
    .from("quiz_questions")
    .select("id, canvas_question_id")
    .eq("teacher_id", teacherId)
    .eq("assignment_id", assignmentId)
    .in("canvas_question_id", synthIds);
  const existingByCanvasId = new Map<number, string>();
  for (const eq of existingQs ?? []) existingByCanvasId.set(Number(eq.canvas_question_id), eq.id);
  const newQuestionCanvasIds = new Set<number>();
  for (const q of questionRows) {
    if (existingByCanvasId.has(q.canvas_question_id)) stats.questions_reused++;
    else { stats.questions_created++; newQuestionCanvasIds.add(q.canvas_question_id); }
  }

  // Upsert in chunks
  for (let i = 0; i < questionRows.length; i += 200) {
    const chunk = questionRows.slice(i, i + 200);
    const { error } = await admin
      .from("quiz_questions")
      .upsert(chunk, { onConflict: "assignment_id,canvas_question_id" });
    if (error) throw new Error(`Failed upserting questions: ${error.message}`);
  }

  // Read back all question IDs
  const { data: allQs } = await admin
    .from("quiz_questions")
    .select("id, canvas_question_id, question_text")
    .eq("teacher_id", teacherId)
    .eq("assignment_id", assignmentId)
    .in("canvas_question_id", synthIds);
  const qIdByCanvasId = new Map<number, string>();
  for (const q of allQs ?? []) qIdByCanvasId.set(Number(q.canvas_question_id), q.id);

  // ---------- 4. Resolve students ----------
  const studentMap = new Map<string, { id: string; email: string | null; name: string }>();
  for (const r of records) {
    if (!studentMap.has(r.studentKey)) {
      studentMap.set(r.studentKey, { id: "", email: r.studentEmail, name: r.studentName });
    } else if (r.studentEmail && !studentMap.get(r.studentKey)!.email) {
      studentMap.get(r.studentKey)!.email = r.studentEmail;
    }
  }

  // Pull existing students in this course (and teacher's students with matching emails for cross-course match)
  const { data: courseStudents } = await admin
    .from("students")
    .select("id, name, sortable_name, email, canvas_user_id")
    .eq("teacher_id", teacherId)
    .eq("course_id", body.course_id);

  const byEmail = new Map<string, { id: string; email: string | null; name: string }>();
  const byName = new Map<string, { id: string; email: string | null; name: string }>();
  for (const s of courseStudents ?? []) {
    const rec = { id: s.id as string, email: (s.email as string | null) ?? null, name: s.name as string };
    if (s.email) byEmail.set(String(s.email).toLowerCase(), rec);
    if (s.name) byName.set(String(s.name).toLowerCase(), rec);
  }

  const toCreate: Array<{ key: string; name: string; email: string | null }> = [];
  for (const [key, info] of studentMap) {
    let match: { id: string; email: string | null; name: string } | undefined;
    if (info.email) match = byEmail.get(info.email.toLowerCase());
    if (!match && info.name) match = byName.get(info.name.toLowerCase());
    if (match) {
      info.id = match.id;
      stats.students_matched++;
      // Backfill email if we now know it
      if (info.email && !match.email) {
        await admin.from("students").update({ email: info.email }).eq("id", match.id);
      }
    } else {
      toCreate.push({ key, name: info.name, email: info.email });
    }
  }

  if (toCreate.length > 0) {
    const newRows = toCreate.map((s) => ({
      teacher_id: teacherId,
      course_id: body.course_id,
      canvas_user_id: syntheticId("csv-s", teacherId, body.course_id, (s.email ?? s.name).toLowerCase()),
      name: s.name,
      sortable_name: s.name,
      email: s.email,
    }));
    const { data: inserted, error } = await admin
      .from("students")
      .upsert(newRows, { onConflict: "course_id,canvas_user_id" })
      .select("id, canvas_user_id, name, email");
    if (error) throw new Error(`Failed creating students: ${error.message}`);
    const byCanvasId = new Map<number, string>();
    for (const s of inserted ?? []) byCanvasId.set(Number(s.canvas_user_id), s.id as string);
    for (const s of toCreate) {
      const cid = syntheticId("csv-s", teacherId, body.course_id, (s.email ?? s.name).toLowerCase());
      const id = byCanvasId.get(cid);
      if (id) {
        studentMap.get(s.key)!.id = id;
        stats.students_created++;
      }
    }
  }

  // ---------- 5. Build response rows ----------
  const responseRows: any[] = [];
  for (const r of records) {
    const sid = studentMap.get(r.studentKey)?.id;
    const norm = normalizeQuestionText(r.questionText);
    const canvasQId = syntheticId("csv-q", String(assignmentId), norm);
    const qid = qIdByCanvasId.get(canvasQId);
    if (!sid || !qid) {
      stats.rows_skipped++;
      continue;
    }
    responseRows.push({
      teacher_id: teacherId,
      question_id: qid,
      student_id: sid,
      points: r.points,
      points_possible: r.pointsPossible,
      correct: r.correct,
    });
  }

  for (let i = 0; i < responseRows.length; i += 500) {
    const chunk = responseRows.slice(i, i + 500);
    const { error } = await admin
      .from("question_responses")
      .upsert(chunk, { onConflict: "question_id,student_id" });
    if (error) throw new Error(`Failed upserting responses: ${error.message}`);
    stats.responses_written += chunk.length;
  }

  // ---------- 6. Optional: AI tagging ----------
  let tagResult: any = null;
  if (body.options?.auto_tag && newQuestionCanvasIds.size > 0) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/tag-question-standards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });
      const j = await r.json().catch(() => ({}));
      tagResult = j;
      stats.ai_tagged = Number(j?.suggestions?.length ?? j?.tagged ?? 0);
    } catch (e) {
      tagResult = { error: (e as Error).message.slice(0, 200) };
    }
  }

  // ---------- 7. Optional: recompute mastery ----------
  let recompute: any = null;
  if (body.options?.recompute !== false && stats.responses_written > 0) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/recompute-mastery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: "{}",
      });
      const j = await r.json().catch(() => ({}));
      recompute = { snapshots: Number(j?.snapshots ?? 0), error: j?.error };
    } catch (e) {
      recompute = { snapshots: 0, error: (e as Error).message.slice(0, 200) };
    }
  }

  return { assignment_id: assignmentId, stats, tagResult, recompute };
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

    const body = (await req.json()) as Body;
    if (!body.course_id) throw new Error("course_id is required");
    if (!body.quiz_name) throw new Error("quiz_name is required");
    if (!Array.isArray(body.rows) || body.rows.length === 0) throw new Error("rows is required");
    if (body.rows.length > 20000) throw new Error("Too many rows (max 20,000). Split the file and try again.");
    if (body.layout !== "long" && body.layout !== "wide") throw new Error("layout must be 'long' or 'wide'");

    const out = await runImport(body, teacherId, req.headers.get("Authorization") ?? "");
    return new Response(JSON.stringify({ success: true, ...out }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-quiz-csv error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
