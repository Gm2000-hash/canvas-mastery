// Imports Canvas course Pages (as Readings) and Files (into the library) for
// the signed-in teacher. Input: { course_ids: uuid[] } (app course ids).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.|application\/vnd\.ms-powerpoint|image\/|text\/plain)/;

type Creds = { base_url: string; api_token: string };

function parseLink(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(",")) {
    const m = part.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/);
    if (m) out[m[2]] = m[1];
  }
  return out;
}

async function fetchAll<T>(creds: Creds, path: string): Promise<T[]> {
  const items: T[] = [];
  let url = `${creds.base_url}${path}${path.includes("?") ? "&" : "?"}per_page=100`;
  let n = 0;
  while (url && n < 20) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${creds.api_token}` } });
    if (!res.ok) {
      if (res.status === 401) throw new Error("Canvas rejected your access token. Update it in Settings.");
      return items; // 403/404 = feature disabled for this course
    }
    const page = await res.json();
    items.push(...(Array.isArray(page) ? page : []));
    url = parseLink(res.headers.get("Link")).next ?? "";
    n++;
  }
  return items;
}

function htmlToMarkdownish(html: string): string {
  let s = String(html ?? "");
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, l, t) => `\n${"#".repeat(Number(l))} ${t}\n`);
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");
  s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**");
  s = s.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "_$2_");
  s = s.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|ul|ol|tr)>/gi, "\n\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const teacherId = userData.user.id;

    const parsed = z.object({ course_ids: z.array(z.string().uuid()).min(1).max(20) }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: creds } = await admin.from("canvas_credentials").select("base_url, api_token").eq("teacher_id", teacherId).maybeSingle();
    if (!creds) return json({ error: "No Canvas credentials. Connect Canvas first." }, 400);

    const { data: courses } = await admin.from("courses")
      .select("id, canvas_course_id, name")
      .eq("teacher_id", teacherId).in("id", parsed.data.course_ids);

    const stats = { pages: 0, files: 0, skipped: 0 };

    for (const c of courses ?? []) {
      // Pages -> readings
      const pages = await fetchAll<any>(creds, `/api/v1/courses/${c.canvas_course_id}/pages?published=true`);
      for (const p of pages) {
        try {
          const res = await fetch(`${creds.base_url}/api/v1/courses/${c.canvas_course_id}/pages/${encodeURIComponent(p.url)}`, {
            headers: { Authorization: `Bearer ${creds.api_token}` },
          });
          if (!res.ok) { stats.skipped++; continue; }
          const full = await res.json();
          const { error } = await admin.from("library_items").upsert({
            teacher_id: teacherId,
            kind: "reading",
            title: String(full.title ?? p.title ?? "Untitled page").slice(0, 200),
            body: htmlToMarkdownish(full.body ?? ""),
            source: "canvas",
            canvas_course_id: Number(c.canvas_course_id),
            canvas_item_id: Number(full.page_id ?? p.page_id),
            canvas_item_type: "page",
          }, { onConflict: "teacher_id,canvas_item_type,canvas_item_id" });
          if (error) { console.error("page upsert", error); stats.skipped++; } else stats.pages++;
        } catch (e) { console.warn("page import failed", (e as Error).message); stats.skipped++; }
      }

      // Files -> readings (teacher can re-file later)
      const files = await fetchAll<any>(creds, `/api/v1/courses/${c.canvas_course_id}/files?sort=updated_at&order=desc`);
      for (const f of files) {
        try {
          const mime = String(f["content-type"] ?? f.content_type ?? "");
          if (!ALLOWED_MIME.test(mime) || Number(f.size ?? 0) > MAX_FILE_BYTES || !f.url) { stats.skipped++; continue; }
          const { data: existing } = await admin.from("library_items").select("id, file_path")
            .eq("teacher_id", teacherId).eq("canvas_item_type", "file").eq("canvas_item_id", Number(f.id)).maybeSingle();
          if (existing?.file_path) continue; // already imported

          const dl = await fetch(f.url, { headers: { Authorization: `Bearer ${creds.api_token}` } });
          if (!dl.ok) { stats.skipped++; continue; }
          const bytes = new Uint8Array(await dl.arrayBuffer());
          const safeName = String(f.display_name ?? f.filename ?? `file-${f.id}`).replace(/[^\w.\-]+/g, "_").slice(0, 120);
          const path = `${teacherId}/canvas/${f.id}-${safeName}`;
          const { error: upErr } = await admin.storage.from("library-files").upload(path, bytes, { contentType: mime || "application/octet-stream", upsert: true });
          if (upErr) { console.error("upload", upErr); stats.skipped++; continue; }

          const { error } = await admin.from("library_items").upsert({
            teacher_id: teacherId,
            kind: "reading",
            title: String(f.display_name ?? f.filename ?? "Untitled file").replace(/\.[a-z0-9]+$/i, "").slice(0, 200),
            body: null,
            source: "canvas",
            file_path: path,
            file_mime: mime,
            file_name: String(f.display_name ?? f.filename ?? safeName),
            canvas_course_id: Number(c.canvas_course_id),
            canvas_item_id: Number(f.id),
            canvas_item_type: "file",
          }, { onConflict: "teacher_id,canvas_item_type,canvas_item_id" });
          if (error) { console.error("file upsert", error); stats.skipped++; } else stats.files++;
        } catch (e) { console.warn("file import failed", (e as Error).message); stats.skipped++; }
      }
    }

    return json({ success: true, stats });
  } catch (e) {
    console.error("canvas-import-materials error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
