# First-login onboarding nudge

New teachers (especially friends invited by code) hit the dashboard cold and have to figure out the order of operations themselves: pick a discipline → connect Canvas → import courses → assign disciplines to courses. This adds a lightweight, dismissible 3-step checklist that walks them through exactly that sequence on the dashboard until they've completed it.

## What changes for the user

- After signing up and reaching `/app`, a **"Get started"** card appears at the top of the dashboard with three checkable steps:
  1. **Pick what you teach** → links to Settings → Disciplines tab; check turns green once they have at least one discipline.
  2. **Connect Canvas** → links to Settings → Canvas tab; check turns green once `canvas_credentials` is connected.
  3. **Import your courses** → opens the Import Courses dialog; check turns green once they have at least one non-hidden course.
- Each step shows a one-line "why this matters" under it.
- Once all three are done (or the user clicks "Dismiss"), the card disappears and never comes back.
- A small "Show getting started" link in the dashboard footer area lets them re-open it if they dismissed it accidentally.

## Technical approach

### State storage
- Add one column to `profiles`: `onboarding_dismissed_at timestamptz` (nullable). When the user dismisses or auto-completes, we set this. Card hidden whenever non-null.
- Step completion is **derived live** (no extra columns) by querying:
  - `teacher_disciplines` count for the user
  - `canvas_credentials` connected flag (already exposed via `get_canvas_connection_status` RPC)
  - non-hidden, non-archived `courses` count

### New component
`src/components/OnboardingChecklist.tsx`
- Card with three numbered rows, each row showing: status icon (circle / check), title, subtitle, action button.
- Loads all three signals in parallel on mount.
- Subscribes to a tiny refresh trigger (re-fetches when the dashboard regains focus / on a window-level "onboarding-refresh" event) so checks update immediately after the user completes a step in another tab.
- "Dismiss" button writes `onboarding_dismissed_at = now()` to profile.

### Dashboard integration
`src/pages/app/Dashboard.tsx`
- Renders `<OnboardingChecklist />` at the top, conditionally on:
  `profile.onboarding_dismissed_at == null`
- Footer link "Show getting started" clears `onboarding_dismissed_at` to `null`.

## Files

```text
supabase/migrations/<new>_onboarding_dismissed.sql       (new)
src/components/OnboardingChecklist.tsx                    (new)
src/pages/app/Dashboard.tsx                                (edit)
src/integrations/supabase/types.ts                         (auto)
```

## Notes

- No edge functions needed — pure client-side reads against existing RLS.
- The card is informational only; it never blocks navigation, so power users can still ignore it.
