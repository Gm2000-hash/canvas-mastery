// Shared plumbing for the Curriculum Suite edge functions.
// - CORS + JSON helpers
// - JWT validation via the user's Supabase client
// - A single `aiJson()` helper that asks the configured provider (OpenRouter,
//   Lovable AI fallback) for a JSON object and parses it defensively.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  aiProviderErrorMessage,
  fetchChatCompletion,
  getAiProviderConfig,
  isAiProviderHardError,
} from "./openrouter.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

/** Error carrying an HTTP status so handlers can `throw` and let `serve()` map it. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AuthedContext {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  userId: string;
  email: string | null;
}

export async function requireUser(req: Request): Promise<AuthedContext> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new HttpError(401, "Unauthorized");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Unauthorized");
  const admin = createClient(SUPABASE_URL, SERVICE);
  return { supabase, admin, userId: data.user.id, email: data.user.email ?? null };
}

/** Wrap a handler with CORS, auth and uniform error mapping. */
export function serve(handler: (req: Request, ctx: AuthedContext) => Promise<Response>, opts: { auth?: boolean } = {}) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    try {
      const ctx = opts.auth === false
        ? ({} as AuthedContext)
        : await requireUser(req);
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error("Unhandled error:", e);
      return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
    }
  });
}

export async function readBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Pull the first balanced JSON object/array out of arbitrary model text. */
export function extractJson(text: string): unknown {
  let t = text.trim();
  // Strip ```json fences
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch { /* fall through */ }
  const starts = [t.indexOf("{"), t.indexOf("[")].filter((i) => i >= 0);
  if (!starts.length) throw new Error("Model returned no JSON");
  const start = Math.min(...starts);
  const open = t[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) {
        const slice = t.slice(start, i + 1);
        return JSON.parse(slice);
      }
    }
  }
  // Truncated output: try to salvage by closing open structures.
  let repaired = t.slice(start).replace(/,\s*$/, "");
  const stack: string[] = [];
  inStr = false;
  esc = false;
  for (const c of repaired) {
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  if (inStr) repaired += '"';
  repaired += stack.reverse().join("");
  return JSON.parse(repaired);
}

export interface AiCallOptions {
  system: string;
  user: string;
  /** Extra chat messages (e.g. multi-turn brainstorm) appended after the system prompt; `user` is ignored if provided. */
  messages?: Array<{ role: "user" | "assistant" | "system"; content: string | unknown[] }>;
  temperature?: number;
  /** Caller must justify raising above the shared default; long content generators do. */
  maxTokens?: number;
  /** Request JSON mode from the provider. */
  json?: boolean;
}

/** Call the chat model and return raw text. Throws HttpError with a user-facing message on provider errors. */
export async function aiText(opts: AiCallOptions): Promise<string> {
  const config = getAiProviderConfig();
  const messages = opts.messages
    ? [{ role: "system", content: opts.system }, ...opts.messages]
    : [{ role: "system", content: opts.system }, { role: "user", content: opts.user }];
  const body: Record<string, unknown> = {
    model: "google/gemini-3-flash-preview",
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 4096,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  let res = await fetchChatCompletion(body);
  // OpenRouter reserves credits for the full max_tokens up front; on a low
  // balance a large request 402s even though a smaller one would succeed.
  if (res.status === 402 && (body.max_tokens as number) > 4096) {
    console.warn("402 with max_tokens", body.max_tokens, "- retrying at 4096");
    body.max_tokens = 4096;
    res = await fetchChatCompletion(body);
  }
  // One bounded retry for transient upstream failures.
  if (res.status >= 500 || res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after")) || 2;
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 8) * 1000));
    res = await fetchChatCompletion(body);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("AI provider error", res.status, txt.slice(0, 500));
    if (isAiProviderHardError(res.status)) {
      throw new HttpError(res.status, aiProviderErrorMessage(res.status, config.provider));
    }
    throw new HttpError(502, `AI provider error (${res.status}).`);
  }
  const data = await res.json();
  const finish = data?.choices?.[0]?.finish_reason;
  if (finish === "length") console.warn("AI output truncated at max_tokens", body.max_tokens, JSON.stringify(data?.usage ?? {}));
  const content = data?.choices?.[0]?.message?.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
    ? content.map((p: { text?: string }) => p.text ?? "").join("")
    : "";
  if (!text.trim()) throw new HttpError(502, "AI returned an empty response.");
  return text;
}

/** Call the model and parse a JSON object out of the reply. */
export async function aiJson<T = Record<string, unknown>>(opts: AiCallOptions): Promise<T> {
  const text = await aiText({ ...opts, json: opts.json ?? true });
  try {
    return extractJson(text) as T;
  } catch {
    /* fall through to lenient repair */
  }
  try {
    const { jsonrepair } = await import("https://esm.sh/jsonrepair@3.8.0");
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const start = text.search(/[{[]/);
    return JSON.parse(jsonrepair((fence ? fence[1] : text.slice(Math.max(start, 0))).trim())) as T;
  } catch (e) {
    console.error("JSON parse failed:", (e as Error).message, "len", text.length, "head", text.slice(0, 200), "tail", text.slice(-300));
    throw new HttpError(502, "AI returned malformed output. Please try again.");
  }
}

/** Fetch standards rows the user can see, to feed into prompts. */
export async function loadStandards(ctx: AuthedContext, ids: string[] | undefined) {
  if (!ids?.length) return [];
  const { data } = await ctx.supabase
    .from("standards")
    .select("id, code, description, subject, grade, framework")
    .in("id", ids.slice(0, 20));
  return data ?? [];
}

export function standardsBlock(stds: Array<{ code: string; description: string }>, fallback?: string[]): string {
  if (stds.length) return stds.map((s) => `- ${s.code}: ${s.description}`).join("\n");
  if (fallback?.length) return fallback.map((c) => `- ${c}`).join("\n");
  return "";
}

/** Plain-text/markdown-ish answer without JSON parsing (for streaming-free chat). */
export const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : v == null ? d : String(v));
export const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || d);
export const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Generate a single image. Returns a data URL (PNG/JPEG). */
export async function aiImage(prompt: string): Promise<string> {
  const config = getAiProviderConfig();
  const model = config.provider === "openrouter"
    ? "google/gemini-2.5-flash-image"
    : "google/gemini-2.5-flash-image-preview";
  const res = await fetch(config.baseUrl, {
    method: "POST",
    headers: config.headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Image provider error", res.status, txt.slice(0, 400));
    if (isAiProviderHardError(res.status)) {
      throw new HttpError(res.status, aiProviderErrorMessage(res.status, config.provider));
    }
    throw new HttpError(502, `Image generation failed (${res.status}).`);
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  const url: string | undefined = msg?.images?.[0]?.image_url?.url ??
    (Array.isArray(msg?.content)
      ? msg.content.find((p: { type?: string }) => p.type === "image_url")?.image_url?.url
      : undefined);
  if (!url) throw new HttpError(502, "The model did not return an image.");
  return url;
}

/** Upload a data-URL image to a private bucket and return a long-lived signed URL. */
export async function storeImage(ctx: AuthedContext, bucket: string, path: string, dataUrl: string): Promise<string> {
  const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.*)$/s);
  if (!m) throw new HttpError(502, "Unexpected image format.");
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const { error } = await ctx.admin.storage.from(bucket).upload(path, bytes, { contentType: m[1], upsert: true });
  if (error) throw new HttpError(500, `Failed to store image: ${error.message}`);
  const { data, error: sErr } = await ctx.admin.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (sErr || !data) throw new HttpError(500, "Failed to sign image URL.");
  return data.signedUrl;
}

/** Load a source document (lesson, lesson plan or library book) as prompt context. */
export async function loadSourceContext(
  ctx: AuthedContext,
  sourceType: string,
  sourceId?: string,
  standardCode?: string,
  standardDescription?: string,
): Promise<string> {
  if (sourceType === "standard") {
    return `Standard ${standardCode ?? ""}: ${standardDescription ?? ""}`;
  }
  if (!sourceId) throw new HttpError(400, "sourceId is required");
  if (sourceType === "curriculum_lesson") {
    const { data } = await ctx.supabase.from("curriculum_lessons").select("*").eq("id", sourceId).maybeSingle();
    if (!data) throw new HttpError(404, "Lesson not found");
    const terms = arr<{ term?: string; definition?: string } | string>(data.key_terms)
      .map((t) => typeof t === "string" ? t : `${t.term}: ${t.definition ?? ""}`).join("; ");
    return [
      `Lesson: ${data.title}`,
      `Objectives: ${arr(data.objectives).join(" | ")}`,
      `Key terms: ${terms}`,
      `Intro: ${arr(data.intro).join("\n")}`,
      `Explanation: ${arr(data.explanation).join("\n")}`,
      data.reading_title ? `Reading "${data.reading_title}": ${arr(data.reading_paragraphs).join("\n")}` : "",
    ].filter(Boolean).join("\n\n").slice(0, 12000);
  }
  if (sourceType === "lesson_plan") {
    const { data } = await ctx.supabase.from("lesson_plans").select("*").eq("id", sourceId).maybeSingle();
    if (!data) throw new HttpError(404, "Lesson plan not found");
    return [
      `Lesson plan: ${data.title}`,
      `Objectives: ${data.objectives}`,
      `Activities: ${JSON.stringify(data.activities).slice(0, 3000)}`,
      `Vocabulary: ${JSON.stringify(data.vocabulary).slice(0, 1500)}`,
      `Assessment: ${data.assessment}`,
    ].join("\n\n").slice(0, 12000);
  }
  if (sourceType === "reading_library") {
    const { data } = await ctx.supabase.from("library_books").select("title, source_discipline").eq("id", sourceId).maybeSingle();
    if (!data) throw new HttpError(404, "Book not found");
    return `Library book titled "${data.title}"${data.source_discipline ? ` (${data.source_discipline})` : ""}. Base the activity on the general content a teacher would expect from this title.`;
  }
  throw new HttpError(400, `Unsupported sourceType: ${sourceType}`);
}

export function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}
