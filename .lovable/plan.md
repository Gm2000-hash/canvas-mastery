# CSV Quiz Score Importer

Add a one-shot CSV importer for per-student, per-question quiz scores that lands in the same tables as the Canvas pipeline — so Question Bank, Mastery, and Analytics all light up the same way. Bake AI auto-tagging and mastery recompute into the import flow so it's one click end-to-end.

## What you'll be able to do

1. From **Assignments** (and **Question Bank**), click **"Import quiz from CSV"**.
2. Pick the **course** the quiz belongs to and (optionally) name the quiz.
3. Upload a CSV. The importer detects two layouts automatically:
   - **Long format** — one row per (student, question, score). Columns like `student_email | student_name | question | points | points_possible | correct`.
   - **Wide format** — one row per student; first columns identify the student, every remaining column is a question (header = question text, cell = points earned). A second header row with points-possible is detected if present.
4. Preview a parsed sample (first 5 students × 5 questions) with detected column mapping. Adjust mappings if needed.
5. Two checkboxes, both **on by default**:
   - **Auto-tag new questions with AI** — runs `tag-question-standards` after import.
   - **Recompute mastery when finished** — runs `recompute-mastery`.
6. Click **Import**. Progress bar shows: Parsing → Matching students → Writing responses → AI tagging → Recomputing mastery → Done. Final summary shows counts and any skipped rows.

After import, the new quiz appears under the chosen course on the Assignments page (kind = `quiz`, no `canvas_quiz_id`). Question Bank shows the new questions tagged to standards. Mastery and Analytics reflect the scores.

## Approach

### 1. New edge function: `import-quiz-csv`

Single endpoint that does the whole pipeline server-side. Body:

```
{
  course_id: string,                  // required
  quiz_name: string,                  // required (defaults to filename)
  due_at?: string,                    // optional ISO date
  layout: "long" | "wide",
  mapping: {                          // for "long"
    student_email?: string,
    student_name?: string,
    question_text?: string,
    points?: string,
    points_possible?: string,
    correct?: string,
  } | {                               // for "wide"
    student_email?: string,
    student_name?: string,
    points_possible_row?: number,     // optional row index for per-question points possible
  },
  rows: Array<Record<string, string>>,// already parsed on the client
  options: { auto_tag: boolean, recompute: boolean }
}
```

Pipeline:

1. **Create or reuse the assignment.** Match on `(teacher_id, course_id, name, kind='quiz', canvas_assignment_id=0)` — for CSV imports we use a synthetic negative `canvas_assignment_id` (e.g. `-hash(teacher+course+name)`) so the existing unique constraint is satisfied without colliding with Canvas IDs. If a row already exists, reuse it.
2. **Upsert `quiz_questions`.** One row per unique question text in the CSV. Match on `(teacher_id, assignment_id, canvas_question_id)` where `canvas_question_id` is also synthetic (negative hash of the normalized question text scoped to the assignment). Store `position` based on column order. New questions get `points_possible` from the wide-format header row, the `points_possible` column in long format, or `null`.
3. **Match students.** For each unique `(email, name)`:
   - Try `students` rows in this `course_id` by email if a `student_email` column exists *and* an existing student has been written there before (we don't currently store email — see migration below).
   - Else match by case-insensitive `name`.
   - Else create a new `students` row with synthetic negative `canvas_user_id` (hash of `lower(email||name)`).
4. **Insert `question_responses`.** For each (student, question) cell with a value: parse `points` and `points_possible`, derive `correct` if both present (`points >= points_possible`) or take the explicit `correct` column. Upsert by `(teacher_id, question_id, student_id)`.
5. **Optional: AI tagging.** If `options.auto_tag`, call `tag-question-standards` for the new assignment, but only for questions that are not already linked via text-match (so we save AI calls on duplicates that already inherit standards from other quizzes).
6. **Optional: recompute.** If `options.recompute`, fetch-invoke `recompute-mastery` server-to-server with the teacher's auth header.
7. Return: `{ assignment_id, stats: { questions_created, students_matched, students_created, responses_written, questions_skipped, ai_tagged }, recompute?: {...} }`.

### 2. Small DB migration

- Add `email text` to `students` (nullable, indexed by `(teacher_id, lower(email))`). Lets future CSV imports match students reliably across courses.
- Relax the existing unique constraint on `assignments.canvas_assignment_id` to be unique per `(teacher_id, course_id, canvas_assignment_id)` if it isn't already, so synthetic negative IDs don't collide across teachers/courses. (Inspect first; only add if needed.)
- Same for `quiz_questions.canvas_question_id` → unique per `(teacher_id, assignment_id, canvas_question_id)`.

### 3. New UI: `ImportQuizCsvDialog.tsx`

Reusable dialog component. Steps:

```text
Step 1: Course + name + file picker
Step 2: Layout detection + column mapping preview
Step 3: Options (auto-tag, recompute) + Import button
Step 4: Progress + final summary
```

CSV parsing happens **client-side** with a tiny dependency-free parser (handles quoted fields, commas, newlines, BOM). Send the parsed `rows` array to the edge function so we don't need to handle multipart uploads.

Layout detection heuristic:
- If a column is named like `question`, `item`, `score`, `points`, the file is **long**.
- Otherwise, if the first 1–3 columns look like student identifiers (`name`, `email`, `student`, `id`) and the rest are arbitrary text, it's **wide**.
- User can override.

### 4. Wire-up

- **`src/pages/app/Assignments.tsx`** — add an **"Import CSV"** button in the page header (next to existing actions). Opens the dialog with the current course pre-selected if a course filter is active. After success, refresh the assignments list.
- **`src/pages/app/QuestionBank.tsx`** — add an **"Import CSV"** button next to the existing "Import quiz scores" button. After success, refresh the bank and any open standard.
- **`src/contexts/SyncContext.tsx`** — if there's a global "syncing" indicator, surface CSV imports there too (optional, only if the context already supports arbitrary tasks).

### 5. Edge cases handled

- **Duplicate student names** in a course → match by email if present, otherwise warn in the summary and skip the ambiguous rows.
- **Empty cells** in wide format → skipped (no response written), not treated as 0.
- **Non-numeric scores** → the response is skipped and listed in `questions_skipped`.
- **Re-import** of the same CSV → idempotent because we upsert on synthetic IDs; scores get overwritten with the latest values.
- **Very large files** → cap at 5,000 responses per request in the UI; if larger, the dialog suggests splitting (we can add chunked uploads later if it becomes a real problem).
- **Question text matching** with existing tagged questions still works — the importer writes raw question text to `quiz_questions.question_text`, and the existing normalization in `recompute-mastery` and `mastery_debug` handles the matching.

## Technical details

**Files added**
- `supabase/functions/import-quiz-csv/index.ts` — the pipeline above.
- `src/components/ImportQuizCsvDialog.tsx` — multi-step dialog with client-side CSV parsing.
- `supabase/migrations/<ts>_csv_import_support.sql` — `students.email` column + index, plus any constraint relaxations confirmed necessary after inspecting current indexes.

**Files changed**
- `src/pages/app/Assignments.tsx` — add "Import CSV" header button.
- `src/pages/app/QuestionBank.tsx` — add "Import CSV" button next to existing import.

**No changes** to `recompute-mastery` or `tag-question-standards` — both already work on any `quiz_questions` rows regardless of source.

**Auth** — `import-quiz-csv` requires JWT; uses the service role internally for upserts (to bypass per-row RLS round-trips) but always scopes every write to `teacher_id = auth.uid()` from the validated JWT.

## Out of scope

- **Direct Google Forms API** integration (still planned as a follow-on; CSV unlocks Forms today via "Download responses → CSV" from Forms).
- **CSV export** of existing scores.
- **Student roster CSV import** independent of a quiz (could come later by reusing the student-matching logic).
- **Per-question standard hints in the CSV** (e.g. a `standard_code` column) — easy to add later; for now AI tagging covers it.
