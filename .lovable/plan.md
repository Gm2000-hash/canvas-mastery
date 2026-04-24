## Why the tables look empty

I checked the database: every class has students and submissions, but **no assessments have confirmed standard tags yet**, and **no mastery snapshots exist**. The matrix RPC pivots on tagged standards — without tags, it returns zero rows, which causes the table to collapse to "No students match this filter."

So the data tables are technically rendering correctly given the inputs — there is just nothing to plot. But the UX is misleading and unhelpful.

## Fix

Update the per-class matrix view (`ClassMatrixView` in `src/pages/app/Analytics.tsx`) so the data table is always useful:

1. **Fetch the roster directly** from the `students` table (not just from the matrix RPC). Students will appear as rows even before any standards are tagged or any mastery is computed.
2. **Replace the misleading empty state.** When there are no confirmed standards yet, show the student list with a single "Status" column and a clear banner:
   - "This course has 0 confirmed standard tags. Tag assessments on **Tag Review** to populate the mastery matrix."
   - Inline link/button to the Tag Review page.
3. **When standards exist but mastery is zero**, render the matrix as today with em-dashes in the empty cells — this already works.
4. **Keep the existing student search / filter / sort controls** working against the roster, not just the RPC output.
5. **Fix two unrelated console warnings** flagged in the logs while I'm in the file:
   - Wrap `Skeleton` and `EmptyState` in `React.forwardRef` so Radix's Tabs/Card don't complain about missing refs.

## Files

- `src/pages/app/Analytics.tsx` — roster fetch, empty-state rebuild, filter/sort against roster.
- `src/components/ui/skeleton.tsx` — `forwardRef` wrap.
- The local `EmptyState` component in `Analytics.tsx` — `forwardRef` wrap.

## What you'll see after the fix

- Each class's table immediately shows every active student as a row.
- If no standards are tagged yet → one "Status" column + "Tag assessments to populate" CTA.
- If standards are tagged but mastery hasn't been computed yet → full column headers, em-dash cells.
- Once mastery snapshots exist → full color-coded matrix as designed.

No database changes required.
