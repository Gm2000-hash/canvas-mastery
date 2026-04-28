# Invite-Only Access

Right now anyone who finds the app URL can sign up. We'll restrict signup so a new teacher can only create an account if they have a valid invitation code that you (or another existing teacher/admin) issued.

## How it will work for users

1. **You** open a new "Invitations" page in Settings, click **"Create invite"**, optionally type a note ("Jane from math dept") and an expiration, and get back a one-time code like `KX4P-9MTR-LZ8A`.
2. You share that code with the person you want to invite (email, Slack, etc.).
3. They go to the signup page. There's now a required **"Invitation code"** field above email/password.
4. If the code is valid, unused, and not expired → account is created and the code is marked as used. If not → signup is blocked with a clear error.
5. Existing users sign in normally — nothing changes for them.

You stay in control: only people you invite can join.

## What gets built

**Database (new)**
- `invitations` table: `code`, `created_by` (teacher who issued it), `note`, `expires_at`, `used_by`, `used_at`, `revoked`, timestamps.
- RLS: teachers can see/create/revoke only their own invites. Nobody can read by `code` directly from the client.
- `redeem_invitation(_code, _user_id)` SECURITY DEFINER RPC: validates the code (exists, not used, not revoked, not expired), marks it used, returns success/failure. Called server-side only.
- `create_invitation(_note, _expires_at)` RPC: generates a random unique code and inserts the row for the calling teacher.

**Edge function (new): `signup-with-invite`**
- Accepts `{ code, email, password, displayName }`.
- Validates the invite code first (using service role).
- If valid, creates the auth user via admin API, then calls `redeem_invitation` to atomically mark the code used.
- If user creation succeeds but redemption fails (race), deletes the user and returns an error.
- Returns success → frontend then signs the user in.
- Deployed with `verify_jwt = false` (public endpoint).

**Frontend changes**
- `src/pages/Auth.tsx`: add **Invitation code** field to the signup tab (required). Signup now calls the `signup-with-invite` edge function instead of `supabase.auth.signUp` directly. Sign-in tab unchanged.
- `src/pages/app/Settings.tsx` (or new `Invitations.tsx` linked from Settings): new section listing your invitations with status (Unused / Used by X on date / Expired / Revoked), a "Create invite" button, copy-to-clipboard, and a "Revoke" action for unused codes.
- Disable Google OAuth signup button on the auth page (or hide it) — since OAuth bypasses the invite check. We can re-enable it later with a different flow if you want.

**Bootstrap**
- Your existing account is already created, so it's automatically grandfathered in. No migration needed for current users.
- We'll seed one starter invite for you so you can test the flow end-to-end immediately.

## Things worth knowing

- **Codes are single-use** by default. If you want multi-use codes (e.g. one shared link for a whole department), say so and I'll add a `max_uses` field.
- **No expiration by default** unless you set one when creating the invite.
- **Google sign-in will be disabled** for new accounts because it skips the invite gate. Existing Google users (if any) keep working. If you'd rather keep Google enabled, we'd need a slightly different flow (post-signup invite redemption + delete account if missing).
- This does **not** add admin roles — every teacher can issue invites to grow the network. If you want only *you* to be able to invite, tell me and I'll lock invite creation to a specific user ID or add a proper admin role table.

Want me to proceed as-is, or adjust any of those?