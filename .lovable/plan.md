
## Mastery Connect Integration

A new "Mastery Connect" page where you map this app's entities (standards, assessments, students, classes) to their Mastery Connect (MC) equivalents, then export CSV files you can upload to MC (or hand to your district for SFTP ingest).

No live API calls — Mastery Connect doesn't expose a public write API. CSVs are the realistic, today-it-works path.

### What you'll see in the app

**Sidebar:** new "Mastery Connect" entry under Settings, route `/app/mastery-connect`.

**Page layout:** four mapping tabs + an Export tab.

```text
[ Standards ] [ Assessments ] [ Students ] [ Classes ] [ Export ]
```

1. **Standards tab** — every standard tagged on your assignments, with a text field for the matching MC standard code. "Import MC standards CSV" button bulk-fills mappings by code.
2. **Assessments tab** — Canvas assignments (and Assignment Groups, for cross-section quizzes) on the left, MC tracker/assessment ID + name on the right. Filter by class.
3. **Students tab** — your students (real names visible to you only) ↔ MC student ID / SIS ID. Bulk import via CSV.
4. **Classes tab** — Canvas courses ↔ MC tracker/section ID + name.
5. **Export tab** — pick a class + date range + export type, click Generate, get a downloadable CSV. Three formats:
   - **Per-student mastery by standard** — one row per student × standard with mastery score and mastered flag, MC standard codes substituted in
   - **Item analysis** — one row per student × question with correct/incorrect, with MC standard codes attached
   - **Assessment scores** — one row per student × assessment with score, %, and mastery flag

Unmapped entities are flagged with a warning badge in the export preview so you can fix mappings before downloading.

### Technical details

**New tables (migrations):**

- `mc_settings` (teacher_id pk, default_mc_org_id text, last_export_at timestamptz)
- `mc_standard_mappings` (id, teacher_id, standard_id → standards.id, mc_code text, mc_name text, unique(teacher_id, standard_id))
- `mc_assessment_mappings` (id, teacher_id, assignment_id nullable, assignment_group_id nullable, mc_assessment_id text, mc_assessment_name text, check exactly one of assignment_id/assignment_group_id is set, unique partial indexes)
- `mc_student_mappings` (id, teacher_id, student_id → students.id, mc_student_id text, mc_sis_id text, unique(teacher_id, student_id))
- `mc_course_mappings` (id, teacher_id, course_id → courses.id, mc_tracker_id text, mc_tracker_name text, unique(teacher_id, course_id))
- `mc_export_log` (id, teacher_id, export_type text, course_id nullable, row_count int, created_at)

All tables get RLS `(teacher_id = auth.uid())` ALL policy, matching existing patterns.

**New files:**
- `src/pages/app/MasteryConnect.tsx` — tabs container
- `src/components/mc/StandardsMappingTable.tsx`
- `src/components/mc/AssessmentsMappingTable.tsx`
- `src/components/mc/StudentsMappingTable.tsx`
- `src/components/mc/ClassesMappingTable.tsx`
- `src/components/mc/ExportPanel.tsx`
- `src/lib/mc-csv.ts` — pure CSV builders that take mapped rows + raw data and emit MC-shaped CSV strings; download via Blob (no edge function needed for export — the data already lives in tables you can query client-side under RLS)
- `src/components/mc/ImportMappingsCsvDialog.tsx` — shared CSV upload that pre-fills any of the four mapping tables by code/email/canvas_id

**Edited files:**
- `src/App.tsx` — add `<Route path="mastery-connect" element={<MasteryConnect />} />`
- `src/layouts/AppLayout.tsx` — add nav entry (icon: `Link2` or `ArrowRightLeft`) just above Settings

**Where the export data comes from (all already in the DB):**
- Mastery by standard → `mastery_snapshots` joined with `students`, `standards`, `mc_*_mappings`
- Item analysis → `question_responses` joined with `quiz_questions`, `question_standards`, mappings
- Assessment scores → `submissions` joined with `assignments`, `students`, mappings

Export runs as a single read-side query per format, formatted to CSV in the browser, downloaded as `mc-<type>-<class>-<date>.csv`. Unmapped rows are either skipped (with a count shown) or included with a blank MC column based on a toggle.

**Out of scope for this iteration:**
- Live MC API push (no public API exists)
- Auto-sync on a schedule
- SFTP delivery — can be layered on later via an edge function once you confirm a district SFTP target

### Acceptance

- All four mapping tabs persist edits with a single click (debounced upsert).
- CSV bulk-import for each of the four mappings works from a sample MC export.
- Each of the three export CSVs downloads with correct headers, no unmapped surprises (warnings shown first), and re-substitutes MC codes/IDs everywhere your app's IDs would appear.
- Sidebar link present; route protected behind existing auth.
