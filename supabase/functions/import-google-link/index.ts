// Curriculum suite: import a shared Google Doc/Sheet/Slides link (must be viewable by "anyone with the link").
// Input: { url }  Output: { lessons, source }
import { z } from "https://esm.sh/zod@3.23.8";
import { json, readBody, serve, stripHtml, HttpError } from "../_shared/curriculum-ai.ts";
import { extractLessonsFromText } from "../_shared/extractLessons.ts";

const Body = z.object({ url: z.string().url().max(2000) });

serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, "Enter a valid Google Docs, Sheets or Slides link.");
  const m = parsed.data.url.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) throw new HttpError(400, "That is not a Google Docs, Sheets or Slides link.");
  const [, kind, id] = m;
  const exportUrl = kind === "document"
    ? `https://docs.google.com/document/d/${id}/export?format=txt`
    : kind === "spreadsheets"
    ? `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`
    : `https://docs.google.com/presentation/d/${id}/export/txt`;

  const res = await fetch(exportUrl, { redirect: "follow" });
  if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) {
    throw new HttpError(403, "Could not read that document. Share it as 'Anyone with the link can view' and try again.");
  }
  const raw = await res.text();
  const text = stripHtml(raw);
  let source = "Google Document";
  try {
    const page = await fetch(`https://docs.google.com/${kind}/d/${id}/preview`).then((r) => r.text());
    const t = page.match(/<title>([^<]+)<\/title>/i)?.[1];
    if (t) source = t.replace(/ - Google (Docs|Sheets|Slides)$/i, "").trim();
  } catch { /* title is cosmetic */ }

  const lessons = await extractLessonsFromText(text, source);
  if (!lessons.length) return json({ lessons: [], source, error: "No lesson content could be extracted from this document." }, 422);
  return json({ lessons, source });
});
