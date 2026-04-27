# Pseudonymize Student Identities + Reveal Toggle

Real student names and emails will move out of the main `students` table into a locked-down identity table. The app shows pseudonyms ("Student 014") everywhere by default; a per-page toggle reveals real names on demand and logs the access.

## Database migration

**New table `student_identities`** (real PII, isolated):
- `student_id` (PK, FK → students.id), `teacher_id`, `real_name`, `real_sortable_name`, `email`, `canvas_user_id`, timestamps
- RLS: no direct SELECT/UPDATE/DELETE from clients. Only the `reveal_student_identities` RPC (security definer) can read it. Inserts allowed only via service role (edge function).

**Modify `students` table**:
- Add `pseudonym_seq int` (per-teacher sequence) and `pseudonym text` (e.g. "Student 014").
- Backfill: copy current `name`/`email`/`canvas_user_id` into `student_identities`, then overwrite `students.name` and `students.sortable_name` with the pseudonym, null out `students.email`.
- Keep `canvas_user_id` on `students` for sync matching (it's an opaque integer, not PII on its own — happy to also move it if you prefer; flagging as a small trade-off).

**New table `identity_reveals`** (audit log):
- `id`, `teacher_id`, `course_id`, `revealed_at`, `reason text`, `student_count int`
- RLS: teacher can SELECT/INSERT their own rows.

**New RPC `reveal_student_identities(_course_id uuid, _reason text)`**:
- Security definer, returns `(student_id, real_name, real_sortable_name, email)` for that course.
- Inserts a row into `identity_reveals` on every call.

**Add to `teacher_settings`**:
- `pseudonym_style text default 'numeric'` ('numeric' | 'initials' | 'handle')
- `reveal_default boolean default false` (if true, toggle starts on)

## Edge function update

`supabase/functions/canvas-sync/index.ts`:
- On upsert of a student, write real name/email/canvas_user_id to `student_identities` (service role).
- For `students`, generate or reuse `pseudonym_seq` per teacher and store `pseudonym` as `name` and `sortable_name`.
- New students get the next `pseudonym_seq` for that teacher.

## Frontend

**Hook `src/hooks/useRevealedNames.ts`**:
- `useRevealedNames(courseId)` → `{ revealed, names: Record<studentId, string>, toggle(reason?) }`
- When toggled on, calls the RPC, caches result in memory for the page session, never persists to localStorage.

**Component `src/components/RevealNamesToggle.tsx`**:
- Small switch + label "Show real names". On enable, opens a tiny dialog asking for an optional reason (e.g. "Parent meeting"), then calls the hook.

**Pages updated**:
- `Mastery.tsx`, `Analytics.tsx` (student/class breakdowns), `Review.tsx`, `Courses.tsx` (student lists)
- Replace `student.name` rendering with `revealed ? names[id] ?? student.name : student.name` (the stored name is already the pseudonym).
- Add `<RevealNamesToggle courseId={courseId} />` in each page header.

**Settings → new "Roster Privacy" section**:
- Pseudonym style selector (Numeric "Student 014" / Initials "J.D." / Handle "blue-otter-14")
- "Default to revealed names" toggle (off by default)
- Recent reveals log (last 20 rows from `identity_reveals`)

## Trade-offs to confirm

1. **Search/sort** in tables will use pseudonyms unless reveal is on. Sorting alphabetically by real last name requires reveal.
2. **`canvas_user_id`** stays on `students` for sync matching. If you want stricter isolation, we can move it too — adds a join on every sync but possible.
3. **Existing data is migrated in place** — current real names get moved to `student_identities` and replaced with pseudonyms during the migration. No data loss.
4. Once enabled, **disabling pseudonymization later requires another migration** (we'd copy real names back into `students`).

Ready to implement on approval.