// AES-GCM secret encryption shared by Google credentials and admin-managed app secrets.
// Key: APP_ENC_KEY when set, otherwise GOOGLE_TOKEN_ENC_KEY (existing deployments).

const enc = new TextEncoder();
const dec = new TextDecoder();

export function encKeyMaterial(): string {
  const v = Deno.env.get("APP_ENC_KEY") || Deno.env.get("GOOGLE_TOKEN_ENC_KEY");
  if (!v) throw new Error("APP_ENC_KEY / GOOGLE_TOKEN_ENC_KEY is not configured");
  return v;
}

async function aesKey(): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(encKeyMaterial()));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export const b64 = (u: Uint8Array) =>
  btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64 = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), enc.encode(plain)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64(out);
}

export async function decryptSecret(stored: string): Promise<string> {
  const buf = unb64(stored);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.subarray(0, 12) }, await aesKey(), buf.subarray(12));
  return dec.decode(pt);
}
