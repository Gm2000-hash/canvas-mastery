# Analytics: Classes default + drill-in matrix

## What changes

1. **Default tab → Classes.** When a teacher opens `/app/analytics`, the Classes tab is selected by default (currently it lands on "Mastery by subject"). The standalone "Students" tab is removed because student data is now reached by clicking a class.

2. **Class drill-in.** Each row in the Classes table becomes clickable (and gets a "View students" affordance). Clicking opens a per-course matrix view in place:
   - Rows = active students in the course (one per student)
   - Columns = standards confirmed on that course's assignments
   - Cells = mastery score (0–100%) color-coded (red < 60%, amber 60–79%, green ≥ 80%, gray for "no evidence yet")
   - Sticky first column (student name) and sticky header row, horizontally scrollable
   - Trailing column = student average across visible standards
   - Footer row = class average per standard
   - Hover a cell → tooltip with attempts, last computed timestamp, and the standard's full description
   - Top-left "← Back to classes" returns to the rollup

3. **Standards / Substandards toggle.** Above the matrix, a two-button toggle:
   - **Substandards (default):** one column per individual standard code (e.g. `PS-MS-1-1`, `PS-MS-1-2`, `PS-MS-1-3`)
   - **Standards (rolled up):** columns are parent codes (e.g. `PS-MS-1`) and each cell is the average of that student's mastery across all child substandards. A small "n=3" sub-label shows how many substandards rolled up.
   - The parent code is derived from the standard code by stripping the trailing segment after the last `-` or `.` (e.g. `PS-MS-1-1 → PS-MS-1`, `7.NS.A.1 → 7.NS.A`). Codes with no separator stay as-is.

4. **Matrix filters & utilities.**
   - Search-by-student textbox
   - Subject + framework filter chips (because a course may have standards from multiple frameworks once seeded)
   - "Sort columns by: code | weakest first | strongest first"
   - "Export CSV" button that downloads exactly what's on screen

## Technical notes

- New SQL function `analytics_class_matrix(_course_id uuid)` returning one row per (student × standard) for that course, including: `student_id`, `student_name`, `student_sortable`, `standard_id`, `code`, `parent_code` (derived via `regexp_replace(code, '[-.][^-.]+$', '')`), `description`, `subject`, `grade`, `framework`, `mastery_score`, `mastered`, `attempts`, `computed_at`. SECURITY DEFINER, scoped to `auth.uid()`.
- Frontend pivots into a 2D grid client-side. In "Standards" rollup mode, average the mastery scores of all substandards belonging to the same `parent_code` per student (ignoring nulls).
- The Classes tab becomes a small state machine: `mode = 'list' | 'matrix'`, with `selectedCourseId` driving the matrix view.
- Tabs reorder: Classes, Mastery by subject, Standards, Assessments, Mastery levels, Questions.
- Remove the now-unused `StudentsView` component and `Users` icon import to keep the bundle clean.

## Files touched

- `supabase/migrations/<new>.sql` — add `analytics_class_matrix` function
- `src/pages/app/Analytics.tsx` — reorder tabs, default to Classes, replace `ClassesView` with combined list+matrix flow, delete `StudentsView`

## Out of scope

- No schema changes to `standards` (parent/child relationship is purely derived from the code).
- No edits to the existing trends, standards, assessments, levels, or questions tabs.
- No persisted "last viewed course" preference — drill-in resets when leaving the tab.
