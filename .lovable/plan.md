## Tag Review screen, multi-discipline profiles, and selective course import

Three connected upgrades so you can teach more than one subject and review AI standard tags efficiently.

---

### 1. Tag Review screen — `/app/review`

A dedicated, fast-moving workspace for confirming/overriding AI-suggested standard matches. Different from the Assignments page (which is a general assignment list); Review is built specifically for sweeping through suggestions.

**Layout (top → bottom):**
- **Filter bar:** Course (multi-select) · Discipline (multi-select) · Status (Untagged / AI-suggested / Confirmed / All) · Sort (Most recent · By due date · Alphabetical) · "AI suggest for all untagged in view" button
- **Bulk action bar** (appears when items are selected): *Confirm all* · *Reject all* · *Re-run AI*
- **Assignment cards** — denser than the Assignments page. Each card shows:
  - Checkbox · assignment name · course · kind badge (assignment/quiz) · due date
  - Suggested tags as chips with confidence % and rationale tooltip — each chip has one-click ✓ Confirm / ✕ Reject
  - Confirmed tags as solid green chips with × to remove
  - "+ Add standard manually" inline search
  - "Override with…" — picks a different standard and rejects the suggestion in one step
  - Keyboard shortcuts: `J/K` next/prev card, `Y` confirm top suggestion, `N` reject, `A` AI-suggest

Standards offered in the search/override are filtered to disciplines you actually teach (see #2), so a Math + Science teacher sees both, not all 50 states.

The existing Assignments page stays as-is — it's still useful for viewing assignments by course. Review is the workflow page.

---

### 2. Multi-discipline teacher profiles

Today Settings has a single State / Subject / Grade. Replacing that with a **list of teaching assignments**:

- New **Disciplines** section in Settings showing a list of `{state, subject, grade}` rows
- "+ Add discipline" button → row form with State, Subject, Grade dropdowns
- Each row has its own "Seed standards" button (so a 7th-grade Math + 7th-grade Science teacher can seed both libraries independently) and a remove ✕
- Show a status pill per row: *Standards seeded (n)* / *Not seeded yet*
- The first discipline added is automatically the **default** (used when AI tags an assignment if the assignment's course doesn't have an explicit discipline mapping — see #3); user can change the default with a star icon

**Database**: new `teacher_disciplines` table — `(teacher_id, state, subject, grade, is_default)`. The `profiles.state/default_subject/default_grade` columns stay for now (used as fallback); we backfill the existing profile values into a first `teacher_disciplines` row on migration.

---

### 3. Per-course discipline mapping + selective course import

**Course discovery & import:**
- New **"Import courses"** button on the Courses page → modal that calls a new `canvas-list-courses` edge function
- The modal lists *every* course the API token can see (active + completed teacher enrollments, not just what was imported), with checkboxes:
  - Each course shows name, code, term, student count
  - Indicates which are *already imported* (✓), *new*, or *previously imported but archived in Canvas*
  - "Select all active" / "Select all this term" quick buttons
  - Per-row **Discipline** dropdown (populated from your teaching assignments in #2) — required for new imports so AI tagging knows which standards library to use
- "Import selected" calls the existing `canvas-sync` function with the chosen course IDs and discipline mappings

**Course-level discipline mapping:**
- Adds `discipline_id` (FK → `teacher_disciplines`) to the `courses` table
- Existing Courses page cards get a small editable Discipline pill so you can re-map at any time (e.g., a course was imported as Math but you also use it for Science)
- The `tag-standards` edge function reads the course's discipline first, then the teacher's default discipline, then errors clearly if neither is set

**Sync changes:** `canvas-sync` accepts an optional `course_ids` array. If omitted, it syncs all teacher-active courses (current behavior). If present, only those Canvas course IDs are pulled. Discipline mappings sent in the request are persisted before sync runs.

---

### Database changes (one migration)

```sql
-- Multi-discipline support
CREATE TABLE teacher_disciplines (
  id uuid pk default gen_random_uuid(),
  teacher_id uuid not null,
  state text not null, subject text not null, grade text not null,
  is_default boolean not null default false,
  created_at timestamptz default now(),
  unique (teacher_id, state, subject, grade)
);
-- RLS: teacher manages own rows; partial unique index ensures one default per teacher

ALTER TABLE courses
  ADD COLUMN discipline_id uuid REFERENCES teacher_disciplines(id) ON DELETE SET NULL;

-- Backfill: copy each profile's state/default_subject/default_grade into a default discipline row
```

---

### Edge function changes

- **NEW** `canvas-list-courses` — returns all courses the token can see (no upsert), enriched with per-course student counts and "already imported" flag
- **`canvas-sync`** — accepts optional `{ course_ids?: number[], discipline_assignments?: {canvas_course_id, discipline_id}[] }`; assigns discipline before upserting course; otherwise unchanged
- **`tag-standards`** — looks up the assignment's course → `discipline_id` → `teacher_disciplines` row, and filters the candidate standards library to that `(state, subject, grade)`. Falls back to the teacher's default discipline. Returns a clear error if no discipline is set
- **`seed-standards`** — already accepts `{state, subject, grade}`; no API change needed, just called per-discipline from the new Settings UI

---

### Frontend changes

- **NEW** `src/pages/app/Review.tsx` — the Tag Review screen described above
- **NEW** `src/components/ImportCoursesDialog.tsx` — used from Courses page
- **`AppLayout.tsx`** — add "Review" nav item with `Sparkles`/`CheckCheck` icon, between Assignments and Standards
- **`App.tsx`** — register `/app/review` route
- **`Settings.tsx`** — replace single Profile state/subject/grade block with the new Disciplines list; keep Display name in Profile
- **`Courses.tsx`** — add "Import courses" button → opens dialog; show editable Discipline pill on each card
- **`Assignments.tsx`** — small badge on each row showing its course's discipline so you know which standards library applies

### Out of scope for this round
- Per-question (quiz) tagging — already on the Phase 2 roadmap
- CSV upload of custom standards
- Reassigning all submissions/mastery when a course's discipline changes (it'll just update going forward)