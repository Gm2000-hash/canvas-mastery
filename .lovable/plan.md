# Why classes aren't showing up in Compare Classes

## Root cause

The Compare Classes dialog (`CompareView` in `src/pages/app/Analytics.tsx`) gates the **Classes** dropdown behind a **Content area** (subject) selector. The Classes list is computed as:

```text
subjectCourses = courses where courseSubjects[course.id] === selectedSubject
```

`courseSubjects` is built by joining `courses.discipline_id → teacher_disciplines.subject`. So a class only shows up if:

1. The user has picked a **Content area** at the top of the dialog, AND
2. The class has a **discipline tagged** on it (the little dashed "Set discipline" chip on the class card), AND
3. That discipline has a `subject` matching the picked content area.

Your friend almost certainly hasn't tagged disciplines on his classes yet, so the **Content area** dropdown shows "No subjects" and the **Classes** picker stays disabled with the placeholder *"Pick a content area first."* Importing the same assessment into both classes has no effect on this — the gate is purely about disciplines.

This is a poor UX: the dialog gives no hint about *why* nothing appears, and forces a workflow (tag disciplines first) that isn't obvious.

## Fix

Make Compare Classes work out-of-the-box, and only use the subject filter as an *optional* narrowing tool.

### 1. Don't gate the Classes picker on subject

In `CompareView`:
- Default the **Content area** to "All subjects" (no filter).
- Compute `subjectCourses` as: if no subject is picked, show all `courses`; otherwise filter by subject as today.
- Update placeholder for the Classes multi-select to just "Pick classes…".

### 2. Show a helpful empty state when no subjects exist

When `compareSubjects.length === 0`, instead of a disabled "No subjects" item, render a small inline hint under the Content area dropdown:

> *Tag disciplines on your classes (Classes page → "Set discipline") to filter by content area.*

Keep the dropdown usable with just an "All subjects" option.

### 3. Standards picker fallback

`standardOptions` currently filters by `subject` when one is selected. When subject is empty, it already loads all standards — that path stays. No change needed beyond the subject default.

### 4. Don't drop selected classes when subject changes to empty

The effect at lines 1218–1222 wipes `selected` when `subject` is empty. Change it to only prune selections when a subject is *actively chosen* and some selected classes don't match.

## Technical details

**File:** `src/pages/app/Analytics.tsx` (`CompareView`, ~lines 1176–1410)

- Add an explicit `"__all"` SelectItem labeled "All subjects" and treat it as no filter.
- `subjectCourses` becomes `subject && subject !== "__all" ? courses.filter(...) : courses`.
- Adjust the placeholder on `<CourseMultiSelect>` to "Pick classes…" unconditionally.
- Add a one-line muted hint below the subject Select when `compareSubjects.length === 0`.
- Remove the `if (!subject) { setSelected([]); return; }` line so changing subject back to "All" doesn't blow away the user's selection.

No database, RLS, or edge function changes are required.

## What your friend can do *right now* (no code change needed)

As an immediate workaround until this ships:
1. Go to **Classes**.
2. On each of the two class cards, click the dashed **"Set discipline"** chip and pick (or create) a discipline (e.g. *Science · 8 · IN*). Both classes need the **same subject**.
3. Reopen **Compare classes** — the subject will appear in *Content area*, and the two classes will show up in the *Classes* picker.
