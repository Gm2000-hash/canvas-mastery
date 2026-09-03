# Default science classes to NGSS, everything else to Idaho state standards

## What is happening

On `/app/classes`, the framework badge on each tile comes from the `analytics_class_breakdown` database function. That function only knows a class's framework when the class has been tagged with a discipline. For untagged classes it hard-codes `'STATE'`, so every untagged class shows "State" — including all of your science sections (confirmed: only one science course is tagged, the rest have no discipline and fall through to "State").

The same "State"/"CUSTOM" fallback is baked into a few other places, which is why science keeps drifting away from NGSS:
- Auto-created disciplines (Settings save and Department "Join") are inserted with `framework: "CUSTOM"`.
- The Settings "Add discipline" form pre-selects "State standards" regardless of subject.

## Change

Introduce one rule, used everywhere: **Science defaults to NGSS; every other subject defaults to State (Idaho)**. A tagged class always keeps whatever framework its discipline has; the rule only applies when nothing has been chosen.

1. **Shared rule** — add `defaultFrameworkForSubject(subject)` to `src/lib/frameworks.ts` (`Science -> NGSS`, otherwise `STATE`).
2. **Class tiles** — update `analytics_class_breakdown` so untagged classes fall back to the teacher's default subject (profile / default discipline) and derive the framework with the same rule (`CASE WHEN subject = 'Science' THEN 'NGSS' ELSE 'STATE'`). Science tiles will then read "Science · NGSS"; math/ELA/etc. read "State".
3. **Auto-created disciplines** — Settings save and Department "Join" use the rule instead of `"CUSTOM"`, with `state = 'ID'` (teacher's profile state) for non-national frameworks.
4. **Settings form** — "Add discipline" pre-selects the framework from the chosen subject (NGSS when Science is picked), still editable.
5. **Data cleanup (one-time)** — switch the existing `Science · grade 8 · ID · CUSTOM` discipline (no courses attached) to NGSS so it doesn't shadow the NGSS one.

## Technical details

- Migration: `CREATE OR REPLACE FUNCTION public.analytics_class_breakdown(...)`, replacing `COALESCE(td.framework, 'STATE')` with a fallback chain: course discipline -> teacher default discipline -> `profiles.default_subject` + subject-derived framework. Same edit applied to `department_scope_courses` if it carries the same `'STATE'` coalesce, so Department views agree with the tiles.
- Frontend files: `src/lib/frameworks.ts`, `src/pages/app/Settings.tsx`, `src/pages/app/Department.tsx`, `src/pages/app/ClassesHub.tsx` (badge fallback uses the shared rule when the RPC returns no framework).
- No change to how explicitly tagged classes behave; the course-level discipline picker on each tile still overrides the default.
