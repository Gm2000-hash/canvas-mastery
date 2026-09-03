# Bring the full Curriculum Suite into Canvas Mastery

## What I found

- The **AI curriculum generator** project ships its whole feature set as one portable folder (`src/modules/curriculum`, ~37k lines, 18 tables, 5 storage buckets) with a small "host boundary" of shim files. It was designed to be copied into another app on this stack, so the front end ports cleanly.
- Its **AI backend functions are not in that project** (or in Teacher Tool) — only the calls to them exist. About 17 functions (`generate-content`, `generate-curriculum-reading`, `generate-lesson-plans`, `generate-h5p-activity`, `generate-isat-exam`, `standards-tagger`, `ngss-tagger`, etc.) must be rebuilt here from the request/response contracts the UI expects. This is the largest piece of work and the main reliability risk, so it is phased and tested function by function.
- Two of its tables (`profiles`, `user_roles`) already exist here and will be reused, not recreated.

## Approach (reliability first)

One backend, one login, one AI helper. Everything runs inside this app's Lovable Cloud project on your existing OpenRouter setup — no cross-app calls, no second account.

Delivered in four phases, each usable on its own:

### Phase 1 — Foundation (module ported, browsing works)
- Copy `src/modules/curriculum` into this project; install its dependencies (TipTap editor, docx, jszip, katex, react-pdf, etc.).
- Wire the shim files to this app: auth (`useAuth`), profile (`ProfileContext`), toast, page title, React Router (this app already uses React Router, so no TanStack shim), and inert stubs for app-chrome, Google export, and LTI.
- Database migration adapted from the suite's `setup.sql`: create the 16 new tables (units, curriculum_lessons, lesson_plans, lesson_assignments, question_bank, custom_quizzes, h5p_activities, isat_exams, exam_review_materials, notes, note_links, library_books, standard_key_terms, and their standards link tables) with grants, owner-only RLS, and the share-link functions. Skip `profiles`/`user_roles`.
- Create the 5 private storage buckets (`avatars`, `book-covers`, `activity-media`, `readings`, `library-books`) with per-teacher folder policies.
- Add a **Curriculum** entry to the sidebar with sub-navigation: Units, Lesson Planner, Readings, Activities, Question Bank / Quiz Builder, Exams, Notes, Standards.

### Phase 2 — Core AI generation (most-used paths)
Rebuild on `_shared/openrouter.ts`, in this order, testing each end-to-end before the next:
`generate-content`, `generate-curriculum-reading`, `generate-reading-insert`, `generate-lesson-plans`, `generate-assignment`, `generate-assignment-questions`, `generate-key-terms`, `standards-tagger`, `ngss-tagger`, `suggest-dok-blooms`.

### Phase 3 — Advanced generators
`generate-h5p-activity`, `generate-escape-room`, `generate-isat-exam`, `generate-exam-review`, `enhance-question-manipulative`, `lesson-brainstorm`.

### Phase 4 — Integration with the rest of Canvas Mastery
- Wire the suite's Canvas adapters to this app's saved Canvas connection so "Push to Canvas" works for lesson plans, activities, and exams.
- Cross-link: content generated in the suite appears in the Library tiles (Readings, Activities, Lesson plans) via a lightweight view, and the suite's standards picker uses this app's `standards` table and your default subject/framework (NGSS for Science, Idaho otherwise).
- Deferred / optional: Google Docs import/export and image generation (`generate-cover-art`, `generate-question-image`) — these need a separate provider (Google connector, image-capable model). The UI hides these buttons until wired.

## Reliability safeguards built into every function
- Input validation (zod) with clear 400 errors; JWT verified in code; owner-scoped writes.
- Long generations (readings, full lesson plans, exams) stream from OpenRouter and are consumed server-side, so they cannot be cut off by the ~2-minute idle limit or double-billed by retries.
- Structured JSON output with a fallback parser; a failed parse degrades to an error message, never a crash.
- Error mapping follows the existing helper: 402/403 surface a clear "credits/key" message and stop; 429/5xx retry once with backoff, then stop.
- Per-function token caps sized for the content type (the current 4096 cap is too small for full readings/lesson plans; those functions will use a higher explicit cap). Your OpenRouter balance is low — the plan flags this because full lesson plans and exams are the most expensive calls.
- The suite's model selector is kept but limited to OpenRouter model IDs; default `google/gemini-3.7-flash`.

## Technical details
- New folder: `src/modules/curriculum/**` (copied), shims rewritten in `src/modules/curriculum/config/*`.
- Routes added under `/app/curriculum/*` in `src/App.tsx`; nav entry + sidebar-order handling in `src/layouts/AppLayout.tsx`.
- One migration for tables/RLS/grants/functions; buckets created with the storage tool; storage policies via migration.
- New edge functions under `supabase/functions/<name>/index.ts`, all importing `_shared/openrouter.ts`; a new `_shared/curriculumAi.ts` holds shared prompt scaffolding, streaming consumption, and JSON extraction.
- Existing tables untouched except reuse of `profiles`, `user_roles`, `standards`, `canvas_credentials`.
- Estimated scope: Phase 1 is one large session; Phases 2–3 are roughly one session per 4–5 functions; Phase 4 one session.

## Open items I will confirm as I go (not blockers)
- Exact request/response shape for each function is inferred from the UI code; where ambiguous, I will match the UI rather than guess new behavior.
- Whether to merge the suite's `question_bank` with the Canvas-imported `quiz_questions` — kept separate in this plan to avoid breaking mastery analytics.
