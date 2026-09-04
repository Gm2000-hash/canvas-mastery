# Revise reading and lesson-plan generation criteria

## What changes for you

**Readings (everywhere they are generated)**
- The "Reading level" dropdown disappears from the Library "Generate a reading" dialog. Every reading is written at a 7th-grade reading level, regardless of the grade or standard chosen.
- Every reading gains a dedicated **"In the Real World"** section: a case study or an actual documented event (real place, real date, real people/organizations where possible) that illustrates the concept, followed by 1-2 sentences tying it back to the main idea. The AI is told not to invent events; if it cannot name a real one it must use a clearly labeled realistic case study instead.

**Lesson plans (everywhere they are generated)**
- Lesson activities follow the **Kolb experiential learning cycle** instead of 5E, in order:
  1. Concrete Experience - students do or observe something first-hand
  2. Reflective Observation - students discuss/journal what they noticed
  3. Abstract Conceptualization - the concept, vocabulary and models are named and explained
  4. Active Experimentation - students apply the idea to a new problem or design
- Each of those four sections (and every other section of the plan: objectives, materials, assessment, differentiation) includes a short **"Why this works" rationale** written by the AI explaining the instructional reasoning for that choice.
- The lesson plan editor shows the Kolb stage label and the rationale under each activity, so you can read or edit it.

## Where this applies

| Generator | Reading changes | Lesson plan changes |
|---|---|---|
| Library "Generate with AI" dialog | Remove level picker; 7th-grade level; add "In the Real World" section | Kolb sections + rationale in the Markdown template |
| Curriculum suite unit Lesson Planner | - | Kolb stage per activity + rationale field |
| Curriculum suite "Regenerate reading" | 7th-grade level; the narrative section becomes a real-world case study/event | - |
| Standards browser one-standard generator | 7th-grade level; real-world case study/event | Kolb + rationale |

Existing saved readings and lesson plans are not changed; only newly generated ones follow the new criteria.

## Technical details

- `src/components/library/GenerateContentDialog.tsx`: drop `READING_LEVELS`, the `level` state and the Select; stop sending `reading_level`.
- `supabase/functions/generate-library-content/index.ts`: remove `reading_level` from the schema; add a fixed "Write at a 7th-grade reading level (Flesch-Kincaid ~7)" line for `reading`; update `KIND_GUIDE.reading` to require an `## In the Real World` section before the comprehension questions; update `KIND_GUIDE.lesson_plan` to Objective(s), Standards, Materials, Concrete Experience, Reflective Observation, Abstract Conceptualization, Active Experimentation, Assessment, Differentiation, Extension - each section ending with an italic "*Why this works:*" rationale line.
- `supabase/functions/generate-lesson-plans/index.ts`: activity `type` enum becomes `"concrete_experience"|"reflective_observation"|"abstract_conceptualization"|"active_experimentation"`; add `rationale: string` to each activity and top-level `rationale: { objectives, materials, assessment, differentiation }`; prompt text describes Kolb and the rationale requirement.
- `supabase/functions/generate-content/index.ts`: same Kolb + rationale changes to `LESSON_SCHEMA` and prompt; reading prompt gains the 7th-grade level and a `real_world: { heading, paragraphs[] }` field with the real-event requirement.
- `supabase/functions/generate-curriculum-reading/index.ts`: 7th-grade level line; the `reading` block is redefined as the real-world case study/actual event (5-7 paragraphs) with `reading_title` naming the event.
- `src/modules/curriculum/pages/LessonPlanEditor.tsx` (and `RegenerateLessonDialog.tsx` where activity types are listed): `Activity` type gains optional `type` and `rationale`; render a stage badge and a collapsible/inline rationale text under each activity; the section rationales render as a small note under the matching field. Stored as JSON in the existing `activities` column, so no database migration.
- `src/modules/curriculum/components/CurriculumReadingViewer.tsx` and the standards-browser reading save path: if the response includes `real_world`, append it to `reading_paragraphs` under its heading so existing viewers/exports keep working without schema changes.
- Redeploy the four edge functions; typecheck with tsgo and deno check.
