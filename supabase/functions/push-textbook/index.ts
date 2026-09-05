// Pushes a compiled textbook to Canvas (Module per Part, Page per chapter) or
// Google Classroom (Topic per Part, Material per chapter as a Google Doc).
// Input: { platform: "canvas"|"google", course_id, published, textbook_id, title,
//          front_matter: { html, blocks }, parts: [{ title, chapters: [{ id, title, html, blocks }] }] }
import { z } from "https://esm.sh/zod@3.23.8";
import { canvasFetch } from "../_shared/canvasFetch.ts";
import { corsHeaders, errorResponse, gapi, getAccessToken, json, requireUser } from "../_shared/googleAuth.ts";
import { blocksToDocRequests } from "../_shared/googleContent.ts";

const Block = z.union([
  z.object({ type: z.enum(["h1", "h2", "h3", "p", "quote"]), text: z.string().max(20000) }),
  z.object({ type: z.enum(["ul", "ol"]), items: z.array(z.string().max(5000)).max(500) }),
  z.object({ type: z.literal("hr") }),
]);
const Chapter = z.object({ id: z.string().max(80), title: z.string().min(1).max(255), html: z.string().max(400_000).default(""), blocks: z.array(Block).max(3000).default([]) });
const Body = z.object({
  platform: z.enum(["canvas", "google"]),
  course_id: z.string().min(1).max(64),
  published: z.boolean().default(false),
  textbook_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  front_matter: z.object({ html: z.string().max(200_000).default(""), blocks: z.array(Block).max(1000).default([]) }).optional(),
  parts: z.array(z.object({ title: z.string().max(255).nullable().optional(), chapters: z.array(Chapter).max(80) })).max(40),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { teacherId, admin } = await requireUser(req);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;
    const now = new Date().toISOString();
    const links: Record<string, unknown>[] = [];
    const created: { chapter: string; url: string | null }[] = [];

    if (b.platform === "canvas") {
      const { data: creds } = await admin.from("canvas_credentials").select("base_url, api_token").eq("teacher_id", teacherId).maybeSingle();
      if (!creds) return json({ error: "No Canvas credentials. Connect Canvas in Settings first." }, 400);
      const base = `${creds.base_url}/api/v1/courses/${b.course_id}`;
      const api = async (path: string, payload: unknown, method = "POST") => {
        const res = await canvasFetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${creds.api_token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const text = await res.text();
        if (!res.ok) throw new Error(`Canvas ${res.status}: ${text.slice(0, 300)}`);
        return text ? JSON.parse(text) : {};
      };
      const addPage = async (moduleId: string, title: string, html: string, chapterId: string | null) => {
        const page = await api(`/pages`, { wiki_page: { title, body: html, published: b.published } });
        await api(`/modules/${moduleId}/items`, { module_item: { title, type: "Page", page_url: page.url, published: b.published } });
        if (chapterId) {
          links.push({ teacher_id: teacherId, question_set_key: `textbook:${b.textbook_id}:${chapterId}`, platform: "canvas", external_course_id: b.course_id, external_item_id: String(page.page_id ?? page.url), external_type: "textbook_chapter", url: page.html_url ?? null, direction: "exported", synced_at: now });
          created.push({ chapter: chapterId, url: page.html_url ?? null });
        }
        return page;
      };
      let position = 1;
      if (b.front_matter?.html) {
        const m = await api(`/modules`, { module: { name: `${b.title} — Start here`, position: position++ } });
        await addPage(m.id, `${b.title}: How to use this book`, b.front_matter.html, null);
        if (b.published) await api(`/modules/${m.id}`, { module: { published: true } }, "PUT");
      }
      for (const part of b.parts) {
        const m = await api(`/modules`, { module: { name: part.title || b.title, position: position++ } });
        for (const ch of part.chapters) await addPage(m.id, ch.title, ch.html, ch.id);
        if (b.published) await api(`/modules/${m.id}`, { module: { published: true } }, "PUT");
      }
    } else {
      const token = await getAccessToken(admin, teacherId);
      const course = b.course_id;
      const state = b.published ? "PUBLISHED" : "DRAFT";
      const makeDoc = async (title: string, blocks: z.infer<typeof Block>[]) => {
        const doc = await gapi<any>(token, "https://docs.googleapis.com/v1/documents", { method: "POST", body: JSON.stringify({ title }) });
        const requests = blocksToDocRequests(title, blocks as any, b.title);
        if (requests.length) await gapi(token, `https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
        return doc.documentId as string;
      };
      const makeTopic = async (name: string) => {
        try { const t = await gapi<any>(token, `https://classroom.googleapis.com/v1/courses/${course}/topics`, { method: "POST", body: JSON.stringify({ name: name.slice(0, 100) }) }); return t.topicId as string; }
        catch (e) { console.warn("topic failed", (e as Error).message); return undefined; }
      };
      const addMaterial = async (title: string, docId: string, topicId: string | undefined, chapterId: string | null) => {
        const payload: any = { title: title.slice(0, 3000), materials: [{ driveFile: { driveFile: { id: docId }, shareMode: "VIEW" } }], state };
        if (topicId) payload.topicId = topicId;
        const mat = await gapi<any>(token, `https://classroom.googleapis.com/v1/courses/${course}/courseWorkMaterials`, { method: "POST", body: JSON.stringify(payload) });
        if (chapterId) {
          const key = `textbook:${b.textbook_id}:${chapterId}`;
          links.push({ teacher_id: teacherId, question_set_key: key, platform: "google_drive", external_item_id: docId, external_type: "document", url: `https://docs.google.com/document/d/${docId}/edit`, direction: "exported", synced_at: now });
          links.push({ teacher_id: teacherId, question_set_key: key, platform: "google_classroom", external_course_id: course, external_item_id: String(mat.id), external_type: "textbook_chapter", url: mat.alternateLink ?? null, direction: "exported", synced_at: now });
          created.push({ chapter: chapterId, url: mat.alternateLink ?? null });
        }
      };
      if (b.front_matter?.blocks.length) {
        const topic = await makeTopic(`${b.title} — Start here`);
        const docId = await makeDoc(`${b.title}: How to use this book`, b.front_matter.blocks);
        await addMaterial(`${b.title}: How to use this book`, docId, topic, null);
      }
      for (const part of b.parts) {
        const topic = await makeTopic(part.title || b.title);
        for (const ch of part.chapters) {
          const docId = await makeDoc(ch.title, ch.blocks);
          await addMaterial(ch.title, docId, topic, ch.id);
        }
      }
    }

    if (links.length) {
      const { error } = await admin.from("resource_links").upsert(links, { onConflict: "teacher_id,platform,external_type,external_item_id" });
      if (error) console.warn("resource_links", error.message);
    }
    return json({ success: true, chapters: created.length, created });
  } catch (e) {
    return errorResponse(e);
  }
});
