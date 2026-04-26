## The disconnect

The Question Bank shows nothing because **0 of your 3,531 synced quiz questions are tagged**. Two compounding problems:

1. **Tagger is too strict**: the current `tag-question-standards` calls the AI **once per question** and then *throws away* every match that doesn't include ≥ 8 distinct keywords. With Gemini Flash that filter rejects almost every match — net result, no rows ever get inserted.
2. **UI hides AI suggestions**: `QuestionBank.tsx` only loads rows where `confirmed = true`. Even when the AI does tag a question, you'd never see it on this page until you went to Review and clicked confirm on every one.

## Approach — port the Canvas Quiz Export tagger

Your Canvas Quiz Export project solves the same problem with a much simpler, more reliable shape. We'll mirror it here:

- **Batch ~10 questions per AI call** (instead of 1) — same prompt sees more context, ~10× fewer API calls, dramatically faster.
- **Enrich each question with answer choices** as `STEM: … / CHOICES: A) … B) …` — the choices often carry the topic vocabulary that anchors a standard ("mitochondria", "tectonic plates", etc.).
- **Drop the 8-keyword gate.** Replace it with the lighter "matched_terms" hint (2–5 terms) used in Canvas Quiz Export, which the model reliably produces.
- **Show AI suggestions in the Question Bank**, not just confirmed ones (with a visual "AI" badge so you can tell at a glance).

## Changes

### 1. Rewrite `supabase/functions/tag-question-standards/index.ts`
- Resolve discipline exactly as today (course → infer-from-name → teacher default → profile).
- Load synced `quiz_questions` for the assignment.
- Build sanitized text per question via a `buildTaggerText` helper (HTML strip + decode entities + append `CHOICES:` when answers exist). Note: our `quiz_questions` table currently doesn't store answer choices, so as a follow-up we'll start capturing them in `canvas-sync` (see #4); until then this still works on the stem alone.
- Send the AI **batches of 10 questions** with the candidate standards list inlined in the system prompt (same shape as the Canvas Quiz Export `standards-tagger`).
- Tool schema returns `tags: [{ question_id, standards: [{ code, description, matched_terms[] }] }]`.
- Insert rows into `question_standards` as `ai_suggested = true, confirmed = false`, with rationale `"AI match · key terms: …"`.
- Roll the union of question-level matches up to `assignment_standards` (unchanged).
- Return `{ questions_tagged, total_question_matches, batches, discipline }`.

### 2. Rewrite `supabase/functions/tag-standards/index.ts` to share the same prompt style
- Keep the assignment-level entrypoint, but use the same batched, choice-enriched approach when the assignment is a quiz: tag each question, then roll up to assignment-level. For non-quiz assignments fall back to the current single-shot description tagging (without the 8-keyword gate).

### 3. Update `src/pages/app/QuestionBank.tsx`
- Stop filtering `question_standards` by `confirmed = true` — load both confirmed and AI-suggested rows.
- Add a small `AI` badge on suggested-only questions so you can tell which are confirmed vs. proposed.
- Add a "Suggested only / Confirmed only / All" toggle in the filter bar.
- Add a "Tag this standard's questions" button on the empty-state pane that runs the new tagger across the selected course's untagged questions.

### 4. Capture answer choices in `canvas-sync` (small, additive)
- Add an `answers jsonb` column to `quiz_questions` (nullable, defaults to `null`) via migration.
- In `canvas-sync`, when fetching `/api/v1/courses/{id}/quizzes/{qid}/questions`, persist `q.answers` (array of `{text, html}`) into the new column.
- The tagger will use this column when present to build the `CHOICES:` block, exactly like `buildTaggerText` does in Canvas Quiz Export.

## Technical details

```text
Old flow                                New flow
────────────────                        ─────────────────────────────────
For each Q (3,531×):                    For each batch of 10 Qs (~350×):
  1 AI call                               1 AI call with all 10 stems+choices
  require 8 keywords/match → drop         model returns matched_terms (2-5)
  upsert (almost always 0 rows)          upsert ai_suggested rows
                                         roll up to assignment_standards
```

Tool schema (matches Canvas Quiz Export):
```ts
{
  name: "tag_standards",
  parameters: { tags: [{
    question_id: number,
    standards: [{ code, description, matched_terms: string[] }]
  }] }
}
```

## Why this fixes it

- The 8-keyword gate was effectively a "return nothing" filter — removing it lets actual matches land.
- Batching cuts AI cost/latency ~10× so we can re-tag your whole 3,531-question bank in one pass.
- Showing AI suggestions in the bank means the page populates the moment tagging finishes, instead of waiting on manual confirmation in Review.
- Capturing answer choices gives the model the topic vocabulary it needs for vague stems ("Which of the following…").

## Files

- **Edit**: `supabase/functions/tag-question-standards/index.ts`
- **Edit**: `supabase/functions/tag-standards/index.ts`
- **Edit**: `supabase/functions/canvas-sync/index.ts` (persist `answers` jsonb)
- **Edit**: `src/pages/app/QuestionBank.tsx` (show AI suggestions + bulk re-tag)
- **New**: migration to add `quiz_questions.answers jsonb`
