## Finish the longitudinal + auto-archive build

The schema, edge function, and standalone pages are already in. This plan wires them into the existing UI so teachers actually see (and benefit from) the new behavior.

---

### 1. Settings page integration

Add two things to `src/pages/app/Settings.tsx`:

- **Auto-archive card** — toggle bound to `teacher_settings.auto_archive_enabled` (already defaults to `true`). Copy explains: "Courses are automatically hidden from your default views after Canvas marks them completed *and* the school year (ending June 9) ends. You'll still see all current-school-year students regardless of trimester."
- **Mount `<MergeStudentsCard />`** under a "Link student records" section, so a teacher can manually merge a 7th-grade roster entry to its 6th-grade counterpart.

### 2. Default-view filtering (hide archived by default)

Apply `archived_at IS NULL` to the queries powering:

- `src/pages/app/Mastery.tsx` — students list + course filter
- `src/pages/app/Dashboard.tsx` — recent activity and counts
- `src/pages/app/QuestionBank.tsx` — assignment/course filters
- `src/pages/app/Courses.tsx` — show archived courses in a collapsed "Archived (N)" section instead of the main list

The data is preserved — it's just not in the default scope. The Historical page and the toggle (below) are how it gets surfaced.

### 3. Analytics: school-year filter + historical toggle

In `src/pages/app/Analytics.tsx`:

- Add a school-year `<Select>` (options derived from distinct school years across the teacher's courses, default = current school year per `school_year_end_for(now())`).
- Pass the chosen year to the Analytics RPCs via the new `_school_year` param.
- Add `<HistoricalToggle />` in the header. When on, the queries drop the `archived_at IS NULL` filter and write a row to `historical_access_log` (course_id null, reason "analytics view").

### 4. Mastery: historical toggle

In `src/pages/app/Mastery.tsx`, add `<HistoricalToggle />` next to the course filter. Same behavior — flipping it on includes archived students/courses and logs the access with the current course_id and reason "mastery view".

### 5. Sidebar + nav polish

`src/layouts/AppLayout.tsx` already has the Student History entry from the previous step. Verify it's grouped sensibly (under "Records" or directly under Mastery) and that the icon matches the rest of the nav.

### 6. Small correctness items

- **Dashboard "Active students" count**: switch to `archived_at IS NULL` so the number reflects current rosters, not lifetime.
- **Course list**: show a small "Archived {date}" badge on archived rows when expanded.
- **HistoricalToggle**: confirm it requires a non-empty reason before flipping on (FERPA audit hygiene).

---

### Technical notes

- All filtering is client-side query changes (`.is('archived_at', null)`) — no new migrations needed; the columns already exist.
- The Analytics RPCs already accept `_school_year` from the prior migration; this plan just exposes the control.
- `historical_access_log` writes go through the existing RLS policy (`teacher_id = auth.uid()` on insert).
- No changes to the canvas-sync function; auto-archive already runs at the end of each sync.

### Out of scope (still)

- `/admin` UI, audit log viewer, role management — next plan.
- Cross-teacher access requests — separate plan after admin lands.
- Auto-un-archive logic — admin override only.

Approve and I'll ship it.