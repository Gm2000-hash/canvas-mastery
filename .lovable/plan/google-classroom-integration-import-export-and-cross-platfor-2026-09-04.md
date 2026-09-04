# Google Classroom integration (import, export, and cross-platform conversion)

## Goal

Each teacher connects their own Google account once. After that, the Library becomes the hub between Canvas and Google: anything imported from either platform lands in the Library (with its origin remembered), and anything in the Library can be sent to either platform. Canvas → Library → Google Classroom (and the reverse) is the conversion path, so a Canvas quiz can become a Google Form quiz and a Classroom assignment can become a Canvas assignment.

## What teachers will see

**Settings → Google connection** (next to the Canvas card)
- "Connect Google" button opens Google's consent screen. Shows connected email, a Disconnect button, and the Classroom courses found.
- Teachers can be connected to Canvas, Google, or both.

**Library → Import → From Google Classroom** (alongside the existing Canvas import)
- Pick one or more Classroom courses. The import brings in:
  - Assignments and Materials: title + instructions become a library item; attached Google Docs / Slides have their text pulled in as the body; attached PDFs and files are saved into the library like Canvas files are today.
  - Attached Google Forms in quiz mode: questions, answer options, correct answers and points are converted into questions in the question bank, grouped as a question set named after the assignment.
- Re-running the import updates existing items instead of duplicating them.

**Export menu → "Send to Google Classroom…"** (added below "Send to Canvas…" everywhere the Export menu already appears: card menus, bulk bars, question bank popout)
- Pick the Classroom course, then per item choose how it arrives:
  - Readings / lesson plans / activities: Material or Assignment, with the content created as a Google Doc in the teacher's Drive and attached.
  - Question sets: Assignment with either a Google Form (quiz mode, auto-graded, points carried over) or a Google Doc (printable) — the teacher picks each time, remembered as the default for next time.
- Options: publish now vs. save as draft, due date (optional), points.
- Also a plain "Save as Google Doc" option (no Classroom) for teachers who just want the Doc.

**Repository view — "Where this lives"**
- Every library item and question set shows small badges: Canvas (course name, link) and Google Classroom (course name, link) with the last synced time, and where it originally came from.
- A Library filter "Source: Canvas / Google / Created here" and "Not yet on Canvas / Not yet on Google" to find items that still need converting.
- One-click "Convert": on a Canvas-sourced item, "Send to Google Classroom" is pre-selected and vice versa.

## Not included (later)
- Pulling Classroom grades/submissions into mastery analytics.
- Two-way live sync (edits in Google/Canvas do not flow back automatically; re-import updates).

## Technical details

**Google sign-in (custom per-teacher OAuth, since no Classroom connector exists)**
- You create one Google Cloud OAuth web client (I will give step-by-step instructions and the exact redirect URL to paste). Enable the Classroom, Drive, Docs and Forms APIs on that project; add the teachers as test users or publish the consent screen for your domain.
- Secrets requested via the secrets tool: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`; a generated `GOOGLE_TOKEN_ENC_KEY` for encrypting refresh tokens.
- Scopes: `classroom.courses.readonly`, `classroom.coursework.students`, `classroom.courseworkmaterials`, `drive.file`, `documents`, `forms.body`, `userinfo.email`.
- New table `google_credentials` (teacher_id, email, refresh_token_ciphertext, scopes, connected_at) — service-role only, no anon/authenticated grants, RLS enabled. Mirrors how `canvas_credentials` is handled; status exposed via an RPC like `get_canvas_connection_status`.
- Edge functions: `google-oauth-start` (builds consent URL with a signed state), `google-oauth-callback` (exchanges code, encrypts and stores refresh token, redirects back to `/app/settings#google`), `google-disconnect` (revokes + deletes). A shared `_shared/googleAuth.ts` mints short-lived access tokens from the refresh token on each call.

**Repository / cross-links**
- New table `resource_links` (id, teacher_id, library_item_id nullable, question_set_key nullable, platform `canvas|google_classroom|google_drive`, external_course_id, external_item_id, external_type, url, direction `imported|exported`, synced_at). Owner-scoped RLS + grants. Existing `library_items.canvas_*` columns are backfilled into this table and kept in sync; new Google imports/exports write here. Unique on (teacher_id, platform, external_type, external_item_id).
- Library queries join `resource_links` to render the badges and the source/destination filters.

**Import**: `google-classroom-import` edge function — lists `courses`, `courseWork` and `courseWorkMaterials`; for each attachment: Docs/Slides → text via Docs/Slides API (reuse the Docs-JSON → text approach from `import-google-link`), Drive files → downloaded into the `library-files` bucket under `${teacherId}/google/...`, Forms → `forms.get` mapped to `quiz_questions` (multiple choice, checkbox, short answer, paragraph; correct answers from `correctAnswers`, points from `grading.pointValue`), then queued for standards/DoK tagging like Canvas imports. Upserts by external id.

**Export**: `google-classroom-push` edge function taking the same payload shape as `canvas-push-resource` (title, html, questions, target). Docs are created via Docs API `documents.create` + `batchUpdate` built from the existing `ExportResource` blocks (new `src/lib/export/gdocs.ts` converter, no HTML intermediate); Forms via `forms.create` + `batchUpdate` with `quizSettings.isQuiz=true` and `correctAnswers`/`pointValue`; then `courseWork.create` / `courseWorkMaterials.create` with the Doc/Form attached (`shareMode: STUDENT_COPY` for Docs when set as assignment). Writes a `resource_links` row.

**UI**
- `Settings.tsx`: Google connection card. `ExportMenu.tsx`: new `google` format and `PushToGoogleClassroomDialog.tsx` (course picker via `google-classroom-list-courses`, per-item target, Form/Doc choice, publish/draft, due date). Library import dialog gains a Google Classroom tab. `LibraryItemCard` / question drawer show platform badges from `resource_links`; Library filter bar gets source/destination filters.
- Existing Canvas push/import functions updated to write `resource_links` so badges are consistent for both platforms.
