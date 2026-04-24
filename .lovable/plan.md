# Standards frameworks + multi-subject/grade teacher profile

The schema already supports multiple `(state, subject, grade)` rows per teacher via `teacher_disciplines`, but two things are missing:

1. There's no way to distinguish a **state's own standards** (e.g. *Idaho Science Standards*) from a **national framework** like *NGSS* or *Common Core* — they'd both seed under `state="ID"`, colliding.
2. The discipline form forces one grade and one subject at a time (and the dropdown only lists grades 6–8), even though the underlying table supports many rows.

This plan adds a **framework selector**, expands the picker to cover all K–12 grades + more subjects, lets teachers add **many grades and subjects in one shot**, and makes every discipline (and its standards library) **editable and removable**.

## What you'll see

### Settings → Disciplines (renamed: "What I teach")

A new compact form replaces the current 4-field row:

```text
Framework:  [ State standards (Idaho)  v ]   ← or "NGSS", "Common Core (CCSS)", "C3 (Social Studies)", "Custom…"
State:      [ ID v ]   (auto-hidden when framework is national)
Subjects:   [ ☑ Science ] [ ☐ Math ] [ ☐ ELA ] …   ← multi-select chips
Grades:     [ ☐ K ] [ ☐ 1 ] … [ ☑ 6 ] [ ☑ 7 ] [ ☑ 8 ] [ ☐ HS ] …   ← multi-select chips
                                              [ + Add disciplines ]
```

Clicking **Add disciplines** expands the cartesian product into one `teacher_disciplines` row per `(framework, state, subject, grade)` combo. So picking *NGSS · Science · 6,7,8* creates 3 rows.

Each existing discipline row gets an **Edit** action (pencil icon) that opens an inline form to change framework / state / subject / grade. The trash icon stays. The default-star stays.

### Standards library (Standards page)

- Filter chips at the top: **Framework** (All / NGSS / CCSS / State / …) and **Subject / Grade** quick filters.
- Each standard row shows a small framework badge ("NGSS", "ID", "CCSS") next to the state code.
- "Add custom standard" dialog gets the same framework picker.

### Seeding behavior

- **"Seed standards"** on each discipline row prompts the AI with the framework name so it returns the right code system (e.g. NGSS uses `MS-PS1-1`, Idaho Science uses `6.PS1.1`, CCSS uses `CCSS.MATH.7.RP.A.2`).
- Re-seeding the same `(framework, state, subject, grade)` combo is still skipped if a non-empty library already exists, but a new **"Re-seed (replace)"** option behind a confirm lets teachers nuke and rebuild a library if the AI got it wrong.

## Technical plan

### 1. Schema migration

- `teacher_disciplines`: add `framework text` (nullable). NULL/empty = state standards (legacy behavior). Allowed values surfaced in UI: `STATE`, `NGSS`, `CCSS_MATH`, `CCSS_ELA`, `C3_SS`, `AP`, `IB`, `CUSTOM`. Stored as plain text — no enum so future ones don't need a migration.
- `standards`: add the same `framework text` column.
- Backfill: leave both NULL — existing rows behave as "STATE" framework.
- Add a partial unique constraint on `teacher_disciplines (teacher_id, framework, state, subject, grade)` to prevent duplicate rows. (Drop and recreate if a non-frameworked dup somehow exists — current data in this project is small.)
- Update `get_effective_discipline()` to also return `framework` so taggers can use it.

### 2. `seed-standards` edge function

- Accept `{ framework?, state, subject, grade }`. Validate inputs.
- Build an AI prompt with framework-aware language:
  - `STATE` → current behavior, "official state standards for ${state}"
  - `NGSS` → "Next Generation Science Standards (national). Use codes like MS-PS1-1, HS-LS3-2, etc. Ignore state."
  - `CCSS_MATH`/`CCSS_ELA` → Common Core math/ELA codes.
  - `C3_SS` → C3 Social Studies framework.
  - `CUSTOM` → return clear error: custom libraries are added by hand.
- Skip-if-exists check uses framework too (`.eq("framework", framework ?? null)` with proper IS NULL handling).
- Insert rows include `framework`. For national frameworks, store `state` as the framework label (e.g. `"NGSS"`) so existing UI columns still render something readable, OR keep state as provided and rely on the framework column. Decision: **keep `state` as provided** (e.g. `"ID"` for an Idaho teacher seeding NGSS so they can still find it filtered by their state) and add the framework column.
- New optional `replace: true` flag triggers a delete-then-insert path (only deletes shared `teacher_id IS NULL` rows for that combo).

### 3. `tag-standards` and `tag-question-standards` edge functions

- When resolving the discipline, also pull `framework` from `teacher_disciplines`.
- When loading candidate standards, filter by `(state, subject, grade)` AND match framework: prefer rows where `framework` matches; if none, fall back to NULL-framework rows so legacy seeds still work.

### 4. UI

- `src/pages/app/Settings.tsx`:
  - Expand `GRADES` to `["K","1","2","3","4","5","6","7","8","9","10","11","12","HS"]` and `SUBJECTS` to add Science, Health/PE, World Languages, Visual Arts, Music, CTE.
  - Replace the single-pick add row with the multi-select form described above (framework + subjects + grades chips).
  - Add an **Edit** dialog/inline form for each discipline row.
  - Pass `framework` through to `seed-standards` invocations. Add a "Re-seed (replace)" menu item with a confirm.
  - Keep the legacy single-profile card but mark it "(legacy fallback)" since disciplines now drive everything.
- `src/pages/app/Standards.tsx`:
  - Show framework badge per standard.
  - Add framework + subject + grade filter chips at the top.
  - Update Add-Standard dialog to include framework picker.
- New shared constant file `src/lib/frameworks.ts` defining the framework options + display labels so UI and edge functions agree.

### 5. Files

- New: `supabase/migrations/<timestamp>_framework_column.sql` (add `framework` column to both tables, update `get_effective_discipline`).
- Edit: `supabase/functions/seed-standards/index.ts` (framework-aware prompt + skip + replace flag).
- Edit: `supabase/functions/tag-standards/index.ts` (carry framework through; filter candidates by framework with NULL fallback).
- Edit: `supabase/functions/tag-question-standards/index.ts` (same).
- Edit: `src/pages/app/Settings.tsx` (multi-pick form, edit row, framework picker).
- Edit: `src/pages/app/Standards.tsx` (framework badge + filters + add dialog).
- New: `src/lib/frameworks.ts` (shared framework metadata).

## Out of scope

- Deduping/merging existing seeded libraries across frameworks. If a teacher seeded "ID Science" before this change and re-seeds as "NGSS", they'll get both libraries side-by-side; they can delete the old one from the Standards page or use Re-seed (replace) on the original.
- Importing CSV libraries from third parties — still a future enhancement.