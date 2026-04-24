# Standards Mastery Tracker for Canvas LMS

A web app that connects to your Canvas account, lets you tag assignments and individual quiz questions with multiple state standards (with AI-suggested tagging), and tracks each student's mastery growth over time. Designed to replace what Mastery Connect *should* do, without forcing anyone to recreate Canvas content.

## What it does

1. **Connect to Canvas** — each teacher pastes their personal Canvas API token once. The app pulls in their courses, students, assignments, and quiz results.
2. **AI-powered standards tagging** — for any assignment or quiz, the AI reads the content and suggests which state standards apply. You confirm/edit. For quizzes, it can tag *each individual question* with its own standards, so a 10-question quiz can feed mastery data into 5 different standards.
3. **Mastery tracking** — as Canvas scores sync in, the app computes per-standard mastery for every student (e.g. "Maria: 85% mastery on 7.RP.A.2 across 4 attempts"), using a configurable threshold.
4. **Growth over time** — charts show each student's progress on each standard across the year. Class-level heatmaps show which standards the whole class is struggling with.
5. **Reports** — exportable per-student and per-class mastery reports for parents, admin, and IEP/504 documentation.

## How users experience it

**Teacher onboarding (one time, ~3 min):**
- Sign up with email/password
- Paste Canvas API token (with screenshot-based instructions for Account → Settings → New Access Token)
- Pick state + grade + subject → app seeds the relevant standards
- Optionally add custom standards or district-specific ones

**Day-to-day:**
- Open the app → see all your Canvas courses
- Click an assignment → see AI-suggested standards → approve or edit
- Click a quiz → see each question with AI-suggested standards per question → approve or edit
- Sync button pulls latest Canvas scores
- Dashboard shows class mastery heatmap + individual student growth charts

## Standards source
- Seed common state standards (you'll tell us your state + subject + grade — e.g. "Texas TEKS 7th grade math" or "Common Core ELA 8")
- Allow manual entry / CSV upload for custom or district-specific standards
- Edit/disable any seeded standard

## What we're explicitly *not* building (yet)
- **No Mastery Connect push-back.** Mastery Connect's API is too limited to reliably write data into. The app replaces Mastery Connect for tracking; you'd still log into Mastery Connect only if district reporting requires it. (We can revisit this once the core works.)
- **No Canvas OAuth app.** Each teacher uses their own personal token — no district IT involvement needed.
- **Single-teacher mode first.** Each teacher's data is private to them. Multi-teacher/admin views can come later.

---

## Technical details

**Stack**
- Frontend: React + Vite + Tailwind + shadcn/ui (current project setup)
- Backend: Lovable Cloud (Supabase Postgres + Edge Functions + Auth)
- AI: Lovable AI Gateway (Gemini 3 Flash for tagging — fast and cheap, with structured output via tool calling for reliable standard codes)

**Auth**
- Email/password via Lovable Cloud (default). Can add Google sign-in later.
- All data row-level-secured per teacher (`teacher_id = auth.uid()`).

**Database schema (initial)**
- `profiles` — teacher info (name, state, default grade/subject)
- `standards` — seeded + custom standards (code, description, subject, grade, state, teacher_id nullable for shared seed rows)
- `canvas_credentials` — encrypted Canvas API token + base URL per teacher
- `courses` — synced from Canvas (canvas_course_id, name, teacher_id)
- `students` — synced from Canvas (canvas_user_id, name, course_id)
- `assignments` — synced from Canvas (canvas_assignment_id, type: assignment|quiz, name, course_id)
- `quiz_questions` — synced from Canvas quizzes (canvas_question_id, text, assignment_id)
- `assignment_standards` — many-to-many: assignment_id ↔ standard_id (with `ai_suggested` and `confirmed` flags)
- `question_standards` — many-to-many: quiz_question_id ↔ standard_id
- `submissions` — per-student per-assignment scores synced from Canvas
- `question_responses` — per-student per-question correctness (from Canvas Quiz Submissions API)
- `mastery_snapshots` — computed per-student-per-standard mastery score over time (for growth charts)

**Canvas integration**
- All Canvas calls go through a Supabase Edge Function (`canvas-sync`) so the token never touches the browser
- Token encrypted at rest using pgsodium or stored in Vault
- Endpoints used: `/api/v1/courses`, `/courses/:id/students`, `/courses/:id/assignments`, `/courses/:id/quizzes`, `/quizzes/:id/questions`, `/courses/:id/students/submissions`, `/quiz_submissions/:id/questions`
- Manual "Sync now" button initially; scheduled sync (cron) can come later

**AI tagging (`tag-standards` Edge Function)**
- Input: assignment/question text + teacher's state + subject + grade + the candidate standards list
- Uses Gemini 3 Flash with **tool calling for structured output** — model must return an array of `{standard_code, confidence, rationale}` from the candidate list (cannot hallucinate codes)
- Returns top 1–3 suggestions per item with confidence scores
- Teacher always confirms before suggestions count toward mastery

**Mastery calculation**
- Default: a student is "mastering" a standard when their average score across the last 3 attempts on items tagged with that standard is ≥ 80%
- Both threshold and window configurable per teacher
- Snapshot recomputed after each sync; previous snapshots kept for growth charts

**Initial scope / phased build**

Phase 1 (this build):
1. Auth + onboarding (state/subject/grade → seed standards)
2. Canvas token setup + course/student/assignment sync
3. Standards library (view seeded + add custom)
4. AI tagging for assignments (assignment-level)
5. Mastery dashboard (class heatmap + per-student per-standard view)

Phase 2 (next iteration after you try Phase 1):
6. Per-question tagging for quizzes (more Canvas API work — quiz submission question-level data)
7. Growth-over-time charts
8. CSV/PDF report export
9. Bulk-tag suggestions across many assignments at once

Let me know if you want me to adjust scope before I start building. Once you approve, I'll build Phase 1 end-to-end.