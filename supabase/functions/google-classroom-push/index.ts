// Sends a library resource to Google: creates a Google Doc or Form in the
// teacher's Drive, and optionally attaches it to a Classroom assignment/material.
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, gapi, getAccessToken, json, requireUser } from "../_shared/googleAuth.ts";
import { blocksToDocRequests, questionsToFormRequests } from "../_shared/googleContent.ts";

const Block = z.union([
  z.object({ type: z.enum(["h1", "h2", "h3", "p", "quote"]), text: z.string().max(20000) }),
  z.object({ type: z.enum(["ul", "ol"]), items: z.array(z.string().max(5000)).max(500) }),
  z.object({ type: z.literal("hr") }),
]);
const Question = z.object({
  text: z.string().min(1).max(20000),
  points: z.number().min(0).max(1000).default(1),
  itemType: z.string().nullable().optional(),
  answers: z.array(z.object({ text: z.string().max(4000), correct: z.boolean() })).max(20).default([]),
});
const Body = z.object({
  google_course_id: z.string().max(64).nullable().optional(),
  target: z.enum(["material", "assignment", "doc_only"]).default("doc_only"),
  format: z.enum(["doc", "form"]).default("doc"),
  title: z.string().min(1).max(255),
  meta: z.string().max(500).optional(),
  description: z.string().max(4000).optional(),
  blocks: z.array(Block).max(2000).default([]),
  questions: z.array(Question).max(200).default([]),
  published: z.boolean().default(false),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  points: z.number().min(0).max(1000).nullable().optional(),
  library_item_id: z.string().uuid().nullable().optional(),
  question_set_key: z.string().max(200).nullable().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { teacherId, admin } = await requireUser(req);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;
    if (b.format === "form" && !b.questions.length) return json({ error: "A Google Form needs at least one question" }, 400);
    if (b.target !== "doc_only" && !b.google_course_id) return json({ error: "Pick a Classroom course" }, 400);

    const token = await getAccessToken(admin, teacherId);
    const now = new Date().toISOString();
    const links: Record<string, unknown>[] = [];
    const owner = { teacher_id: teacherId, library_item_id: b.library_item_id ?? null, question_set_key: b.question_set_key ?? null };

    // 1) Create the Drive artefact
    let fileId = "", fileUrl = "", formUrl: string | null = null;
    if (b.format === "doc") {
      const doc = await gapi<any>(token, "https://docs.googleapis.com/v1/documents", { method: "POST", body: JSON.stringify({ title: b.title }) });
      fileId = doc.documentId;
      const blocks = [...b.blocks];
      if (b.questions.length) {
        blocks.push({ type: "h2", text: "Questions" });
        b.questions.forEach((q, i) => {
          blocks.push({ type: "p", text: `**${i + 1}.** ${q.text}${q.points !== 1 ? ` _(${q.points} pts)_` : ""}` });
          if (q.answers.length) blocks.push({ type: "ul", items: q.answers.map((a, j) => `${String.fromCharCode(65 + j)}. ${a.text}`) });
        });
      }
      const requests = blocksToDocRequests(b.title, blocks, b.meta);
      if (requests.length) await gapi(token, `https://docs.googleapis.com/v1/documents/${fileId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
      fileUrl = `https://docs.google.com/document/d/${fileId}/edit`;
      links.push({ ...owner, platform: "google_drive", external_item_id: fileId, external_type: "document", url: fileUrl, direction: "exported", synced_at: now });
    } else {
      const form = await gapi<any>(token, "https://forms.googleapis.com/v1/forms", { method: "POST", body: JSON.stringify({ info: { title: b.title, documentTitle: b.title } }) });
      fileId = form.formId;
      const requests = questionsToFormRequests(b.questions, b.description);
      await gapi(token, `https://forms.googleapis.com/v1/forms/${fileId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
      fileUrl = `https://docs.google.com/forms/d/${fileId}/edit`;
      formUrl = fileUrl;
      links.push({ ...owner, platform: "google_drive", external_item_id: fileId, external_type: "form", url: fileUrl, direction: "exported", synced_at: now });
    }

    // 2) Attach to Classroom
    let classroomUrl: string | null = null;
    if (b.target !== "doc_only" && b.google_course_id) {
      const course = b.google_course_id;
      const state = b.published ? "PUBLISHED" : "DRAFT";
      const material = b.format === "form"
        ? { form: { formUrl } }
        : { driveFile: { driveFile: { id: fileId }, shareMode: b.target === "assignment" ? "STUDENT_COPY" : "VIEW" } };
      const payload: any = { title: b.title, description: b.description ?? undefined, materials: [material], state };
      let created: any;
      if (b.target === "material") {
        created = await gapi(token, `https://classroom.googleapis.com/v1/courses/${course}/courseWorkMaterials`, { method: "POST", body: JSON.stringify(payload) });
      } else {
        payload.workType = "ASSIGNMENT";
        const pts = b.points ?? (b.questions.length ? b.questions.reduce((s, q) => s + q.points, 0) : null);
        if (pts != null && pts > 0) payload.maxPoints = pts;
        if (b.due_date) {
          const [y, m, d] = b.due_date.split("-").map(Number);
          payload.dueDate = { year: y, month: m, day: d };
          payload.dueTime = { hours: 23, minutes: 59 };
        }
        try {
          created = await gapi(token, `https://classroom.googleapis.com/v1/courses/${course}/courseWork`, { method: "POST", body: JSON.stringify(payload) });
        } catch (e) {
          // Some domains reject `form` materials via API; fall back to a link attachment.
          if (b.format === "form") {
            payload.materials = [{ link: { url: formUrl } }];
            created = await gapi(token, `https://classroom.googleapis.com/v1/courses/${course}/courseWork`, { method: "POST", body: JSON.stringify(payload) });
          } else throw e;
        }
      }
      classroomUrl = created.alternateLink ?? null;
      links.push({
        ...owner, platform: "google_classroom", external_course_id: course, external_item_id: String(created.id),
        external_type: b.target === "material" ? "material" : "coursework", url: classroomUrl, direction: "exported", synced_at: now,
      });
    }

    if (links.length) {
      const { error } = await admin.from("resource_links").upsert(links, { onConflict: "teacher_id,platform,external_type,external_item_id" });
      if (error) console.warn("resource_links", error.message);
    }

    return json({ success: true, id: fileId, file_url: fileUrl, html_url: classroomUrl ?? fileUrl, classroom_url: classroomUrl });
  } catch (e) {
    return errorResponse(e);
  }
});
