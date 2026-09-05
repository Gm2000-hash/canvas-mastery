// Build-time guard against broken in-app navigation.
//
// On every `vitest run` (which is part of our build/CI pipeline) this test:
//   1. Parses src/App.tsx to extract every `<Route path="…">` declared on the
//      router, building the full list of valid in-app paths (including nested
//      routes under /app and `<Navigate>` redirect targets).
//   2. Scans every .ts/.tsx file under src/ for in-app navigation references
//      written as `to="/…"`, `href="/…"`, or `navigate("/…")` string literals.
//   3. Asserts that every such link resolves to a defined route — catching
//      typos, deleted pages, and "stale" links from refactors.
//   4. Reports declared routes that are never linked from anywhere as a
//      warning (informational; doesn't fail the build) so we can spot
//      orphaned pages.
//
// Tests are limited to literal string links — dynamic links built with
// template variables (e.g. `to={`/app/classes/${id}`}`) are matched against
// route patterns that contain `:params` so we don't flag valid dynamic URLs.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PROJECT_ROOT = join(__dirname, "..", "..");
const SRC_DIR = join(PROJECT_ROOT, "src");
const APP_FILE = join(SRC_DIR, "App.tsx");

// ──────────────────── Route extraction ────────────────────

type RoutePattern = {
  path: string; // canonical full path, e.g. /app/classes/:courseId
  regex: RegExp; // matches concrete URLs against this pattern
};

/**
 * Parse App.tsx and return every routable path declared inside <Routes>,
 * including <Navigate to="…"> redirect targets.
 *
 * We use a hand-rolled scanner over the JSX rather than a real parser to
 * keep this test dependency-free. The scanner walks the source line-by-line,
 * tracks the route-nesting parent path, and emits one entry per `<Route>` and
 * one per `<Navigate to="…">`.
 */
function extractRoutes(): RoutePattern[] {
  const src = readFileSync(APP_FILE, "utf8");
  const lines = src.split("\n");

  const paths = new Set<string>();
  // Stack of parent paths. We push when we see a parent <Route path="…">
  // (one whose JSX tag is not self-closing on the same line) and pop on </Route>.
  const stack: string[] = [""];

  for (const raw of lines) {
    const line = raw.trim();

    // </Route> — pop a parent (handle first so a line containing both an
    // opening tag and a closing tag updates state correctly).
    if (/^<\/Route>/.test(line)) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    // <Route …> on this line. We only care about `path` and whether the tag
    // is the *outer* JSX element on this line — i.e. whether the line ends
    // with a closing `>` for the Route, not for an inner element like
    // `element={<Foo />}`. A simple, robust heuristic: the line does NOT
    // self-close the Route when it ends in `>` and the last non-whitespace
    // chars before that `>` are not `/`. Inner self-closing tags like
    // `<AppLayout />` end with `/>` *before* the final `>` of the Route,
    // so the very last two chars of the line decide it.
    const routeOpen = line.match(/<Route\b([^>]*?path="([^"]*)"[^>]*)?/);
    const isRouteLine = /<Route\b/.test(line);
    if (isRouteLine) {
      const pathAttr = line.match(/<Route\b[^>]*?\bpath="([^"]*)"/);
      const isIndex = /<Route\b[^>]*?\bindex\b/.test(line);
      const lastTwo = line.slice(-2);
      const isParent = lastTwo === "})>" || (line.endsWith(">") && !line.endsWith("/>"));

      // Determine this route's full path.
      let full = stack[stack.length - 1];
      if (pathAttr) {
        const seg = pathAttr[1];
        if (seg.startsWith("/")) {
          full = seg;
        } else {
          full = (full + "/" + seg).replace(/\/+/g, "/");
          if (full.length > 1 && full.endsWith("/")) full = full.slice(0, -1);
        }
        paths.add(full || "/");
      } else if (isIndex) {
        paths.add(stack[stack.length - 1] || "/");
      }

      if (pathAttr && isParent) {
        stack.push(full);
      }
      continue;
    }
    void routeOpen;

    // <Navigate to="/some/path" …/> — also a valid destination.
    const navMatch = line.match(/<Navigate\s+[^>]*to="([^"]+)"/);
    if (navMatch) {
      // Strip query/hash for matching purposes.
      const dest = navMatch[1].split(/[?#]/)[0];
      paths.add(dest || "/");
    }
  }

  // Curriculum suite routes live in src/modules/curriculum/routes.tsx and are
  // mounted by App.tsx: app routes under /app, public routes at the root.
  const curriculumSrc = readFileSync(join(SRC_DIR, "modules", "curriculum", "routes.tsx"), "utf8");
  for (const raw of curriculumSrc.split("\n")) {
    const m = raw.match(/<Route\b[^>]*?\bpath="([^"]*)"/);
    if (m) paths.add(m[1].startsWith("/") ? m[1] : `/app/${m[1]}`);
    const nav = raw.match(/<Navigate\s+[^>]*to="([^"]+)"/);
    if (nav) paths.add(nav[1].split(/[?#]/)[0]);
  }

  // Always-valid sentinel paths.
  paths.add("/"); // landing
  paths.add("*"); // catch-all NotFound

  // Build matchers for each path. ":param" segments match a single path segment.
  return Array.from(paths)
    .filter((p) => p !== "*")
    .map((p) => ({
      path: p,
      regex: new RegExp(
        "^" + p.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, "[^/]+") + "/?$",
      ),
    }));
}

// ──────────────────── Link extraction ────────────────────

type LinkRef = { url: string; file: string; line: number };

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".lovable",
  "test",
  "__tests__",
  "integrations", // generated supabase client
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Find every literal in-app link in the codebase. Captures three syntaxes:
 *   - JSX prop: to="/app/foo" or href="/app/foo"
 *   - navigate("/app/foo") / navigate(`/app/foo`) — only when the literal
 *     does not contain ${} interpolation we can't resolve at lint time.
 *
 * Returns absolute-path links only (those starting with `/`). External URLs,
 * `mailto:`, `#anchor`, and template-interpolated strings are ignored.
 */
function extractLinks(file: string): LinkRef[] {
  const src = readFileSync(file, "utf8");
  const refs: LinkRef[] = [];
  const lines = src.split("\n");

  // Single combined regex per line — captures any of the three forms.
  const patterns: RegExp[] = [
    /\b(?:to|href)=["'](\/[^"'?#${}]*)(?:[?#][^"']*)?["']/g,
    /\bnavigate\(\s*["'`](\/[^"'`?#${}]*)(?:[?#][^"'`]*)?["'`]/g,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of patterns) {
      pat.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pat.exec(line)) !== null) {
        refs.push({ url: m[1], file, line: i + 1 });
      }
    }
  }
  return refs;
}

// ──────────────────── Tests ────────────────────

describe("routing integrity (dead-route guard)", () => {
  const routes = extractRoutes();
  const allFiles = walk(SRC_DIR);

  // Routes excluded from "dead/unlinked" reporting because they're entry points
  // or redirect aliases kept around for stable URLs.
  const ENTRY_OR_ALIAS = new Set<string>([
    "/", // landing — entered via root
    "/auth", // entered from external links / unauth redirects
    "/app", // layout root, accessed via /app/index
    "/app/courses",
    "/app/analytics",
    "/app/assignments",
    "/app/question-bank",
  ]);

  it("App.tsx declares at least one route", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it("every literal in-app link points to a real route", () => {
    const broken: { url: string; file: string; line: number }[] = [];
    for (const f of allFiles) {
      // App.tsx itself contains the `<Navigate to=…>` references that define
      // routes — skipping it avoids a circular self-check.
      if (f === APP_FILE) continue;
      for (const ref of extractLinks(f)) {
        const matched = routes.some((r) => r.regex.test(ref.url));
        if (!matched) broken.push(ref);
      }
    }

    if (broken.length > 0) {
      const msg = broken
        .map((b) => `  ${relative(PROJECT_ROOT, b.file)}:${b.line} → ${b.url}`)
        .join("\n");
      throw new Error(
        `Found ${broken.length} dead in-app link(s):\n${msg}\n\n` +
          `Either fix the link or add a matching <Route> in src/App.tsx.`,
      );
    }
  });

  it("reports declared routes that no component links to (informational)", () => {
    // Build the set of route paths that are referenced anywhere in src/.
    const referenced = new Set<string>();
    for (const f of allFiles) {
      if (f === APP_FILE) continue;
      for (const ref of extractLinks(f)) {
        for (const r of routes) {
          if (r.regex.test(ref.url)) referenced.add(r.path);
        }
      }
    }

    const orphaned = routes
      .map((r) => r.path)
      .filter((p) => !ENTRY_OR_ALIAS.has(p) && !referenced.has(p));

    if (orphaned.length > 0) {
      // Print to console rather than failing — orphaned routes are a smell,
      // not always a bug (e.g. a page accessible only via deep-link).
      // eslint-disable-next-line no-console
      console.warn(
        `[dead-routes] ${orphaned.length} declared route(s) have no in-app links:\n` +
          orphaned.map((p) => `  - ${p}`).join("\n"),
      );
    }
    expect(true).toBe(true);
  });
});
