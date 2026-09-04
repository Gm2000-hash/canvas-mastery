// Shared Google OAuth helpers for the per-teacher Google connection.
//
// Each teacher authorises our Google OAuth client once; we keep only the
// refresh token (AES-GCM encrypted at rest) and mint short-lived access tokens
// on every server call. Nothing Google-related ever reaches the browser.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/presentations.readonly",
  "https://www.googleapis.com/auth/forms.body",
];

export class GoogleError extends Error {
  constructor(message: string, readonly code: string, readonly status = 400) { super(message); }
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new GoogleError(`${name} is not configured`, "MISSING_CONFIG", 500);
  return v;
}

export function redirectUri(): string {
  return `${env("SUPABASE_URL")}/functions/v1/google-oauth-callback`;
}

// ---- crypto -------------------------------------------------------------
import { b64, unb64, encryptSecret, decryptSecret } from "./crypto.ts";
export { encryptSecret, decryptSecret };
const enc = new TextEncoder();
const dec = new TextDecoder();

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(env("GOOGLE_TOKEN_ENC_KEY")), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Signed OAuth `state`: { uid, rt (return url), exp } */
export async function signState(payload: Record<string, unknown>): Promise<string> {
  const body = b64(enc.encode(JSON.stringify({ ...payload, exp: Date.now() + 15 * 60_000 })));
  const sig = b64(new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body))));
  return `${body}.${sig}`;
}
export async function verifyState(state: string): Promise<Record<string, any>> {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new GoogleError("Bad state", "BAD_STATE");
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), unb64(sig), enc.encode(body));
  if (!ok) throw new GoogleError("Bad state signature", "BAD_STATE");
  const data = JSON.parse(dec.decode(unb64(body)));
  if (!data.exp || Date.now() > data.exp) throw new GoogleError("Sign-in link expired, try again", "BAD_STATE");
  return data;
}

// ---- auth / clients -----------------------------------------------------
export async function requireUser(req: Request): Promise<{ teacherId: string; admin: SupabaseClient; user: SupabaseClient }> {
  const SUPABASE_URL = env("SUPABASE_URL");
  const user = createClient(SUPABASE_URL, env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data, error } = await user.auth.getUser();
  if (error || !data.user) throw new GoogleError("Unauthorized", "UNAUTHORIZED", 401);
  return { teacherId: data.user.id, admin: createClient(SUPABASE_URL, env("SUPABASE_SERVICE_ROLE_KEY")), user };
}

export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
}

// ---- tokens -------------------------------------------------------------
export async function exchangeCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: env("GOOGLE_OAUTH_CLIENT_ID"), client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"),
      redirect_uri: redirectUri(), grant_type: "authorization_code",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleError(`Google token exchange failed: ${body.error_description ?? body.error ?? res.status}`, "TOKEN_EXCHANGE");
  return body as { access_token: string; refresh_token?: string; scope?: string; id_token?: string; expires_in: number };
}

const tokenCache = new Map<string, { token: string; exp: number }>();

/** Mint a fresh access token for a teacher. Throws GOOGLE_NOT_CONNECTED / GOOGLE_RECONNECT. */
export async function getAccessToken(admin: SupabaseClient, teacherId: string): Promise<string> {
  const cached = tokenCache.get(teacherId);
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const { data, error } = await admin.from("google_credentials").select("refresh_token_ciphertext").eq("teacher_id", teacherId).maybeSingle();
  if (error) throw error;
  if (!data) throw new GoogleError("Google isn't connected. Connect Google in Settings first.", "GOOGLE_NOT_CONNECTED");
  const refresh = await decryptSecret(data.refresh_token_ciphertext);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refresh, client_id: env("GOOGLE_OAUTH_CLIENT_ID"), client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"), grant_type: "refresh_token",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (body.error === "invalid_grant") {
      await admin.from("google_credentials").delete().eq("teacher_id", teacherId);
      throw new GoogleError("Your Google connection expired or was revoked. Reconnect Google in Settings.", "GOOGLE_RECONNECT", 401);
    }
    throw new GoogleError(`Google refresh failed: ${body.error_description ?? body.error ?? res.status}`, "TOKEN_REFRESH", 502);
  }
  tokenCache.set(teacherId, { token: body.access_token, exp: Date.now() + (Number(body.expires_in ?? 3600) - 30) * 1000 });
  return body.access_token;
}

export async function revokeToken(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => {});
}

// ---- Google API fetch ---------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** JSON fetch against Google APIs with light retry on 429/5xx. Throws GoogleError with the API's message. */
export async function gapi<T = any>(token: string, url: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await res.body?.cancel().catch(() => {});
    await sleep(800 * 2 ** attempt);
    return gapi<T>(token, url, init, attempt + 1);
  }
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try { msg = JSON.parse(text)?.error?.message ?? msg; } catch { /* raw */ }
    const code = res.status === 401 ? "GOOGLE_RECONNECT" : res.status === 403 ? "GOOGLE_FORBIDDEN" : "GOOGLE_API";
    throw new GoogleError(`Google ${res.status}: ${msg}`, code, res.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Follow `nextPageToken` pagination for a list endpoint. */
export async function gapiList<T = any>(token: string, url: string, key: string, max = 20): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < max; i++) {
    const u = new URL(url);
    u.searchParams.set("pageSize", "100");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const page = await gapi<any>(token, u.toString());
    out.push(...((page[key] ?? []) as T[]));
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export function errorResponse(e: unknown): Response {
  if (e instanceof GoogleError) return json({ error: e.message, code: e.code }, e.status >= 400 && e.status < 600 ? e.status : 400);
  console.error(e);
  return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
}
