// Imports Google Classroom coursework + materials into the Library, and quiz
// Forms into the question bank. Input: { course_ids: string[] } (Google course ids)
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, gapi, gapiList, getAccessToken, json, requireUser } from "../_shared/googleAuth.ts";
import { fetchDocMarkdown, fetchSlidesMarkdown, formIdFromUrl, formToQuestions } from "../_shared/googleContent.ts";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.|application\/vnd\.ms-powerpoint|image\/|text\/plain)/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { teacherId, admin } = await requireUser(req);
    const parsed = z.object({ course_ids: z.array(z.string().min(1).max(64)).min(1).max(20) }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Pick at least one Classroom course" }, 400);
    const token = await getAccessToken(admin, teacherId);

    const stats = { items: 0, files: 0, quizzes: 0, questions: 0, skipped: 0 };
    const quizAssignmentIds: string[] = [];

    for (const gcId of parsed.data.course_ids) {
      const course = await gapi<any>(token, `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(gcId)}`);
      const courseName = String(course.name ?? "Google Classroom");
      // Local course row so Form quizzes have a home in the question bank.
      const { data: courseRow, error: cErr } = await admin.from("courses").upsert({
        teacher_id: teacherId, platform: "google_classroom", google_course_id: gcId, name: courseName,
        course_code: course.section ?? null, canvas_workflow_state: null, last_synced_at: new Date().toISOString(),
      }, { onConflict: "teacher_id,google_course_id" }).select("id").single();
      if (cErr) throw cErr;

      const work = await gapiList<any>(token, `https://classroom.googleapis.com/v1/courses/${gcId}/courseWork`, "courseWork").catch(() => []);
      const materials = await gapiList<any>(token, `https://classroom.googleapis.com/v1/courses/${gcId}/courseWorkMaterials`, "courseWorkMaterial").catch(() => []);
      const entries = [
        ...work.map((w) => ({ ...w, _type: "coursework" as const })),
        ...materials.map((m) => ({ ...m, _type: "material" as const })),
      ];

      for (const e of entries) {
        try {
          const title = String(e.title ?? "Untitled").slice(0, 200);
          const parts: string[] = [];
          if (e.description) parts.push(String(e.description));
          let filePath: string | null = null, fileMime: string | null = null, fileName: string | null = null;
          const forms: { id: string; title: string; url: string }[] = [];

          for (const m of e.materials ?? []) {
            if (m.driveFile?.driveFile?.id) {
              const df = m.driveFile.driveFile;
              const meta = await gapi<any>(token, `https://www.googleapis.com/drive/v3/files/${df.id}?fields=id,name,mimeType,size,webViewLink`).catch(() => null);
              if (!meta) { parts.push(`[${df.title ?? "Attachment"}](${df.alternateLink})`); continue; }
              if (meta.mimeType === "application/vnd.google-apps.document") {
                const md = await fetchDocMarkdown(token, meta.id).catch(() => "");
                parts.push(md || `[${meta.name}](${meta.webViewLink})`);
              } else if (meta.mimeType === "application/vnd.google-apps.presentation") {
                const md = await fetchSlidesMarkdown(token, meta.id).catch(() => "");
                parts.push(md || `[${meta.name}](${meta.webViewLink})`);
              } else if (meta.mimeType === "application/vnd.google-apps.form") {
                forms.push({ id: meta.id, title: meta.name, url: meta.webViewLink });
              } else if (!filePath && ALLOWED_MIME.test(meta.mimeType ?? "") && Number(meta.size ?? 0) <= MAX_FILE_BYTES) {
                const res = await fetch(`https://www.googleapis.com/drive/v3/files/${meta.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                  const bytes = new Uint8Array(await res.arrayBuffer());
                  const safe = String(meta.name).replace(/[^\w.\-]+/g, "_").slice(0, 120);
                  const path = `${teacherId}/google/${meta.id}-${safe}`;
                  const { error: upErr } = await admin.storage.from("library-files").upload(path, bytes, { contentType: meta.mimeType, upsert: true });
                  if (!upErr) { filePath = path; fileMime = meta.mimeType; fileName = meta.name; stats.files++; }
                  else parts.push(`[${meta.name}](${meta.webViewLink})`);
                } else parts.push(`[${meta.name}](${meta.webViewLink})`);
              } else {
                parts.push(`[${meta.name}](${meta.webViewLink})`);
              }
            } else if (m.form?.formUrl) {
              const id = formIdFromUrl(m.form.formUrl);
              if (id) forms.push({ id, title: m.form.title ?? "Form", url: m.form.formUrl });
              else parts.push(`[${m.form.title ?? "Form"}](${m.form.formUrl})`);
            } else if (m.link?.url) {
              parts.push(`[${m.link.title ?? m.link.url}](${m.link.url})`);
            } else if (m.youtubeVideo?.alternateLink) {
              parts.push(`[▶ ${m.youtubeVideo.title ?? "Video"}](${m.youtubeVideo.alternateLink})`);
            }
          }

          // --- Quiz forms → question bank
          let importedQuiz = false;
          for (const f of forms) {
            const form = await gapi<any>(token, `https://forms.googleapis.com/v1/forms/${encodeURIComponent(f.id)}`).catch(() => null);
            if (!form) { parts.push(`[${f.title}](${f.url})`); continue; }
            const { isQuiz, questions } = formToQuestions(form);
            if (!isQuiz || !questions.length) { parts.push(`[${f.title}](${f.url})`); continue; }
            const { data: aRow, error: aErr } = await admin.from("assignments").upsert({
              teacher_id: teacherId, course_id: courseRow.id, kind: "quiz", name: title,
              description: e.description ?? null, google_coursework_id: String(e.id), google_form_id: f.id,
              points_possible: questions.reduce((s, q) => s + q.points_possible, 0),
              due_at: e.dueDate ? new Date(Date.UTC(e.dueDate.year, e.dueDate.month - 1, e.dueDate.day, e.dueTime?.hours ?? 23, e.dueTime?.minutes ?? 59)).toISOString() : null,
              quiz_engine: "google_form",
            }, { onConflict: "teacher_id,google_coursework_id" }).select("id").single();
            if (aErr) { console.error("assignment upsert", aErr); continue; }
            const rows = questions.map((q) => ({
              teacher_id: teacherId, assignment_id: aRow.id, google_item_id: q.google_item_id, position: q.position,
              question_text: q.question_text, points_possible: q.points_possible, answers: q.answers, item_type: q.item_type,
            }));
            const { error: qErr } = await admin.from("quiz_questions").upsert(rows, { onConflict: "assignment_id,google_item_id" });
            if (qErr) { console.error("questions upsert", qErr); continue; }
            await admin.from("resource_links").upsert({
              teacher_id: teacherId, assignment_id: aRow.id, platform: "google_classroom", external_course_id: gcId, external_course_name: courseName,
              external_item_id: String(e.id), external_type: "coursework_quiz", url: e.alternateLink ?? f.url, direction: "imported", synced_at: new Date().toISOString(),
            }, { onConflict: "teacher_id,platform,external_type,external_item_id" });
            quizAssignmentIds.push(aRow.id);
            stats.quizzes++; stats.questions += rows.length; importedQuiz = true;
          }

          const body = parts.join("\n\n").trim();
          if (!body && !filePath) { if (!importedQuiz) stats.skipped++; continue; }

          // --- Library item (materials → readings, assignments → activities)
          const { data: existing } = await admin.from("resource_links").select("library_item_id")
            .eq("teacher_id", teacherId).eq("platform", "google_classroom").eq("external_type", e._type).eq("external_item_id", String(e.id)).maybeSingle();
          const item = {
            teacher_id: teacherId,
            kind: e._type === "material" ? "reading" : "activity",
            title, body: body || null, source: "google",
            file_path: filePath, file_mime: fileMime, file_name: fileName,
          };
          let itemId = existing?.library_item_id as string | null;
          if (itemId) {
            const { error } = await admin.from("library_items").update({ title: item.title, body: item.body, file_path: item.file_path ?? undefined, file_mime: item.file_mime ?? undefined, file_name: item.file_name ?? undefined }).eq("id", itemId);
            if (error) { stats.skipped++; continue; }
          } else {
            const { data: ins, error } = await admin.from("library_items").insert(item).select("id").single();
            if (error) { console.error("library insert", error); stats.skipped++; continue; }
            itemId = ins.id;
          }
          await admin.from("resource_links").upsert({
            teacher_id: teacherId, library_item_id: itemId, platform: "google_classroom", external_course_id: gcId, external_course_name: courseName,
            external_item_id: String(e.id), external_type: e._type, url: e.alternateLink ?? null, direction: "imported", synced_at: new Date().toISOString(),
          }, { onConflict: "teacher_id,platform,external_type,external_item_id" });
          stats.items++;
        } catch (err) {
          console.warn("classroom item failed", (err as Error).message);
          stats.skipped++;
        }
      }
    }

    // Queue newly imported questions for standards + DOK tagging (same as Canvas).
    let autoTag: unknown = null;
    if (quizAssignmentIds.length) {
      try {
        const { data: ts } = await admin.from("teacher_settings").select("auto_tag_on_import").eq("teacher_id", teacherId).maybeSingle();
        if (!ts || ts.auto_tag_on_import !== false) {
          const { data } = await admin.rpc("enqueue_untagged_questions_for", { _teacher_id: teacherId, _scope: "import", _assignment_ids: quizAssignmentIds });
          autoTag = data;
        }
      } catch (e) { console.warn("enqueue failed", (e as Error).message); }
    }

    return json({ success: true, stats, auto_tag: autoTag });
  } catch (e) {
    return errorResponse(e);
  }
});
