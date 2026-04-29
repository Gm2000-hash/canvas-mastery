## Multi-class analytics tracker

Add a new **Compare** tab to Analytics that lets the teacher pick several classes at once and view their performance on either an **assignment** or a **standard**, with three split modes:

- **All together** — one combined bar (or single value)
- **By class** — one bar per class
- **By mastery level** — bars split into Below (&lt;60%), Approaching (60–80%), Mastered (≥80%)
- **By class × mastery level** — both, rendered as grouped or stacked

The same multi-class picker is also added to the existing **Assessments** and **Standards** tabs so those tables can be filtered to an arbitrary subset of classes (today they only accept "all" or one course).

### UX layout (Compare tab)

```text
┌─ Compare classes ──────────────────────────────────────┐
│ Classes: [▼ Multi-select chips: Bio 7A, Bio 7B, …]     │
│ Scope:   ( ) Assignment  (•) Standard                  │
│          [▼ pick assignment / standard]                │
│ Split:   [All] [By class] [By level] [Class × level]   │
│ Chart:   [Grouped] [Stacked]                           │
├────────────────────────────────────────────────────────┤
│  ▇ ▇ ▇                                                 │
│  ▇ ▇ ▇   bar chart                                     │
│  ────────────────────                                  │
│  Bio 7A  Bio 7B  Bio 7C                                │
└────────────────────────────────────────────────────────┘
│  Summary table: class · n · avg % · % mastered          │
└────────────────────────────────────────────────────────┘
```

### Plan

1. **DB function** `analytics_compare_classes(_course_ids uuid[], _assignment_id uuid, _standard_id uuid)` — security definer, scoped to `auth.uid()`.
   - When `_assignment_id` is passed: aggregate `submissions.percentage` per class, plus a histogram into the 3 bands.
   - When `_standard_id` is passed: aggregate latest `mastery_snapshots.mastery_score` per class, plus the same 3-band histogram.
   - Returns one row per (course_id, band) with: course_name, n, avg_score, band, count.
2. **New `CompareView` component** in `Analytics.tsx`:
   - Multi-select class picker (checkbox popover, reusing the already-loaded `courses` list).
   - Scope toggle (Assignment / Standard) + searchable single-select for the chosen item.
   - Split toggle (All / By class / By level / Class × level).
   - Chart-style toggle (Grouped / Stacked) — only relevant for Class × level.
   - `recharts` `BarChart` with the right `dataKey`/`stackId` based on split mode; reuses `ChartContainer` styling.
   - Summary table beneath the chart.
   - CSV export of the visible rows.
3. **Extend Assessments tab** (`AssignmentsView`):
   - Add the same multi-class chip picker beside the search box; rows filter client-side by `course_id ∈ selected`.
4. **Extend Standards tab** (`StandardsView`):
   - Add the multi-class picker; pass `_course_ids` to a new overload of `analytics_standard_breakdown` (or filter client-side via `analytics_class_matrix` cross-class — simpler: just call `analytics_standard_breakdown` once per selected course and merge in the client, since the standards list is small).
5. **New shared component** `<CourseMultiSelect />` (in `src/components/CourseMultiSelect.tsx`) — checkbox-list inside a popover with "Select all / Clear" — used by all three places.
6. **Tab list** in `Analytics.tsx`: insert "Compare" after "Mastery by subject", icon `BarChartHorizontal` (lucide).

### Technical details

- Bands defined as a single client-side helper:
  ```ts
  const BANDS = [
    { key: "below",       label: "Below (<60%)",        min: 0,    max: 0.60, color: "hsl(0 72% 51%)" },
    { key: "approaching", label: "Approaching (60–80%)", min: 0.60, max: 0.80, color: "hsl(38 92% 50%)" },
    { key: "mastered",    label: "Mastered (≥80%)",      min: 0.80, max: 1.01, color: "hsl(160 84% 39%)" },
  ];
  ```
- The DB function bands rows server-side using the same thresholds so the histogram is computed once.
- For Class × level the chart uses `<Bar stackId={mode === "stacked" ? "a" : undefined} />` per band.
- All RPCs filter on `teacher_id = auth.uid()`; existing RLS continues to protect raw tables.
- No schema changes — no new tables, no migrations beyond the new function.

### Files touched

- **Migration**: new SQL file adding `public.analytics_compare_classes(...)`.
- **New**: `src/components/CourseMultiSelect.tsx`.
- **Edited**: `src/pages/app/Analytics.tsx` — add `<CompareView />`, new tab trigger, and multi-class picker on Assessments + Standards tabs.

No other files change. The feature is additive — existing single-course flows keep working unchanged.