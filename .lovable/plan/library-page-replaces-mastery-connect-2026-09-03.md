# Library page (replaces Mastery Connect)

A single "Library" page at `/app/library` that acts as the repository for everything the app imports or creates, private to each teacher.

## Page layout

```text
+------------------------------------------------------------------+
| Library                                                          |
| [ Search content...            ] [ Standard: any v ] [ Type v ]  |
+------------------------------------------------------------------+
| [img] Question bank | [img] Readings | [img] Activities | [img] Lesson plans |
|   214 items         |   12 items     |   8 items        |   5 items          |
+------------------------------------------------------------------+
| Results (when searching) or the selected tile's item list        |
+------------------------------------------------------------------+
```

- **Search bar (top):** free-text search across titles, body text, and question text, plus a standard picker (code/description) and an optional type filter. Results show all four content types with a type badge, matched standards, and an "open" action.
- **Four tiles** with a generated illustration each (question bank, readings, activities, lesson plans) and live item counts. Clicking a tile opens that section below.
- **Question bank section:** reuses the existing standards-tree question browser (the same component used on the Standards page), so imported Canvas questions appear here automatically.
- **Readings / Activities / Lesson plans sections:** item cards with title, standards, source badge (Uploaded / Created / AI / Canvas), and actions to open, edit, download, or delete. Each section has three "add" entry points:
  - **Upload** a file (PDF, DOCX, PPTX, images) with title + standards.
  - **Create** in-app with a rich text editor.
  - **Generate with AI**: pick standards, grade, and a few options (length, reading level, format); the result opens in the editor for review before saving.
- **Canvas import:** the Canvas sync gains an optional step that pulls course Pages and Files into the library (Pages become Readings; files land in Readings by default and can be re-filed as Activities/Lesson plans). Duplicates are avoided by Canvas id.

## Mastery Connect removal

- Page, route, and sidebar entry removed; the sidebar slot is replaced by "Library" (book icon). Saved sidebar orders that reference the old path are migrated to the new one.
- The Mastery Connect database tables are left in place (no data loss); they can be dropped later if you want.

## Technical details

**Database (migration)**
- `library_items`: `teacher_id`, `kind` (reading | activity | lesson_plan), `title`, `body` (rich text/markdown), `source` (upload | created | ai | canvas), `file_path`, `file_mime`, `canvas_course_id`, `canvas_item_id`, `canvas_item_type`, `grade`, `subject`, `search_tsv` (generated tsvector over title + body) with a GIN index; owner-only RLS; GRANTs to `authenticated` and `service_role`; `updated_at` trigger.
- `library_item_standards`: `library_item_id`, `standard_id`, `teacher_id`; owner-only RLS.
- Private storage bucket `library-files` with per-teacher folder policies (`teacher_id/...`).
- RPC `search_library(_q text, _standard_id uuid, _kind text)` returning unified rows across `library_items` and `quiz_questions` (joined via `question_standards`) so one query powers the search bar.

**Edge functions**
- `generate-library-content`: uses the shared OpenRouter helper; input = kind, standards, grade, options; output = title + markdown body + suggested standards.
- `canvas-sync`: add Pages (`/courses/:id/pages` + page body) and Files (`/courses/:id/files`, downloaded into the bucket) import, upserting on `(teacher_id, canvas_item_type, canvas_item_id)`. Runs only when the teacher enables "Import course materials" in the sync dialog.

**Frontend**
- New `src/pages/app/Library.tsx` with `LibraryTiles`, `LibrarySearch`, `LibraryItemList`, `LibraryItemEditor` (dialog with rich text + standards picker + file upload), and `GenerateContentDialog`.
- Question bank tile embeds the existing `QuestionsTab` component.
- Four tile images generated once and stored in `src/assets`.
- `App.tsx`: replace the `mastery-connect` route with `library`; redirect old URL to `/app/library`. `AppLayout.tsx`: swap nav entry and remap persisted order.
- Delete `src/pages/app/MasteryConnect.tsx` and any MC-only components/hooks.
