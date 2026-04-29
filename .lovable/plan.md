## Goal

Treat assignments with the same name (or near-identical content) given across multiple sections of the same class as a single "logical assignment." Today the same Pre-ECA given to two sections shows up as two separate `assignments` rows because Canvas issues different `canvas_assignment_id`s per section. We need cross-class equivalence so analytics, the Compare tab, and standard tagging treat them as one.

## Approach: Assignment Groups (non-destructive)

Instead of merging rows in `assignments` (which would break Canvas sync, RLS, and per-course analytics), we add a lightweight **grouping layer** on top.

```text
assignments (per-course rows, unchanged)
        │
        ▼
assignment_group_id ──► assignment_groups (one per logical assignment)
```

A teacher can review AI-suggested groups, accept, edit, split, or merge them. Analytics RPCs gain an "aggregate by group" mode.

## Technical Plan

### 1. Schema (migration)

- New table `public.assignment_groups`:
  - `id uuid pk`, `teacher_id uuid`, `name text`, `kind` (assignment|quiz), `subject text null`, `grade text null`, `created_at`, `updated_at`, `confirmed bool default false`
  - RLS: teacher_id = auth.uid() ALL.
- Add `assignment_group_id uuid null` FK on `public.assignments` (nullable; ungrouped = standalone). Index `(teacher_id, assignment_group_id)`.
- Add `name_normalized text` generated/maintained on `assignments` (lowercased, whitespace-collapsed, punctuation trimmed) plus index, used for fast grouping suggestions.
- No data destruction; ungrouped assignments behave exactly as today.

### 2. Auto-grouping logic

- New edge function `suggest-assignment-groups`:
  - For the teacher's assignments without a group, cluster by:
    1. Same `kind`,
    2. Same normalized name OR ≥0.92 trigram similarity (`pg_trgm`),
    3. Same effective subject/grade (via `teacher_disciplines` on the course),
    4. Optional: same `points_possible` and similar `due_at` window.
  - Optionally call Lovable AI Gateway (`google/gemini-2.5-flash-lite`) on borderline pairs with the question text to confirm equivalence — only for `confidence < 0.92`.
  - Returns proposed groups; does NOT auto-write. Teacher confirms in UI.
- A second function `apply-assignment-groups` writes `assignment_groups` rows and sets `assignment_group_id` on member assignments. Idempotent.

### 3. Analytics & Compare tab updates

Update RPCs (additive — keep old signatures working):

- `analytics_assignment_breakdown`: add optional `_group_by_group bool default false`. When true, group by `assignment_group_id` (fallback to `assignments.id` for ungrouped) and sum submissions/avg pct across member assignments.
- `analytics_compare_classes`: accept either `_assignment_id` (single) or new `_assignment_group_id`. When a group is given, the source CTE pulls submissions for **all** member assignments whose course is in `_course_ids`. This is what handles the "two sections of 8th Grade Science B took the same Pre-ECA" case directly.
- `analytics_question_breakdown` and `analytics_question_bank`: optional group filter, merging questions that share normalized text across the group's assignments.
- Standards tagging: when a group is confirmed, propagate confirmed standard tags from any member assignment to the others (via `assignment_standards`) so mastery is recomputed consistently. `recompute-mastery` already runs per teacher and will pick this up.

### 4. UI

New page **Assignment Groups** (`src/pages/app/AssignmentGroups.tsx`), linked from Assignments page header and the admin/troubleshooting area:

- "Suggested groups" list (from `suggest-assignment-groups`): each card shows name, member courses, # submissions, confidence. Buttons: **Confirm group**, **Split**, **Edit name**.
- "Confirmed groups" list with member chips and an "Add another assignment" picker (search by name).
- "Ungrouped" tab to manually create a group from selected assignments.

Update **Assignments page** (`src/pages/app/Assignments.tsx`):

- Show a small "Group: <name>" badge next to assignments that belong to a group; click to open the group page.
- Banner above the list when ≥1 suggestion exists: "We found N assignments that look like duplicates across classes — Review."

Update **Analytics → Compare tab** (`src/pages/app/Analytics.tsx`):

- The assignment picker switches its options to **groups first** (with member-count badge), then ungrouped assignments. Selecting a group passes `_assignment_group_id` to the RPC. The mastery bands chart will then naturally split by class while pulling from the unified group.

### 5. Files

- **New migration** `*_assignment_groups.sql`: creates `assignment_groups`, adds `assignment_group_id` and `name_normalized` to `assignments`, enables `pg_trgm`, updates the four analytics RPCs above, adds a `merge_assignment_group` RPC (admin-style helper to unify two existing groups).
- **New edge functions**: `supabase/functions/suggest-assignment-groups/index.ts`, `supabase/functions/apply-assignment-groups/index.ts`.
- **New component**: `src/pages/app/AssignmentGroups.tsx` and a small `AssignmentGroupBadge.tsx`.
- **Edited**: `src/App.tsx` (route), `src/layouts/AppLayout.tsx` (sidebar entry under Assignments or Admin), `src/pages/app/Assignments.tsx` (badge + suggestions banner), `src/pages/app/Analytics.tsx` (Compare uses group ids).

### 6. Backfill / safety

- Migration runs no destructive updates. After it ships, the user clicks "Find duplicate assignments" once on the new page; they review and confirm. Nothing is grouped silently.
- Mastery recompute is triggered after a group is confirmed (only for affected courses).
- All new RPCs are `SECURITY DEFINER` with `auth.uid()` scoping, mirroring existing analytics RPCs.

## Out of scope (for now)

- Auto-grouping by question-text similarity alone (we use it only as a tiebreaker).
- Merging Canvas-side data — Canvas remains the source of truth per section.
- Cross-teacher group sharing.
