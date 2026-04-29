# Department Analytics

Add a Department area where teachers can see collective data across all teachers who teach the same subject + grade in the same school year. Real student names are visible only for the viewer's own students; all other students appear with pseudonyms.

## What gets built

### Navigation
- New top-level sidebar item **"Department"** (icon: Users), in `src/layouts/AppLayout.tsx`.
- Routes in `src/App.tsx`:
  - `/app/department` — landing page that lists the user's available departments (Science, Social Studies, Math, ELA) inferred from their `teacher_disciplines` rows.
  - `/app/department/:subject` — the department dashboard.

### Department landing (`/app/department`)
- Cards for each of the four subjects the teacher participates in (based on `teacher_disciplines.subject`). Subjects without a discipline row are shown disabled with a "Add this subject in Settings" hint.
- Each card shows: number of peer teachers, number of concurrent classes, total students, current school-year label.

### Department dashboard (`/app/department/:subject`)
Filter bar:
- **Grade** (multi) — defaults to all grades the viewer teaches in this subject.
- **School year** — defaults to current; uses existing `recentSchoolYears()` helper.
- **Framework** (auto-resolved from selected grade/subject; same logic as Analytics).

Tabs (mirrors existing Analytics page so it feels native):
1. **Overview** — KPIs (teachers, classes, students, avg mastery, % students mastered ≥ threshold), mastery distribution histogram, mastery trend line by week.
2. **Standards** — table of standards covered in the department: # students assessed, # mastered, avg mastery, % mastered, with drill-down to per-class numbers (class names anonymized as "Class A, B, C…" for non-owners; viewer's own classes show real names).
3. **Classes** — comparison table of all concurrent classes in the department: class label (real name if own, "Teacher #N · Period A" pseudonym otherwise), student count, avg mastery, % mastered. Sortable.
4. **Students** — list of all students across the department. Viewer's own students show real names; peers' students show stable pseudonyms (`S-1`, `S-2`, …) per teacher. Columns: student label, class label, standards assessed, standards mastered, avg mastery, last activity. Search restricted to own students.
5. **Assessments** — common assessments (matched by `assignments.name_normalized` across teachers in the department). Shows # teachers using it, # responses, avg %, standards tagged. Helpful for spotting de-facto common assessments.

All tables export to CSV using the same pattern as the existing Analytics page; peer rows in the CSV use pseudonyms.

## Technical implementation

### Database (one migration)
Add a column + four security-definer RPCs. No new tables required — we use existing `teacher_disciplines`, `courses`, `students`, `mastery_snapshots`, `submissions`, `question_responses`, `assignments`.

1. **Add school-year helper**: `public.school_year_for(ts timestamptz) returns text` (matches the JS `schoolYearLabelFor` Aug→Jul logic). Used inside RPCs to filter by year.

2. **`department_membership(_subject text, _school_year text)`** *(security definer)* — returns the set of `teacher_id`s who have a `teacher_disciplines` row matching `_subject` AND have at least one non-archived course active in `_school_year`. Used both for permission checks and aggregations.

3. **`department_overview(_subject text, _grade text[], _school_year text)`** — KPIs + distribution + weekly trend. Aggregates `mastery_snapshots` joined to `students.course_id → courses.discipline_id → teacher_disciplines` filtered by subject/grade and the membership set. **The caller must be in the membership set or the function returns empty.**

4. **`department_standards(...)`**, **`department_classes(...)`**, **`department_students(...)`**, **`department_assessments(...)`** — same pattern. Each returns a `is_own boolean` flag per row plus a stable `pseudo_label text` for non-own rows so the client can render correctly without ever seeing peers' real names.

   Pseudonym generation:
   - Teachers: `'Teacher #' || dense_rank() over (order by teacher_id)` scoped to the result set, deterministic per call.
   - Students: `'S-' || dense_rank() over (partition by teacher_id order by student_id)` for non-own rows; own rows pass through real `students.name`.
   - Classes: `'Class ' || chr(64 + dense_rank() over (...))` for non-own rows.

   Critically: real `students.name`, `students.email`, and `student_identities.real_name` are **never** returned for non-own rows — the SQL only selects them when `students.teacher_id = auth.uid()`.

5. **RLS**: no table changes. All cross-teacher access is funneled through these security-definer RPCs, which enforce membership and column-level masking. No new direct SELECT policies are added.

### Frontend
- `src/pages/app/Department.tsx` — landing page (subject cards).
- `src/pages/app/DepartmentDashboard.tsx` — tabbed dashboard. Reuses existing UI primitives (`Card`, `Tabs`, `Table`, `ChartContainer`, recharts) and `CourseMultiSelect`-style components for grade selection.
- Add an info banner: *"You see real names only for your own students. Peer students appear as S-1, S-2…"*
- The existing per-page `RevealNamesToggle` is **not** added on department pages — there is no path to reveal peer students.
- Routes wired in `src/App.tsx`; nav entry added in `src/layouts/AppLayout.tsx`.

### Pseudonym stability
Per-call dense_rank gives stable labels within a single response. Across separate calls (e.g. the Classes tab vs the Students tab) labels may differ, which is acceptable because each tab is self-contained. We document this in a code comment.

## Out of scope
- Cross-school-year department views (single year at a time).
- Inviting peers / school admin role (uses existing teacher accounts only — any teacher with a matching discipline row sees the data).
- Editing peer data — read-only across the board.

## Files

Created:
- `supabase/migrations/<ts>_department_analytics.sql`
- `src/pages/app/Department.tsx`
- `src/pages/app/DepartmentDashboard.tsx`

Edited:
- `src/App.tsx` (routes)
- `src/layouts/AppLayout.tsx` (nav entry)
