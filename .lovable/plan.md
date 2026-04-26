## Why "AI suggest" appears broken on ECA 8B_2025

I traced the call. The edge function actually runs and returns **HTTP 200** in ~1.5s — it just returns **zero matches**, so the toast says "AI couldn't find a strong match" and nothing visible changes. Three real problems are stacking:

1. **Wrong grade level.** The course `8th Science B - Section 14` has no `discipline_id`, so the function falls back to the teacher's *default* discipline = **NGSS Grade 6**. AI then tries to match an 8th-grade quiz against grade-6 standards. (All 10 courses in this account have `discipline_id = NULL`, so this affects everything.)
2. **Quiz body ignored.** The function only sends `assignment.name` + `assignment.description` to the AI. For this quiz the description is generic test instructions ("don't open other browser windows…"). The actual 82 stored quiz questions (~7.5K chars of real science content) are never sent — so the AI legitimately can't find ≥8 substantive overlapping keywords.
3. **Silent failure UX.** When AI returns 0 matches the user only sees a tiny toast. Nothing on the row hints at *why*.

## Fix

### 1. Smarter discipline resolution in `tag-standards` (and `tag-question-standards`)
- Keep current order: course mapping → teacher default.
- **Add a grade-inference step** before falling back: parse the course name/code for `7th`, `8th`, `Grade 6`, etc. If we match a number, look for a `teacher_disciplines` row for the same teacher with that grade + the default's subject/framework. If found, use it instead of the default.
- For `8th Science B - Section 14` this picks the existing **NGSS Grade 8** discipline (59 standards) automatically.
- Falls back to the default cleanly if no grade is detected.

### 2. Include quiz question text for quiz-kind assignments
In `tag-standards`, after loading the assignment, if `kind = 'quiz'` pull up to ~40 rows from `quiz_questions` ordered by `position`, take their `question_text`, strip HTML, and append a `QUIZ QUESTIONS:` block to the user prompt (cap at ~6000 chars to keep the request lean).

### 3. Better empty-result feedback
In `Assignments.tsx`:
- When the response succeeds but `suggestions.length === 0`, show a more useful toast: *"AI found no strong match for grade {grade} {framework}. Try assigning a different discipline to this course in Courses, or use + Add."*
- Return `discipline` info (already in the response) and surface the resolved grade/framework in the toast so the user immediately sees the grade-6 mismatch when it happens.

### 4. One-time UI affordance: assign discipline per course
Add a small "Discipline: NGSS Grade 6 (default) — change" link on the Assignments page header (next to the course selector) that opens a popover to pick from the teacher's existing disciplines and updates `courses.discipline_id`. This lets the user fix grade mappings without leaving the page. (No new tables, no migration — just an UPDATE on `courses`.)

## Files

- **Edit** `supabase/functions/tag-standards/index.ts` — grade inference + quiz question fetch + include in prompt.
- **Edit** `supabase/functions/tag-question-standards/index.ts` — same grade inference (so per-question tagging picks the right grade too).
- **Edit** `src/pages/app/Assignments.tsx` — better empty toast; small "Discipline: … change" picker.

## Out of scope (not doing now)

- Bulk-assigning disciplines to all 10 existing courses automatically. The picker makes it a 2-click fix per course; auto-guessing every course feels presumptuous.
- Changing the ≥8-keyword evidence rule. It's working as intended; the problem was inputs, not the bar.
