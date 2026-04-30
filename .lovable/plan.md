## Goal

In the "Compare classes" pop-out (opened from the Classes page), update the mastery distribution bar chart so that:

1. The three bands are labeled **Basic**, **Proficient**, **Advanced** (instead of Below / Approaching / Mastered).
2. Each band keeps a distinct color (already 3 bars — keep red / amber / green).
3. Hovering a bar segment lists the student names that fall into that band for that class.

The chart already renders exactly 3 stacked/grouped bars per class via the `BANDS` constant, so no extra bars need to be removed — just relabeling and tooltip enrichment.

## Changes

### 1. SQL — return per-student names alongside the aggregates

Add a new RPC `analytics_compare_classes_students` (security definer, teacher‑scoped) that mirrors `analytics_compare_classes` but returns one row per student:

```
course_id, course_name, student_id, student_name, band, score
```

The `student_name` comes from `public.students.name` (already the pseudonym after import, so no privacy regression). Same source CTE as the existing function (submissions for assignment / group, latest mastery snapshot for standard) and the same band thresholds — except the threshold logic stays numeric; only the front-end label changes.

We keep the existing aggregate RPC unchanged so other callers/tables don't break.

### 2. Front-end — `src/pages/app/Analytics.tsx`

**Relabel `BANDS`** (keep keys, colors, and thresholds — only labels change):

```text
below       → "Basic (<60%)"
approaching → "Proficient (60–80%)"
mastered    → "Advanced (≥80%)"
```

Also update the table column headers (`Below` / `Approaching` / `Mastered` → `Basic` / `Proficient` / `Advanced`) and the CSV header row to match.

**Fetch per-student rows in `CompareView`**: in the same `useEffect` that calls `analytics_compare_classes`, also call `analytics_compare_classes_students` with the same args, and store a map:

```text
studentsByCourseBand: Map<courseId, { below: string[], approaching: string[], mastered: string[] }>
```

For the `split === "all"` and `split === "by_level"` modes we'll merge across courses into a single bucket per band.

**Custom Recharts tooltip**: replace `<ChartTooltip content={<ChartTooltipContent />} />` with a custom tooltip that, when the hovered payload corresponds to a band bar, renders:

```text
{ClassName} — {BandLabel}: {count}
• Student A
• Student B
…
```

Capped at ~12 names with "+N more" to keep the tooltip compact. For the `by_class` split (Avg %) we keep the existing simple tooltip behavior.

No changes needed to the dialog wrapper in `ClassesHub.tsx` — the chart lives inside `CompareView`.

## Technical notes

- Pseudonyms: `students.name` already reflects the user's pseudonymization preference, so no extra reveal logic is needed in the tooltip.
- RLS: new RPC is `SECURITY DEFINER` and filters every CTE by `auth.uid()`, matching the existing function.
- Performance: the student-level query is small (only the selected courses + one assignment/standard/group). One extra round-trip per chart render, gated by the same `canQuery` check.
- Backwards compatible: the old `analytics_compare_classes` RPC and `BANDS` keys (`below`/`approaching`/`mastered`) are preserved internally — only display strings change, so the CSV export and table reflow naturally.

## Files touched

- `supabase/migrations/<new>.sql` — add `analytics_compare_classes_students` RPC.
- `src/pages/app/Analytics.tsx` — relabel `BANDS`, table headers, CSV headers; fetch per-student rows; custom tooltip with student names.
