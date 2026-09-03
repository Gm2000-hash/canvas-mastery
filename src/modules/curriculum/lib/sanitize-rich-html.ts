import DOMPurify from "dompurify";
import { getCustomEmbedHosts } from "./embed-allowlist";

/**
 * Hosts whose iframe embeds are allowed in rendered reading/lesson content.
 * Matched against the iframe `src` hostname (suffix match).
 * Users can add additional hosts at runtime via Settings → Embed Allowlist
 * (see `embed-allowlist.ts`).
 */
export const EMBED_ALLOWED_HOSTS = [
  // H5P
  "h5p.org",
  "h5p.com",
  "lumi.education",
  "app.lumi.education",
  // Video
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "player.vimeo.com",
  "vimeo.com",
  "loom.com",
  "www.loom.com",
  "edpuzzle.com",
  "www.edpuzzle.com",
  // Interactive learning
  "wordwall.net",
  "padlet.com",
  "quizizz.com",
  "learningapps.org",
  "www.desmos.com",
  "desmos.com",
  "phet.colorado.edu",
  "geogebra.org",
  "www.geogebra.org",
  // Productivity / docs
  "docs.google.com",
  "drive.google.com",
  "forms.gle",
  "calendar.google.com",
  // Code / design
  "codepen.io",
  "codesandbox.io",
  "figma.com",
  "www.figma.com",
  // Widgets
  "clocklink.com",
  "www.clocklink.com",
  "timeanddate.com",
  "www.timeanddate.com",
  "logwork.com",
  "www.logwork.com",
];

export function getAllAllowedEmbedHosts(): string[] {
  return [...EMBED_ALLOWED_HOSTS, ...getCustomEmbedHosts()];
}

export function isAllowedEmbedUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    const hosts = getAllAllowedEmbedHosts();
    return hosts.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

const IFRAME_ATTRS = [
  "allow",
  "allowtransparency",
  "allowfullscreen",
  "frameborder",
  "scrolling",
  "referrerpolicy",
  "sandbox",
  "loading",
  "title",
  "width",
  "height",
  "src",
  "name",
  "style",
];

const SCRIPT_ATTRS = ["src", "async", "defer", "type", "charset", "crossorigin", "integrity"];

interface SanitizeOptions {
  /** Additional tags to allow (merged with built-in iframe support). */
  extraTags?: string[];
  /** Additional attributes to allow (merged with iframe attributes). */
  extraAttrs?: string[];
}

/**
 * Sanitize rich HTML coming out of the TipTap editor for display.
 * Allows iframes ONLY from the embed allowlist above.
 * Any other iframe (or one with a non-http(s) src) is stripped.
 */
export function sanitizeRichHtml(html: string, options: SanitizeOptions = {}): string {
  if (!html) return "";

  const hook = (node: Element) => {
    if (node.tagName?.toLowerCase() !== "iframe") return;
    const src = node.getAttribute("src") || "";
    if (!isAllowedEmbedUrl(src)) {
      node.parentNode?.removeChild(node);
    }
  };

  DOMPurify.addHook("uponSanitizeElement", hook as any);
  try {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ["iframe", ...(options.extraTags ?? [])],
      ADD_ATTR: [...IFRAME_ATTRS, ...(options.extraAttrs ?? [])],
      ALLOW_UNKNOWN_PROTOCOLS: false,
    });
  } finally {
    DOMPurify.removeHook("uponSanitizeElement");
  }
}

/**
 * Sanitizes third-party widget snippets for sandboxed iframe rendering.
 * External scripts are allowed only when their `src` is on the embed allowlist.
 */
export function sanitizeEmbedCodeHtml(html: string): string {
  if (!html) return "";

  const hook = (node: Element) => {
    const tag = node.tagName?.toLowerCase();
    if (tag === "iframe") {
      const src = node.getAttribute("src") || "";
      if (!isAllowedEmbedUrl(src)) node.parentNode?.removeChild(node);
      return;
    }
    if (tag === "script") {
      const src = node.getAttribute("src") || "";
      if (!src || !isAllowedEmbedUrl(src)) node.parentNode?.removeChild(node);
    }
  };

  DOMPurify.addHook("uponSanitizeElement", hook as any);
  try {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ["iframe", "script"],
      ADD_ATTR: [...IFRAME_ATTRS, ...SCRIPT_ATTRS],
      ALLOW_UNKNOWN_PROTOCOLS: false,
    });
  } finally {
    DOMPurify.removeHook("uponSanitizeElement");
  }
}

/**
 * For export targets (DOCX/PDF) that can't render iframes, replace every
 * embed block with a labeled hyperlink so readers of the printed copy still
 * get the URL.
 */
export function flattenEmbedsForExport(html: string): string {
  if (!html) return "";
  return html.replace(
    /<div[^>]*\bdata-embed\b[^>]*>[\s\S]*?<\/div>|<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi,
    (match) => {
      const srcMatch = match.match(/\bsrc=["']([^"']+)["']/i);
      const src = srcMatch?.[1];
      if (!src) return "";
      const safe = src.replace(/"/g, "&quot;");
      return `<p style="margin:1rem 0;padding:0.75rem 1rem;border:1px solid #d4d4d8;border-radius:8px;background:#fafafa;"><strong>🔗 Interactive content:</strong> <a href="${safe}">${safe}</a></p>`;
    },
  );
}
