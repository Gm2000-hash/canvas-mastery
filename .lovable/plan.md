# Persist Canvas sync across navigation

Right now, "Sync now" lives entirely inside `Dashboard.tsx` as local React state. The `supabase.functions.invoke("canvas-sync")` promise is awaited by the Dashboard component — the moment you navigate away, the component unmounts, the awaiting code is orphaned, and the spinning indicator disappears. The sync itself (running on the server) keeps going, but the UI loses all awareness of it.

We'll lift sync state to a global context so it survives navigation, and show a sticky status indicator in the app shell.

## What you'll see

- Click **Sync now** on the Dashboard → the button shows "Syncing…" as it does today.
- Navigate to Courses, Review, Settings, anywhere → a small **"Syncing Canvas…"** pill appears in the top-right of every app page (in the `AppLayout` header area) with a spinning icon.
- When the sync finishes (success or error) → a toast fires and the pill disappears. If you're back on Dashboard, the stats refresh automatically.
- Only one sync can run at a time — the Dashboard button (and the Import dialog's sync trigger) are disabled while a sync is in progress, no matter which page you're on.
- Same treatment is extended to the Import Courses dialog's selective sync (`canvas-sync` with body), so importing-then-navigating also persists.

## Technical plan

1. **New `SyncProvider` context** (`src/contexts/SyncContext.tsx`):
   - State: `syncing: boolean`, `startedAt: Date | null`, `label: string` (e.g. "Syncing Canvas…").
   - Method: `runCanvasSync(body?)` — sets `syncing=true`, fires `supabase.functions.invoke("canvas-sync", { body })`, awaits result independent of any component unmount, toasts on completion, clears state, and emits a `"canvas-sync:done"` `window` event so pages like Dashboard can refresh their counts.
   - Guard: if `syncing` is already true, second call is a no-op with an info toast.

2. **Mount provider in `AppLayout`** so it wraps all `/app/*` routes. Add a small **status pill** in the layout (top-right of the main area or sidebar footer) that renders only when `syncing === true`:
   ```
   [↻ Syncing Canvas…  started 14s ago]
   ```

3. **Refactor callers to use the context**:
   - `Dashboard.tsx`: replace local `syncing` state and `syncNow()` with `const { syncing, runCanvasSync } = useSync()`. Listen for `"canvas-sync:done"` to call `load()`.
   - `ImportCoursesDialog.tsx`: replace its local syncing state and direct `invoke("canvas-sync", { body })` call with `runCanvasSync({ course_ids })`. The dialog can close immediately after kicking off the sync; the pill keeps the user informed.

4. **Survive full page reloads (lightweight)**: persist `{ syncing, startedAt }` to `localStorage` keyed by user id. On `SyncProvider` mount, if a sync was started <10 minutes ago and is still flagged active, show the pill and poll `canvas_credentials.last_sync_at` every few seconds; when it advances past `startedAt`, clear the flag and toast "Canvas sync finished". This handles hard refreshes mid-sync. (Pure browser-side; no backend changes.)

5. **No edge function changes** — the server already runs sync to completion regardless of the client.

## Files

- New: `src/contexts/SyncContext.tsx`
- Edit: `src/layouts/AppLayout.tsx` (wrap with provider, add status pill)
- Edit: `src/pages/app/Dashboard.tsx` (use context)
- Edit: `src/components/ImportCoursesDialog.tsx` (use context)

## Out of scope

- Persisting AI **tagging** runs (`tag-standards`, `tag-question-standards`) the same way. Easy to add later using the same provider pattern if you want — let me know and I'll fold it in.