# Unify typography on Nunito Sans + improve readability

## What's happening today

- Tailwind is already wired so `font-sans` and `font-display` both resolve to **Nunito Sans** (`tailwind.config.ts`), and only Nunito Sans is loaded in `index.html`.
- The "different fonts" feel comes from two places:
  1. **`font-mono`** is used in ~50 spots — all standard codes (e.g. `8.RP.A.2`), keyboard hints (`<kbd>J</kbd>`), and OTP-style inputs. This is the second visible typeface.
  2. **Tiny text**: lots of `text-[9px]`, `text-[10px]`, and `text-xs` (264 occurrences) for badges, table headers, helper text — which reads as "cramped" rather than "different font," but contributes to the inconsistent feel.
- Body text inherits the browser default (16px) with no explicit size or line-height set in `index.css`.

## Goal

1. One typeface across the app: **Nunito Sans**. Standard codes keep a tabular look but in Nunito Sans, not a monospace font.
2. A small, consistent readability bump on dense UI (tables, badges, helper text) without blowing up the layout.

## Changes

### 1. Replace `font-mono` with a Nunito Sans tabular treatment
Standard codes (`8.RP.A.2`) still need to align in tables. Instead of swapping to a mono typeface, use Nunito Sans with `tabular-nums` + slight letter-spacing.

- Add a `.font-code` utility in `src/index.css`:
  ```css
  .font-code {
    font-family: 'Nunito Sans', system-ui, sans-serif;
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
    letter-spacing: 0.01em;
  }
  ```
- Find/replace `font-mono` → `font-code` across `src/pages/**` and `src/components/**` (codes, kbd hints, OTP input).
- Leave Tailwind's `font-mono` utility itself alone (no config change) so any third-party UI bits keep working.

### 2. Bump base readability
In `src/index.css` `@layer base`:
- Set `html { font-size: 16.5px; }` (a ~3% bump — feels noticeably more readable, doesn't break layouts).
- Set `body { line-height: 1.55; }` for body copy.
- Keep heading styles as-is (already Nunito Sans 700/900).

### 3. Raise the floor on tiny text
The `text-[9px]` and `text-[10px]` literals are too small. Replace with Tailwind's standard scale:
- `text-[9px]` → `text-[10px]` (badges that need to stay micro) **or** `text-xs` where space allows.
- `text-[10px]` → `text-xs` (12px) in body/table cells; keep `text-[10px]` only on tightly-packed badges.
- Sweep these files: `Analytics.tsx`, `Assignments.tsx`, `Review.tsx`, `Standards.tsx`, `StudentHistory.tsx`, `Courses.tsx`, `Settings.tsx`, `Dashboard.tsx`, `QuestionBank.tsx`, `MasteryDebug.tsx`, `Mastery.tsx`.

### 4. Tables & helper text
- In Analytics tables (rotated standard-code headers, breakdown tables), bump `text-[10px]` headers to `text-xs` and remove `font-mono` (now `font-code`).
- Helper/description paragraphs: ensure they're at least `text-sm` (already true in most pages — fix the few `text-xs` description lines on Review/Dashboard).

## Out of scope

- No font-loading changes — Nunito Sans is already the only Google Font loaded.
- No color, spacing, or component-shape changes.
- `font-mono` Tailwind utility is left in the config (safer; we just stop using it).

## Files touched

- `src/index.css` — add `.font-code`, bump base size + line-height.
- `src/pages/app/*.tsx` (Analytics, Assignments, Review, Standards, StudentHistory, Courses, Settings, Dashboard, QuestionBank, Mastery, MasteryDebug, Admin, AssignmentGroups) — `font-mono` → `font-code`, raise `text-[9px]`/`text-[10px]` where appropriate.
- `src/components/*.tsx` (BackfillReportDialog, InvitationsCard, others using `font-mono`) — same swap.
- `src/pages/Auth.tsx`, `src/pages/Landing.tsx` — same swap.

No DB, no edge function, no config changes.
