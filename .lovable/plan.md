# Merge Question Bank into Standards

## Goal

Combine the Question Bank into the Standards page so teachers manage standards and explore the questions tagged to each standard in one place — using the cleaner Standards visual design as the host.

## Result

A single page at `/app/standards` with two tabs:

```text
Standards library
─────────────────────────────────────
[ Library ]  [ Questions ]
```

- **Library** (default): the existing Standards UI — coverage-by-subject cards, filters, the standards list, and "Add custom standard".
- **Questions**: the existing Question Bank UI — filter bar, standards tree with question counts, click-through to question detail sheet, "Import quiz scores", "Import CSV", and per-quiz results.

The "Question Bank" sidebar entry is removed; `/app/question-bank` redirects to `/app/standards?tab=questions` so existing links keep working. The active tab is reflected in `?tab=` so users can deep-link and the back button works.

## What to build

1. **Tab shell on Standards page** (`src/pages/app/Standards.tsx`)
   - Wrap the page in a `Tabs` component (existing shadcn `tabs.tsx`).
   - Header (`Standards library` + subtitle) stays on top, above the tabs, so the visual identity is preserved.
   - Tabs: `Library` and `Questions`. Sync value with `useSearchParams()` (`?tab=library|questions`, default `library`).

2. **Extract current Standards body into `<StandardsLibraryTab />`**
   - Coverage-by-subject card, filters, list, AddStandardDialog — all unchanged, just lifted into a child component inside the same file.

3. **Move Question Bank into `<QuestionsTab />`**
   - Move the full `QuestionBank` component logic into a new component used as the second tab. Cleanest path: rename `src/pages/app/QuestionBank.tsx` to `src/pages/app/standards/QuestionsTab.tsx` and export it as `QuestionsTab` (no behavioral changes — same RPC calls, same tree, same detail sheet).
   - Drop the page-level `h1` + subtitle from inside the tab (the parent page already shows them); keep its action buttons (`Import CSV`, `Import quiz scores`) inside the tab content so they're contextual.

4. **Routing & nav cleanup**
   - `src/App.tsx`: replace `<Route path="question-bank" element={<QuestionBank />} />` with `<Route path="question-bank" element={<Navigate to="/app/standards?tab=questions" replace />} />`. Remove the `QuestionBank` import.
   - `src/layouts/AppLayout.tsx`: remove the `Question Bank` nav item and the now-unused `Library` lucide import.

5. **Tile/link audit**
   - Search for any `/app/question-bank` links elsewhere (e.g., dashboards, onboarding) and update them to `/app/standards?tab=questions`.

## Out of scope

- No DB or RLS changes.
- No edge function changes.
- No redesign of Question Bank internals — just hosting it under the Standards page.
- Mobile/responsive behavior of the tabs uses shadcn defaults; no custom restyle.

## Files touched

- `src/pages/app/Standards.tsx` — add tabs, wrap existing UI as `LibraryTab`.
- `src/pages/app/QuestionBank.tsx` → moved to `src/pages/app/standards/QuestionsTab.tsx` (export renamed).
- `src/App.tsx` — redirect old route, drop unused import.
- `src/layouts/AppLayout.tsx` — remove nav entry + unused icon import.
- Any file linking to `/app/question-bank` — updated to the new query-param URL.
