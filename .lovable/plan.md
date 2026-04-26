## Goal

Enable teachers to import per-student, per-question scores for their quizzes and have those scores attribute correctly to the standard / substandard each question is tagged with — so the Question Bank, Mastery, and Analytics views all reflect real student performance at the standard level.

The Canvas → `question_responses` pipeline already exists. The missing pieces are: (a) easier ways to trigger the import (whole course, selected quizzes, single quiz), (b) honoring AI-suggested tags during mastery rollup so teachers see signal immediately, (c) auto-recompute after import, and (d) clearer per-quiz progress feedback.

## What you'll be able to do after this

1. **From Question Bank** — "Import quiz scores" works for *all* courses (not just one), shows a per-quiz progress summary, and auto-recomputes mastery when finished.
2. **From Assignments** — every quiz row gets an "Import scores" button so you can pull a single quiz's scores without bulk-importing.
3. **Mastery & Question Bank percentages** populate using both *confirmed* and *AI-suggested* question→standard tags, with confirmed weighted higher. Once you confirm tags later, the numbers strengthen but never disappear.
4. **Per-question class %** in the Question Bank reflects the freshly imported scores immediately, broken out by standard and substandard via the existing tree.

## Approach

### 1. Mastery rollup honors AI-suggested tags (edge function: `recompute-mastery`)

Currently `recompute-mastery` filters question→standard tags with `confirmed = true`, so until a teacher confirms each tag, imported scores never appear in mastery. Change it to:

- Include any tag where `confirmed = true OR ai_suggested = true`.
- Weight each response by the tag's confidence: `weight = confirmed ? 1.0 : (confidence ?? 0.5)`.
- Compute per-(student, standard) mastery as a confidence-weighted average of the most recent `attempt_window` responses.
- Same fallback to assignment-grain submissions when a standard has no question signal.

This means imported scores show up immediately, and confirming tags later just sharpens the numbers.

### 2. Bulk import across all courses (edge function: `canvas-sync-question-scores`)

Today the function requires `course_id` or `assignment_ids`. Add an "all my courses" path:

- If neither filter is provided, sync every quiz assignment owned by the teacher that has `canvas_quiz_id` set.
- Keep the existing per-quiz result array so the UI can show which quizzes succeeded / were skipped / failed.
- After successful upserts to `question_responses`, invoke `recompute-mastery` internally (server-to-server) so the teacher doesn't have to click a second button.

### 3. Question Bank UI updates (`src/pages/app/QuestionBank.tsx`)

- "Import quiz scores" button works whether course filter is "All my courses" or a specific course (drop the current "Pick a course first" guard).
- After import, show a compact summary toast plus an inline collapsible card listing each quiz with its status (✓ N responses / skipped: reason / error).
- Show a small "Last imported: <timestamp>" hint based on `canvas_credentials.last_sync_at` (read via the existing RPC) — purely informational.

### 4. Per-quiz import on Assignments page (`src/pages/app/Assignments.tsx`)

- For rows where `kind === "quiz"`, add an "Import scores" button next to "AI suggest" / "+ Add".
- Calls `canvas-sync-question-scores` with `{ assignment_ids: [a.id] }`, then triggers `recompute-mastery` and toasts the response count.
- Disabled when the quiz has no `canvas_quiz_id` (assignment-only).

### 5. Small data-quality fix

In `canvas-sync-question-scores`, when an answer has `points = null` but the submission is graded and the question is single-correct (`question_type` like `multiple_choice_question`/`true_false_question`), keep `correct = null` rather than guessing — current behavior is fine, just verify by checking a couple of recent rows after a real import.

## Technical details

**Files changed**

- `supabase/functions/recompute-mastery/index.ts` — include `ai_suggested` tags, add confidence weighting, keep assignment-grain fallback unchanged.
- `supabase/functions/canvas-sync-question-scores/index.ts` — allow "no filter = all teacher quizzes"; after successful imports, fetch-invoke `recompute-mastery` with the teacher's auth header; return both stats and the recompute summary.
- `src/pages/app/QuestionBank.tsx` — remove course-required guard on import; render per-quiz results panel; refresh bank + selected standard after import.
- `src/pages/app/Assignments.tsx` — add per-quiz "Import scores" action; call `canvas-sync-question-scores` and then `recompute-mastery`.

**No DB migration required** — `question_responses`, `question_standards`, and `mastery_snapshots` already have the columns we need.

**Edge function auth** — `canvas-sync-question-scores` and `recompute-mastery` already require JWT. Server-to-server invoke from `canvas-sync-question-scores` will forward the teacher's `Authorization` header.

## Out of scope (not changing now)

- New Question Bank columns (e.g. per-student breakdown per question) — the drawer already shows class average and response count; we can add a student list later if you want.
- Quiz score sync for non-Classic Quizzes (New Quizzes / LTI). The current Canvas API path is Classic Quizzes only; New Quizzes would need a separate integration.
- Changing the `analytics_question_bank` RPC — the bank UI already aggregates client-side and includes AI-suggested rows.
