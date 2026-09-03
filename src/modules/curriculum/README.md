# Curriculum Creative Suite (portable module)

A self-contained teaching-content suite: units and curriculum lessons, reading
passages, lesson plans and assignments, standards browsing/tagging, interactive
activities, a question bank and quiz builder, notes, ISAT-style exams, AI
generation, and DOCX/PDF/QTI/H5P/Google exports.

Everything lives under `src/modules/curriculum/`. Copy that one folder into any
project on the same stack (React + Vite + Tailwind + shadcn/ui + Supabase),
then wire the host boundary and run the database setup.

## Install

1. **Copy the folder** to `src/modules/curriculum/` in the target project.

2. **Install dependencies** (superset used by the suite):

   ```
   bun add @supabase/supabase-js @tanstack/react-query docx file-saver jszip \
     katex dompurify date-fns lucide-react sonner react-pdf pdfjs-dist \
     @tiptap/react @tiptap/starter-kit @tiptap/extension-link \
     @tiptap/extension-image @tiptap/extension-table \
     @tiptap/extension-table-row @tiptap/extension-table-cell \
     @tiptap/extension-table-header @tiptap/extension-text-align \
     @tiptap/extension-underline @tiptap/extension-placeholder
   ```

   The module also expects shadcn/ui primitives at `@/components/ui/*` and the
   `cn` helper at `@/lib/utils`. Those are the only imports it makes outside
   itself and outside `./config`.

3. **Run the database setup** — apply `db/setup.sql` as a single migration.
   It creates every table, index, trigger, RLS policy, Data API grant, and the
   `SECURITY DEFINER` functions behind the public share links
   (`get_shared_note`, `get_shared_book`, `get_published_books`,
   `get_public_exam`, `get_public_review`).

4. **Create storage buckets**: `avatars`, `book-covers`, `activity-media`,
   `readings`, `library-books`. Keep them private and read them through signed
   URLs.

5. **Deploy the AI/export backend functions** you want (see below).

## Host boundary — `config/`

Every dependency on the surrounding application is funnelled through one small
shim file in `src/modules/curriculum/config/`. Repoint these files and the
module works anywhere; nothing else needs editing.

| Shim | Must export | Notes |
| --- | --- | --- |
| `supabase.ts` | `supabase` client | RLS-scoped browser client |
| `database-types.ts` | generated `Database` types | |
| `auth.ts` | `useAuth()` returning `{ user, loading, ... }` | the module never owns sign-in |
| `router.ts` | `Link`, `useNavigate`, `useParams`, `useSearchParams` | React Router-shaped API; on TanStack Start this points at the shim in `src/lib/react-router-shim.tsx` |
| `toast.ts` | `useToast`, `toast` | |
| `page-title.ts` | `usePageTitle(title)` | |
| `profile.ts` | `useProfile()` | teacher profile/preferences |
| `chrome-*.ts` | app shell pieces (breadcrumbs, nav sheet, hero, page banner, weekly dashboard) | swap for your own layout components |

### Optional adapters

These shims are only needed when the host has the matching integration.
Replace them with inert stubs to drop the feature — nothing else changes:

- `canvas-config.ts`, `canvas-api.ts`, `canvas-assignment-html.ts`,
  `canvas-push-dialog.ts`, `canvas-push-isat-dialog.ts`,
  `canvas-push-activity-dialog.ts`, `lti-session.ts` — Canvas LMS / LTI.
- `google-connection.ts`, `appscript.ts` — Google Docs/Sheets/Slides export.
- `dashboard-layout.ts` — host dashboard customization.

A stub looks like:

```ts
export const useCanvasConfig = () => ({ configured: false } as const);
export function PushToCanvasDialog() { return null; }
```

## Usage

```tsx
import { LessonPlannerPage, useCurriculumLessons } from "@/modules/curriculum";

// mount as a route
<Route path="/lesson-planner" element={<LessonPlannerPage />} />
```

`index.ts` is the public surface: screens, hooks, building-block components,
and the exporters. Import from deeper paths only when you need something not
re-exported there.

## Backend functions

The suite calls these Supabase Edge Functions (skip any feature you don't
want; the UI degrades gracefully):

`generate-content`, `generate-curriculum-reading`, `generate-reading-insert`,
`generate-key-terms`, `generate-questions`, `generate-assignment`,
`generate-assignment-questions`, `generate-h5p-activity`, `generate-cover-art`,
`generate-escape-room`, `generate-isat-exam`, `generate-exam-review`,
`lesson-brainstorm`, `enhance-question`, `suggest-dok-blooms`,
`standards-tagger`, `ngss-tagger`, `list-standards`, plus the Google export
functions when Google is wired.

## Design tokens

Styling is token-based; the host stylesheet must define the shadcn variables
(`--background`, `--foreground`, `--primary`, `--muted`, `--border`,
`--card`, `--accent`, `--destructive`, `--radius`, plus the sidebar set) in
both light and dark scopes. The module never hardcodes colors.

## What is intentionally NOT included

Canvas Mastery Bridge, mastery analytics/imports, admin dashboard and audit
log, role management, PowerSchool export, and dashboard wallpaper/canvas
customization. Those stay in the host app and reach the module only through
the optional adapters above.
