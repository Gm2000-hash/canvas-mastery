# Class-first Analytics + merge Courses into the hub

## New navigation

- **Sidebar:** rename "Analytics" → **"Classes"** and remove the standalone "Courses" entry. The icon becomes `GraduationCap` (matches the concept).
- **Routes:**
  - `/app/classes` → hub page (class list + management)
  - `/app/classes/:courseId` → per-class analytics detail (the old Analytics tabs)
  - `/app/courses` and `/app/analytics` → redirect to `/app/classes` so existing links and bookmarks still work.

## Hub page (`/app/classes`)

A single class-management surface that combines today's Courses page + a stats overlay from Analytics.

Header row:
- Title "Classes" + short description.
- Right-side controls: **School year** select, **Show hidden** toggle, **Show archived (historical)** toggle, **Import from Canvas** button, **Backfill from Canvas** button (the existing `ImportCoursesDialog` in `mode="backfill"`).

Class cards (grid, one per class), each showing:
- Course name + code/term
- Subject / framework / grade badge
- **Mastery stats** from `analytics_class_breakdown`: students, assessments, avg mastery, % mastered
- Inline actions kept from today's Courses page:
  - **Discipline popover** — assign state/subject/grade (unchanged behavior)
  - **Hide / Unhide**
  - **Re-pseudonymize** (with the existing alert dialog)
- Primary CTA: **"Open analytics →"** navigates to `/app/classes/:courseId`
- Secondary link: **"Assignments"** → existing `/app/assignments?course=:id`

Empty / hidden / archived states and the Canvas-not-set-up empty state are preserved from `Courses.tsx`.

The hub does **not** have tabs — that's the whole point of the redesign.

## Per-class detail page (`/app/classes/:courseId`)

Reads `courseId` from the route. Removes the top-of-page Course `<Select>`. Tabs at the top, scoped to this single class:

1. **Students** (default) — the student × standard mastery matrix that today is hidden inside the Classes-tab accordion. Promoted to its own tab. (`ClassMatrixView`, always expanded, no collapse logic.)
2. **Mastery by subject** (Trends)
3. **Standards**
4. **Assessments**
5. **Mastery levels**
6. **Questions**

Above the tabs:
- Back link "← All classes" → `/app/classes`
- Course name + framework/subject badge
- **School year** select and **Show historical** toggle (kept here, since these scope the analytics views)

The multi-class **Compare** tab moves to the hub as a separate "Compare classes" card or a small CTA at the top of the hub (it's inherently multi-class). When opened, it uses the existing `CompareView` which already accepts a list of courses.

## Redirects + cleanup

- `/app/courses` → `<Navigate to="/app/classes" replace />`
- `/app/analytics` → `<Navigate to="/app/classes" replace />`
- Remove the Courses sidebar entry. Keep Assignments, Assignment Groups, Tag Review, Standards, Question Bank, Student History, Settings, Admin.
- Update any in-app links that point to `/app/courses` (Dashboard onboarding, settings empty states) to point to `/app/classes` — quick `rg` sweep.

## Implementation outline

- **New file** `src/pages/app/ClassesHub.tsx` — built from `Courses.tsx` (kept as-is for discipline/hide/import/repseudonymize), augmented with stats from `analytics_class_breakdown`, plus an "Open analytics" button per card, plus a "Compare classes" CTA that opens a dialog wrapping the existing `CompareView`.
- **Refactor `src/pages/app/Analytics.tsx` → ClassDetail page**:
  - Read `useParams<{ courseId: string }>()`.
  - Drop `<CourseMultiSelect>`-style top filter and the Classes tab.
  - Promote the per-class matrix into a "Students" tab that is the default.
  - Pass the route's `courseId` into every existing sub-view (`TrendsView`, `StandardsView`, `AssignmentsView`, `LevelsView`, `QuestionsView`).
- **`src/App.tsx`** — add `/app/classes` and `/app/classes/:courseId` routes; add redirects from `/app/courses` and `/app/analytics`.
- **`src/layouts/AppLayout.tsx`** — replace the Courses + Analytics nav items with a single **"Classes"** entry pointing at `/app/classes`.
- **Delete** `src/pages/app/Courses.tsx` once its logic has been moved into the hub (or keep it as a thin re-export during transition — simpler to just delete and reuse the JSX inside the hub).

## What stays the same

- All RPCs (`analytics_class_breakdown`, `analytics_class_matrix`, `analytics_mastery_trends`, `analytics_compare_classes`, etc.) — no DB changes.
- `ImportCoursesDialog`, discipline assignment, repseudonymize, historical toggle behavior.
- All other tab views' internals (Standards, Assessments, Levels, Questions).

## Out of scope

- Visual redesign of the per-class tabs themselves.
- Changes to Compare logic — only its placement (hub instead of detail page).
