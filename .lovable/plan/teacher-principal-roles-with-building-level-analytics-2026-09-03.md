# Teacher / Principal roles with building-level analytics

## Current state (verified)

- Roles today are `admin` and `teacher` only. You (gregmarsden2000) are the sole admin; the other three users are teachers. No cleanup is needed beyond making sure nobody else can be granted admin.
- Roles are granted only from the Admin page; the sign-up form has no role choice.
- There is no "school" concept. The Department dashboard already has cross-teacher, subject-scoped analytics (overview, standards, classes, students, assessments, report builder) — the building view will be built on the same data pipeline, widened from "one subject" to "one school, any filter".

## What you'll get

### 1. Roles: Teacher, Principal, Admin (you only)
- Sign-up form gets an "I am a..." choice: **Teacher** or **Principal**, plus a **School** field (free-text with suggestions from schools already entered).
- Teachers are active immediately, exactly as today.
- Principals are created as **pending**: they sign in and see a "Waiting for admin approval" screen with only Settings available. You approve or decline them from the Admin page; approval turns on the principal tools, decline converts them to a teacher.
- Admin page: "Admin" grant/revoke buttons removed from the UI and blocked in the database for everyone except your account. Admin page shows the pending-principal queue and lets you change any user's role or school.
- Settings: School field for everyone (editable); role shown read-only.

### 2. Principal experience (analytics only)
Sidebar for principals: **Dashboard, Building Analytics, Settings**. No Classes, Canvas, Library, Curriculum or Department.

**Building Analytics page** — a filter bar plus a results area:
- Filters (all combinable): School year, Teacher(s), Subject(s), Grade level(s), Course(s), Student search. Filters cascade (picking a teacher narrows courses, etc.).
- "Break down by" selector: **Teacher, Subject, Grade, Course, Student, Standard** — pick one or two dimensions (e.g. Teacher × Grade, Subject × Standard).
- Views: overview tiles (teachers, classes, students, avg mastery, % proficient), Basic/Proficient/Advanced distribution, mastery trend over time, and a sortable breakdown table for the chosen dimensions with CSV export.
- Drill-down: click a teacher → their courses; click a course → its students/standards; click a student → their history across all courses.
- Student privacy identical to teachers: 6-digit codes by default, PIN-gated "reveal names" (principal sets a PIN at onboarding like everyone else).
- Reuses the existing chart/report components from the Department page where they fit.

### 3. Dashboard for principals
Replaces class tiles with building-level headline numbers and a link into Building Analytics.

## Technical details

**Database (one migration)**
- `app_role` enum gains `principal`.
- `profiles` gains `school text`; new `schools` table (id, name) for suggestions; teachers/principals reference a school by name via profiles.
- New `principal_requests` (user_id, school, status pending/approved/declined, decided_by, decided_at) + RLS: user sees own row; admin sees/updates all.
- `user_roles`: trigger that rejects inserting `admin` for any user other than your account; existing "grant role" policies restricted so only admins can write, and only `teacher`/`principal` values.
- `handle_new_user` / `signup-with-invite`: store school + requested role from sign-up metadata; insert `teacher` role, or `principal_requests` row for principals (no role until approved).
- New `approve_principal(_user_id, _approve boolean)` (admin-only, security definer).
- New security-definer RPCs, all gated on `has_role(auth.uid(),'principal')` and scoped to `profiles.school = principal's school`:
  - `building_scope_courses(_filters jsonb)` — resolves teacher/subject/grade/course/year filters to a course set (mirrors `department_scope_courses`).
  - `building_overview`, `building_distribution`, `building_trend`, `building_breakdown(_dims text[], _filters)`, `building_student_history(_student_id)`.
  - `building_filter_options()` — teachers, subjects, grades, courses at the school for the filter bar.
  - `reveal_building_identities` — PIN-verified, logs to `identity_reveals`, same pattern as `reveal_student_identities`.
- Existing teacher RLS is untouched; principals reach teacher data only through these functions.

**Frontend**
- `useIsAdmin` → `useRole()` returning `{ isAdmin, isPrincipal, isTeacher, pending }`.
- `AppLayout`: role-aware nav lists; principal routes guarded; pending principals routed to `/app/pending`.
- New pages: `src/pages/app/BuildingAnalytics.tsx`, `src/pages/app/PendingApproval.tsx`; new components under `src/components/building/` (FilterBar, BreakdownTable, DrillDown).
- `Auth.tsx`: role + school fields; `Settings.tsx`: school field; `Admin.tsx`: pending queue, role/school editing, admin buttons removed.
- `Dashboard.tsx`: principal variant.

**Out of scope / notes**
- Existing users get school = empty until they fill it in Settings; you can also set it from the Admin page. Principal analytics only include teachers whose school matches, so this should be filled in first.
- No Canvas connection is required for principals.
