# Standard reading flow for every content area

## What changes for you

Every newly generated reading (Library "Generate a reading", curriculum "Regenerate reading", the Standards browser generator, and "Convert to textbook chapter") follows the same fixed flow, whatever the subject:

1. **Learning objectives** - exactly 3 ("Students will be able to ...")
2. **Introduction** - Section 1: what the concept is and why it matters
3. **Historical Context** - Section 2: the story of a real person tied to the idea (scientist, ruler, political figure, author, inventor, etc.) - who they were, what they did, and how it shaped the concept
4. **Key Elements** - Section 3 (and 4 if needed): the parts, steps or processes of the topic, explained in order
5. **In the Real World** - one real, documented case study or event
6. **Key Terms** - 4-12 terms, each with a plain-language explanation
7. **Reading Comprehension Questions** - exactly 5, spread across DOK 1-3, each with a teacher answer

Kept as light supporting pieces (they sit around the flow, not in it): the opening hook, "Before You Read" preview and guiding questions, one callout per section, 1-2 figure briefs, and the short end-of-chapter summary. If you would rather drop any of these, say so and they come out.

The reading viewer, editor, Markdown, Word/PDF and textbook exports already render these parts; headings are renamed to match ("Historical Context", "Key Terms", "Reading Comprehension Questions"). Existing saved readings are not changed unless you regenerate or convert them.

## Technical details

- `supabase/functions/_shared/textbook-chapter.ts`
  - `CHAPTER_RULES`: rewrite the numbered rules to the fixed flow above - `objectives` exactly 3; `sections` are exactly Introduction, Historical Context (biographical story of a named real person, with dates/places), Key Elements (steps/processes; may be split into two sections for long topics); `real_world` stays as the documented case study; `glossary` 4-12 entries titled "Key Terms"; `review_questions` exactly 5 (DOK 1, 1, 2, 2, 3). Keep the 7th-grade level line.
  - Add an optional `role: "introduction"|"historical_context"|"key_elements"` on each section in `CHAPTER_SCHEMA`; `normalizeChapterOut` keeps it (defaults by position) so the flow can be enforced and labelled.
  - `chapterToMarkdown`: headings "Key Terms" and "Reading Comprehension Questions"; `chapterToLegacy`: `intro` = hook + Introduction section, `explanation` = Historical Context + Key Elements paragraphs (unchanged logic, just relies on the new order).
- `src/modules/curriculum/lib/textbook-chapter.ts`: mirror the optional `role` on `ChapterSection`, same heading renames in `chapterToMarkdown`/`chapterToHtml`/`chapterToBlocks`; add `emptyChapter()` scaffolding with the three named sections.
- `supabase/functions/convert-reading-to-chapter/index.ts`: prompt tells the AI to reorganise existing content into the fixed flow and to add a Historical Context section and 5 questions if missing.
- `supabase/functions/generate-reading-insert/index.ts`: add `historical_context` as an insertable section kind.
- `src/modules/curriculum/components/textbook/ChapterViewer.tsx` and `ChapterEditor.tsx`: show the role as a small badge on sections, rename the glossary/review headings, cap review questions guidance at 5 in the editor hint.
- `src/components/library/GenerateContentDialog.tsx`: update the reading description text to list the new flow.
- Redeploy `generate-library-content`, `generate-curriculum-reading`, `generate-content`, `convert-reading-to-chapter`, `generate-reading-insert`; typecheck with tsgo and deno check; generate one reading in the Library to confirm the section order.
