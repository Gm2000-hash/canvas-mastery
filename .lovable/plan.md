## Add Google sign-in to StandardsTrack

Enable teachers to create accounts and sign in with their Google account (in addition to email/password). This uses Lovable Cloud's managed Google OAuth — no Google Cloud setup, no client ID, no secrets needed from you.

### What you'll see
On the Auth page (`/auth`), above the email/password form on both the **Sign in** and **Create account** tabs:
- A **"Continue with Google"** button with the Google "G" logo
- A subtle **"or"** divider separating it from the email/password form

Clicking it sends the teacher to Google's account chooser, then back to `/app` (the Dashboard) once authenticated. New Google accounts auto-create a `profiles` row via the existing `handle_new_user` trigger, so the rest of the app (Settings, Canvas connect, sync, mastery) works the same regardless of how they signed in.

### Technical changes

1. **Run the Configure Social Login tool for Google.** This generates `src/integrations/lovable/` and installs `@lovable.dev/cloud-auth-js`. Lovable Cloud's managed credentials handle the OAuth flow — nothing for the teacher or you to configure.

2. **Update `src/pages/Auth.tsx`:**
   - Add a `handleGoogle()` handler that calls:
     ```ts
     lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/app` })
     ```
     handling `result.error` (toast) and `result.redirected` (return).
   - Add a `<Button variant="outline">` with the Google "G" SVG icon labeled **"Continue with Google"** at the top of each tab's `CardContent`.
   - Add an "or continue with email" divider below it.
   - Disable the button while `loading` is true.

3. **No database, RLS, or edge function changes** — the existing `handle_new_user` trigger already creates a profile for any new auth user (Google or email).

### Notes
- Teachers using Google still need to visit **Settings** to set their state/subject/grade and paste their Canvas token — Google sign-in only handles identity.
- Email/password remains available for teachers who prefer it or whose districts block Google sign-in.