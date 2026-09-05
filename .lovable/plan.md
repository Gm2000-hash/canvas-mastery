# Textbook-style readings and a compiled digital textbook

Every reading — the Curriculum-suite lesson readings and the Library "reading" items — will follow one textbook-chapter structure, modeled on the features the UNC guide says students preview and study from (headings, bold vocabulary, figures, boxes, summaries, review questions, glossary) and the Pressbooks-style chapter shell from the UO toolkit (chapter opener, pop-up term definitions, chapter navigation). Chapters can then be compiled into a shareable in-app student book and pushed to Google Classroom or Canvas.

## 1. The chapter structure (applies to every generated reading)

```text
Chapter opener
  - Chapter number + title, 1-paragraph hook (phenomenon or question)
  - "Before You Read": preview of what the chapter covers, a prior-knowledge prompt
  - 2-3 Guiding Questions (each tied to a section heading)
  - Learning objectives
Numbered sections (3.1, 3.2, 3.3 ...)  — 3 to 5 per chapter
  - Heading phrased so it can be turned into a question
  - Paragraphs at a 7th-grade reading level, key terms bolded on first use
  - Callout boxes woven in: "Stop and Think", "Did You Know?", "Connect It"
  - Figures with numbered captions (Figure 3.1) and alt text
In the Real World  — case study or documented event (real place/date/people), 1 per chapter
Chapter Summary  — 4-6 bullet points, one per main idea
Review Questions  — 5-8 questions labeled by DOK (1-3), with an answer key for teachers
Glossary  — every bolded term with its definition
```

- Real-world examples: every chapter keeps its own "In the Real World" story; a compiled book additionally guarantees at least one or two longer case studies per unit/part (the AI is asked to make each chapter's case study distinct within the unit).
- Figures: the AI writes the figure spot, caption and an image description. Images are created on request (a "Generate image" button on each figure placeholder, or "Generate all figures" per chapter) so image credits are only spent when wanted. Teachers can also upload their own image into a figure.
- Reading level stays at 7th grade; standards codes are still cited; DOK labels stay on review questions.

## 2. Where readings are generated (all switched to the chapter structure)

- Library → "Generate a reading" (standards picker dialog)
- Curriculum suite → "Regenerate textbook reading" for a lesson, and unit-level auto-generation of readings
- Standards browser → generate a reading for one standard

The "Add paragraph / key term / objective" AI inserts in the reading editor gain "Add callout", "Add figure", "Add review question", and "Add section".

## 3. Upgrading existing readings (on demand)

- "Convert to textbook chapter" on any existing reading (Library card menu and Curriculum reading editor). The AI restructures the current text into the chapter format without losing content; the result opens for review before saving. Readings that were already converted show a "Chapter" badge.
- "Convert all readings in this unit" on a unit, running chapter by chapter with progress.

## 4. Chapter viewer and editor

- Reader view: sticky in-chapter table of contents, numbered section headings, styled callout boxes, figures with captions, bold glossary terms that show their definition in a pop-up on click/hover, collapsible review questions (answers hidden for students, visible to the teacher), "Previous / Next chapter" footer.
- Teacher editing keeps the existing per-item toolbar (add, delete, move up/down) and extends it to sections, callouts, figures, summary bullets, review questions and glossary entries.
- Word/PDF export and Google/Canvas pushes render the same structure (numbered headings, boxed callouts, captioned figures, summary, questions, glossary).

## 5. The digital textbook (in-app student book)

- New "Textbooks" area in the Curriculum suite: create a book (title, subject, grade, cover), then add chapters — either "Build from a subject" (pulls every unit and its lesson readings, units become Parts, lessons become chapters, in existing order) or pick individual readings from the Curriculum suite and Library. Chapters can be reordered and regrouped into Parts; chapter numbers (and figure numbers) update automatically.
- Front matter: cover, "How to use this book" page (built from the UNC active-reading strategies: preview, turn headings into questions, stop and summarize, review), table of contents.
- Back matter: combined glossary (A-Z, with the chapter each term comes from) and an index of standards covered per chapter.
- Publish / share link: a public read-only book at `/book/<token>` with Part/Chapter navigation, glossary pop-ups, a "resume where you left off" bookmark stored in the student's browser, and print-friendly styling. Existing shared-reading links keep working.

## 6. Push a book to Google Classroom or Canvas

- Send to Google Classroom: creates one Topic per Part and one Material per chapter (Google Doc), plus a "Table of Contents" material linking them; the teacher picks the course and whether to post now or as drafts.
- Send to Canvas: creates one Module per Part with one Page per chapter, plus a front-matter page; option to publish immediately.
- Pushed locations are recorded so the "Where this lives" badges and the Convert suggestion continue to work per chapter.

## Not included in this round

- Student accounts, reading-progress analytics or quiz grading inside the book
- Live two-way sync of edits already pushed to Google/Canvas (re-push replaces)
- Bulk auto-conversion of every existing reading (only on demand, per your choice)

## Technical details

- One shared TypeScript type `TextbookChapter` (`src/modules/curriculum/lib/textbook-chapter.ts`) with helpers: `chapterToMarkdown`, `chapterToHtml`, `chapterFromLegacyLesson`, `chapterFromMarkdown`, renumbering utilities, glossary merge.
  - Shape: `{ number?, title, hook, before_you_read: { preview, prior_knowledge_prompt, guiding_questions[] }, objectives[], sections: [{ number, heading, blocks: [{ type: "paragraph"|"callout"|"figure", ... }] }], real_world: { title, paragraphs[] }, summary[], review_questions: [{ question, dok, answer }], glossary: [{ term, definition }], standards[] }`.
- Storage: `curriculum_lessons.chapter jsonb` (legacy columns left intact and kept in sync by `chapterFromLegacyLesson` for readers/exports that still use them) and `library_items.chapter jsonb` (the markdown `body` is regenerated from the chapter JSON on save so existing exports, search and pushes keep working). `library_items.dok_levels` derived from review questions on conversion.
- New tables: `textbooks` (id, teacher_id, title, subject, grade, cover_url, is_published, share_token, created/updated) and `textbook_chapters` (id, textbook_id, part_title, sort_order, source `lesson|library_item`, lesson_id nullable, library_item_id nullable). RLS: owner CRUD; public read of published books via a SECURITY DEFINER RPC `get_shared_textbook(token)` returning the book plus resolved chapters (anon + authenticated grants, mirroring `get_shared_book`). GRANTs on both tables for `authenticated` and `service_role`.
- Edge functions: a shared prompt/schema module `_shared/textbook-chapter.ts` (JSON schema + house rules) used by `generate-curriculum-reading`, `generate-content` (reading branch), `generate-library-content` (reading branch), and a new `convert-reading-to-chapter` (input: legacy lesson fields or markdown; output: `TextbookChapter`). `generate-reading-insert` gains kinds `section`, `callout`, `figure`, `review_question`. Figure images via a new `generate-chapter-figure` using the existing image-generation path (same storage bucket rules as question images). Heavy model chain for chapter generation/conversion; everyday chain for inserts.
- Frontend: `ChapterViewer`/`ChapterEditor` components under `src/modules/curriculum/components/textbook/`; `CurriculumReadingViewer` renders `ChapterViewer` when `lesson.chapter` exists, otherwise the current five-section view plus a Convert button; `LibraryItemEditor` shows the chapter editor for converted readings. New pages: `TextbookBuilder` (list/create/arrange) and public `TextbookReader` at `/book/:token`; routes registered in `src/modules/curriculum/routes.tsx` and the dead-routes test updated.
- Export/push: `chapterToHtml` feeds the existing reading DOCX/PDF builders, `google-classroom-push` and `canvas-push-resource`; new `push-textbook` action in those functions creating Topics/Modules and recording `resource_links` per chapter (external_type `textbook_chapter`). Whole-book Word/PDF reuses the current per-discipline compiler extended with front and back matter.
