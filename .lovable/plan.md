# Editorial reskin: Landing + Dashboard

Goal: bring the Wix Leadsult feel (oversized editorial headline, full-bleed hero photo, white floating card, single warm CTA, generous whitespace, clean section rhythm) to **both** the public Landing page and the in-app `/app` Dashboard — while keeping StandardsTrack's existing palette and serif/sans pairing.

---

## 1. Shared visual language ("inspired by", not literal)

Keep the current indigo + peach palette. Borrow from the reference:
- **Oversized display headline** (clamp ~3rem → ~6rem), tight leading, slight letter-spacing reduction.
- **Full-bleed hero photo** (classroom / teacher at laptop) with a **floating white card** overlapping it that holds the headline + CTA.
- **One warm CTA** per hero (coral pill button — already our `--accent`).
- **Section rhythm**: each section gets a short eyebrow label (uppercase, tracked), a big heading, a one-paragraph lede, then content.
- **Whitespace**: bump vertical padding between sections to ~`py-20` on desktop.

No new colors or fonts required — uses existing tokens.

## 2. Hero image

Generate one classroom photo via the AI image gateway (Nano Banana Pro) and save it as `src/assets/hero-classroom.jpg`. Prompt aim: bright, modern classroom, teacher at a laptop with students working in soft focus, neutral palette so the coral CTA pops.

## 3. Public Landing (`src/pages/Landing.tsx`)

Replace the current peach-card / preview-card hero with the floating-card-on-photo layout, then re-rhythm the sections below.

```text
┌─────────────────────────────────────────┐
│ [pill nav: logo .......... Sign in / Get started] │
├─────────────────────────────────────────┤
│  ┌──────────────────┐                   │
│  │ Eyebrow          │  ← floating white │
│  │ Big headline     │    card overlaps  │
│  │ Sub-lede         │    full-bleed     │
│  │ [Start free →]   │    classroom photo│
│  └──────────────────┘                   │
└─────────────────────────────────────────┘
                ↓
   About → How it works → Features →
   Standards-mastery preview → Footer CTA
```

- Hero: photo behind, white rounded card (max-w ~xl) on the left at desktop / centered on mobile.
- Keep the existing standards-mastery preview component but move it down into a "See it in action" section.
- Add a closing full-width CTA band echoing the hero (warm paper bg + coral button).

## 4. In-app Dashboard (`src/pages/app/Dashboard.tsx`) — reskin + trim

### Trim & reorganize

Current modules and proposed treatment:

| Module | Action |
|---|---|
| Page header | Keep, restyle as editorial headline + lede |
| OnboardingChecklist | Keep, but **auto-collapse once complete** (already partially supported via `onboarding_dismissed_at`); render only when incomplete |
| "Finish setup" alert card | **Merge into OnboardingChecklist** — duplicate of same intent. Remove the standalone card |
| 4 stat cards | Keep, restyle as borderless tiles in a single editorial row with large display numerals |
| "Sync with Canvas" card | **Collapse into a small action chip** in the page header (icon + "Sync now · last synced 2m ago"). The full card disappears |
| Upcoming / Recent assignments | Keep, two columns, lighter card chrome (no border, just whitespace + subtle divider) |
| "Show getting started checklist" debug link | Keep (unchanged) |

Net effect: ~2 fewer cards, header becomes the hub.

### New layout

```text
┌─ Dashboard ───────────────────────────────────────┐
│ Eyebrow: YOUR CLASSROOM, AT A GLANCE              │
│ H1: Welcome back, Sam.                            │
│ Lede: Here's how your students are progressing.   │
│                              [⟳ Sync now · 2m ago]│
├───────────────────────────────────────────────────┤
│ [OnboardingChecklist — only if incomplete]        │
├───────────────────────────────────────────────────┤
│  Courses    Assignments    Tagged    Standards    │
│   12          184            96        327        │
│  (tile)      (tile)         (tile)    (tile)      │
├───────────────────────────────────────────────────┤
│ Upcoming assessments        Recent assessments    │
│ (list)                       (list)               │
└───────────────────────────────────────────────────┘
```

- Stat tiles: drop `Card` border, use `bg-card rounded-2xl p-6` with a hairline top accent bar in coral on hover.
- Assignment lists: keep `Card` shell but lighter — remove header border, use the "eyebrow + h2" pattern inside.
- Header sync chip: shows `syncing` spinner state from `useSync()` and is disabled when Canvas isn't connected (same logic as current button).
- Greet by first name pulled from `profiles` (already loaded in `load()` — extend the select to grab `display_name`/email fallback).

## 5. Files touched

- `src/assets/hero-classroom.jpg` (new — generated)
- `src/pages/Landing.tsx` (rewrite hero + section structure; sections below the hero stay functionally the same, just retypeset)
- `src/pages/app/Dashboard.tsx` (restructure as above; remove "Finish setup" card; remove "Sync with Canvas" card; add header sync chip; restyle stat tiles)
- No changes to `index.css` tokens — uses existing palette.
- No backend / SQL changes.

## 6. Out of scope (to keep this focused)

- Other in-app pages (Classes, Assignments, Department, etc.) — you mentioned walking through every page; we'll do those one at a time after this lands.
- The Department data attribution issue from the previous thread — paused per your last message; can resume separately whenever you're ready.
- No changes to typography stack or color tokens.

Approve and I'll implement.
