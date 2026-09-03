/**
 * Runtime-managed embed allowlist.
 *
 * The built-in `EMBED_ALLOWED_HOSTS` list in `sanitize-rich-html.ts` covers
 * common providers (H5P, YouTube, Vimeo, Desmos, etc.). Users can extend it
 * with custom hosts via the Settings → Embed Allowlist screen. Custom hosts
 * are stored per-browser in localStorage.
 *
 * NOTE: Browser CSP (`frame-src` in index.html) also gates iframes. Most
 * common providers are already covered there; truly novel hosts may also
 * require a CSP update.
 */

const STORAGE_KEY = "embed_allowlist_custom_hosts_v1";
const EVENT = "embed-allowlist-changed";

function normalizeHost(input: string): string | null {
  if (!input) return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;
  // Strip protocol and path if user pasted a URL
  value = value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  // Strip port
  value = value.replace(/:\d+$/, "");
  // Basic host validation: letters/digits/dots/hyphens, must have a dot
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) return null;
  return value;
}

export function getCustomEmbedHosts(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((h): h is string => typeof h === "string");
  } catch {
    return [];
  }
}

export function setCustomEmbedHosts(hosts: string[]): void {
  const unique = Array.from(new Set(hosts.map((h) => h.toLowerCase()))).sort();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function addCustomEmbedHost(input: string): { ok: boolean; host?: string; error?: string } {
  const normalized = normalizeHost(input);
  if (!normalized) return { ok: false, error: "Enter a valid host like app.example.com" };
  const current = getCustomEmbedHosts();
  if (current.includes(normalized)) return { ok: false, host: normalized, error: "Host already in the list" };
  setCustomEmbedHosts([...current, normalized]);
  return { ok: true, host: normalized };
}

export function removeCustomEmbedHost(host: string): void {
  setCustomEmbedHosts(getCustomEmbedHosts().filter((h) => h !== host));
}

export function subscribeEmbedAllowlist(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
