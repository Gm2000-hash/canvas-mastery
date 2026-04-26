# Question Bank + Per-Question Scores

You already have most of the pieces — they just aren’t connected end-to-end and there’s no place to actually browse questions by standard. Here’s what’s in place vs. missing:

**Already working**
- Canvas sync imports courses, students, assignments, **and quiz questions** (3,531 questions in DB right now).
- Per-question AI tagging exists (`tag-question-standards` edge function) and is wired into the Tag Review page.
- Assignment-level standard tagging + mastery rollup work.

**The real gaps**
1. **No per-question student scores.** `question_responses` is empty (0 rows). Canvas sync pulls assignment-level submissions but never pulls quiz answers per question, so we can’t say “Maya got Q3 wrong, which was tagged to PS-MS-1-1.”
2. **No Question Bank UI.** Questions live in the DB but there’s no page to browse them, search them, or see them grouped by standard / substandard.
3. **Mastery is assignment-grain only.** Even when questions are tagged, mastery still rolls up from the whole assignment’s percentage, which dilutes the signal.

This plan closes all three.

---

## What you’ll see when it’s done

1. A new **Question Bank** page in the sidebar (between *Standards* and *Mastery*).
2. After a Canvas sync, every quiz also pulls per-student per-question scores.
3. Each quiz in Tag Review gets a one-click **“Import question scores”** action.
4. Mastery automatically uses the most precise signal available — per-question if the question is tagged, otherwise the assignment percentage.

---

## Question Bank page (new)

Layout — three-pane, like a standards browser:

```text
┌─ Filters ────────────────────────────────────────────────┐
│ Course ▾  Discipline ▾  Framework ▾  Subject ▾  Grade ▾  │
└──────────────────────────────────────────────────────────┘
┌─ Standards tree ─────────┬─ Questions in selected node ──┐
│ ▸ PS-MS-1   (12 q, 78%)  │ Q   Question text     %   ▸   │
│   ▾ PS-MS-1-1  (5 q, 71%)│ #4  "Which of the…"  62%  ▸   │
│     • PS-MS-1-1.a (2 q)  │ #7  "A student set…" 80%  ▸   │
│   ▸ PS-MS-1-2  (7 q, 84%)│ ...                           │
│ ▸ LS-MS-2   (9 q, 66%)   │                               │
└──────────────────────────┴───────────────────────────────┘
                            ┌─ Question detail (drawer) ───┐
                            │ Stem, points, source quiz,   │
                            │ confirmed standards (chips), │
                            │ class avg %, # responses,    │
                            │ "Re-tag with AI" button      │
                            └──────────────────────────────┘
```

Behavior:
- **Standards tree** uses the existing `parent_code` derivation already used in the class matrix (`PS-MS-1-1` → parent `PS-MS-1`). Counts show how many tagged questions each node holds and the class-average % correct on those questions (only when responses exist).
- **Question list** shows the questions tagged to the selected standard (or any descendant). Sortable by position, % correct, # responses, points possible. Free-text search across stems.
- **Detail drawer** shows the full stem, source assignment + course, all confirmed standards, per-student response sparkline (when scores exist), and a “Re-run AI tagging” button that calls `tag-question-standards` for just that quiz.
- **Empty states** are honest: “No tagged questions yet — go to Tag Review and run AI tagging” / “No scores imported yet — click Import question scores on the quiz.”

Built entirely client-side with existing tables + one new RPC `analytics_question_bank(_course_id, _subject, _framework)` for fast tree + counts.

---

## Importing per-question scores

Two pieces:

1. **New edge function `canvas-sync-question-scores`** — given a `course_id` (or list of quiz `assignment_id`s), it:
   - Looks up each quiz’s `canvas_quiz_id`.
   - Calls Canvas Quiz Submissions API (`/api/v1/courses/:cid/quizzes/:qid/submissions?include[]=submission&include[]=quiz_submission_questions`) and the per-attempt question answers endpoint (`/api/v1/quiz_submissions/:qsid/questions`).
   - Upserts into `question_responses` keyed by `(question_id, student_id)`, capturing `points`, `points_possible`, and a derived `correct` boolean (`points >= points_possible * 0.999`, with null-safe handling).
   - Falls back gracefully for New Quizzes (which don’t expose this API) — surfaces a per-quiz “unsupported” warning instead of failing the whole run.
2. **Trigger points**:
   - Auto-runs at the end of the existing `canvas-sync` for any course whose quizzes have synced questions (non-fatal — failures logged, don’t break the main sync).
   - Manual “Import question scores” button on each quiz card in Tag Review (next to “AI tag by question”), so teachers can re-pull on demand.

A unique index on `question_responses (question_id, student_id)` is added to make upserts safe.

---

## Smarter mastery (small but high-value)

Update `recompute-mastery` to prefer per-question signal when available:

- For each (student, standard):
  - If there are any `question_responses` for questions tagged (confirmed) to that standard → mastery = average `points / points_possible` over the most recent N responses (existing `attempt_window` setting).
  - Otherwise → fall back to today’s assignment-percentage rollup.
- `attempts` becomes the count of question responses (or submissions, in fallback).

This is a drop-in change in one function; no schema migration needed beyond the index above.

---

## Technical details

**Schema**
- Add unique index: `create unique index if not exists question_responses_question_student_uq on public.question_responses (question_id, student_id);`
- Add new RPC `analytics_question_bank(_course_id uuid, _subject text default null, _framework text default null)` returning rows of `(standard_id, code, parent_code, description, framework, subject, grade, tagged_question_count, response_count, avg_pct_correct)` — used to render the standards tree with counts in one round trip.
- No new tables. `question_standards`, `quiz_questions`, `question_responses` already exist with correct RLS.

**Edge functions**
- New: `supabase/functions/canvas-sync-question-scores/index.ts` (`verify_jwt = true`, added to `config.toml`).
  - Uses service role for upserts, scoped to teacher.
  - Pagination via existing `parseLinkHeader` / `canvasFetchAll` pattern copied from `canvas-sync`.
  - Per-quiz timeout + try/catch so one bad quiz doesn’t kill the run.
- Modified: `canvas-sync/index.ts` — at the end of each course loop, fire-and-await a call to the new helper (inline import, not HTTP), wrapped in try/catch.
- Modified: `recompute-mastery/index.ts` — branch on “has question responses for any tagged question” per (student, standard).

**Frontend**
- New: `src/pages/app/QuestionBank.tsx` (route `/app/question-bank`, sidebar entry between Standards and Mastery, icon `Library` from lucide).
- New: `src/components/StandardsTree.tsx` — recursive collapsible tree using parent_code derivation; reused later if needed.
- Modified: `src/App.tsx` (add route), `src/layouts/AppLayout.tsx` (add nav entry).
- Modified: `src/pages/app/Review.tsx` — add an “Import question scores” button on each quiz card; show a small badge `N responses` when present.

**Canvas API notes**
- Classic Quizzes only. Quiz Submissions endpoint returns one record per student attempt; we use the latest attempt per student.
- Per-question scoring comes from `quiz_submission_questions` payload (`points`, `correct`).
- New Quizzes (LTI) require a different OAuth-scoped API and is out of scope — we surface a clear per-quiz “New Quizzes not supported yet” warning.

**Out of scope (explicitly)**
- Editing question text or building new questions inside the app.
- Item-analysis stats beyond avg % correct (distractor analysis, point-biserial, etc.) — easy follow-up once responses are flowing.
- New Quizzes (LTI) ingestion.
