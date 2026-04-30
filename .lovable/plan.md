# Revamp Assignment Groups: Class Groups First, AI Matching Second

## Concept change

**Today:** the page scans across ALL of a teacher's assignments and uses fuzzy name matching to suggest groupings. A teacher with two preps (Science A + Science B) can get false positives across preps, and there is no way to scope the AI.

**New flow:**
1. Teacher creates a **Class Group** (e.g. "8th Grade Science A", "8th Grade Science B") and adds 2+ classes to it.
2. Within a single Class Group, the teacher clicks **"Find equivalent assessments"** — AI matches assignments/quizzes that represent the same assessment across just those classes.
3. Teacher confirms / edits / rejects each suggested assessment match. Confirmed matches become assignment groups (the existing concept) but scoped to that Class Group's classes.

This is a UX inversion: the teacher defines the *boundary* first, AI matches *within* it.

## What the user sees

### `/app/assignment-groups` (renamed in nav to "Class groups")

```text
┌─ Class groups ─────────────────────────────────────────┐
│  [+ New class group]                                   │
│                                                        │
│  ▾ 8th Grade Science A                          [edit] │
│      Classes: Period 1 Sci A · Period 3 Sci A · …      │
│      Equivalent assessments: 4 confirmed, 2 suggested  │
│      [Find equivalent assessments]                     │
│                                                        │
│      ── Confirmed assessments ─────────────────        │
│      • Pre-ECA Unit 1   (3 classes, 78 subs)  [edit]   │
│      • Quiz: Cells       (3 classes, 75 subs) [edit]   │
│                                                        │
│      ── AI suggestions ────────────────────────        │
│      • "Lab Safety Quiz" ↔ "Safety Quiz (Lab)"         │
│        2 classes  · 88% match   [Confirm] [Reject]     │
│      …                                                 │
│                                                        │
│  ▾ 8th Grade Science B  …                              │
└────────────────────────────────────────────────────────┘
```

Creating a class group: dialog with name + multi-select of the teacher's classes (reuse `CourseMultiSelect`). Editing lets you rename and add/remove classes.

"Find equivalent assessments" runs the AI matcher against assignments in the group's classes that aren't already in a confirmed assessment-group. Results render inline with Confirm / Reject buttons. Confirming creates/extends an `assignment_groups` row scoped to that class group.

### Where class groups are used elsewhere

- **Analytics → Compare classes**: add a "Class group" picker that pre-selects the group's classes (and, when an assessment is also chosen, lets you pick a confirmed assessment inside that class group).
- **Assignments page** suggestion banner: keep it but only fire suggestions for assignments whose course belongs to a class group.

## Database changes

**New table** `class_groups`
- `id uuid pk`, `teacher_id uuid`, `name text`, `created_at`, `updated_at`
- RLS: teacher owns

**New table** `class_group_courses` (membership)
- `class_group_id uuid`, `course_id uuid`, `teacher_id uuid`
- PK `(class_group_id, course_id)`, RLS: teacher owns

**Alter** `assignment_groups`
- Add `class_group_id uuid` (nullable for back-compat, but new groups will set it).

**RPCs (new / replace):**
- `create_class_group(_name, _course_ids[])` → uuid
- `update_class_group(_id, _name, _course_ids[])`
- `delete_class_group(_id)` — sets `assignment_groups.class_group_id = NULL` for its assessment groups (configurable; see open Q below)
- `list_class_groups()` → groups with course names, assessment-group counts, suggestion counts
- **Replace** `suggest_assignment_groups()` with `suggest_assignment_groups_in_class_group(_class_group_id uuid)` — same fuzzy / similarity logic but restricted to assignments belonging to that class group's courses, excluding any already in a confirmed `assignment_groups` row.
- `apply_assignment_group(...)` gains a `_class_group_id` parameter so new assessment groups are scoped.

The existing trigram-based candidate generation stays as the cheap first pass. AI only runs on borderline pairs (similarity 0.45–0.85) within a class group, via a new edge function:

**Edge function** `match-assessments-in-group`
- Input: `class_group_id`
- Pulls candidate assignment pairs (trigram similarity in the borderline band) from the group's classes.
- Calls Lovable AI Gateway (`google/gemini-2.5-flash`) with each pair's name + first ~10 question stems to decide "same assessment / different / unsure".
- Writes high-confidence matches as suggestions the user can confirm. (Persisted in a lightweight `assessment_match_suggestions` table so they survive page reloads, with `dismissed_at` for rejection.)

## Migration / back-compat

- Existing `assignment_groups` rows stay; their `class_group_id` is NULL until the user assigns them. The page surfaces these under a "Ungrouped legacy assessments" section with a "Move to class group →" action.
- Old RPC names kept as thin wrappers calling the new ones (so `Analytics.tsx` and `Assignments.tsx` keep working) until the next pass cleans them up.

## Files to add / edit

- **New** `supabase/migrations/<ts>_class_groups.sql` — tables, RLS, indexes, new RPCs, alter `assignment_groups`, suggestion table.
- **New** `supabase/functions/match-assessments-in-group/index.ts` — AI matcher (uses `LOVABLE_API_KEY`).
- **Rewrite** `src/pages/app/AssignmentGroups.tsx` — new two-level UI (class groups → assessments).
- **New** `src/components/ClassGroupDialog.tsx` — create/edit dialog.
- **Edit** `src/layouts/AppLayout.tsx` — rename nav label "Assignment groups" → "Class groups".
- **Edit** `src/pages/app/Analytics.tsx` — add Class-group picker to Compare-classes; keep current behavior when none is selected.
- **Edit** `src/pages/app/Assignments.tsx` — gate the suggestion banner on class-group membership.

## Open questions

1. When a teacher deletes a class group, should the assessment groups inside it be **deleted** too, or just **detached** (set `class_group_id = NULL`)? Detach is safer; I'll default to that unless you say otherwise.
2. Can a single class belong to **multiple** class groups? Useful if you split a course into "by period" and "by curriculum unit." I'll allow it (the membership table is many-to-many) — say the word if you'd rather enforce one-group-per-class.
3. AI matcher: run automatically when the teacher creates the class group, or only on explicit "Find equivalent assessments" click? Plan above assumes explicit click (cheaper, more transparent).
