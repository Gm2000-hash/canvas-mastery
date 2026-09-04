# Admin-managed OpenRouter keys + cheaper model chains

## What you get

**Admin → "AI provider" card** (replaces the current balance-only card on `/app/admin`):
- Shows the active provider (OpenRouter or built-in Lovable AI), the OpenRouter balance, and which key is in use (masked, e.g. `sk-or-v1-…a9f2`) plus who saved it and when.
- **Enter a new OpenRouter key**: paste the key, it is validated live against OpenRouter (rejects invalid keys, shows the balance of the new key before saving), then saved encrypted. Takes effect for every teacher within a minute, no redeploy.
- **Remove key** button: falls back to the Lovable AI built-in provider (workspace credits) so AI never goes fully dark.
- Key history (last 5 keys, masked, with dates) so you can see when a key was swapped.

**Cheaper model chains** (same OpenRouter API, just different model order):
- Everyday: Gemini Flash-Lite → Gemini Flash → GPT-5.4-mini
- Bulk tagging (standards + DoK backfill): Gemini Flash-Lite → Qwen (cheap open model) → Gemini Flash
- Heavy jobs (ISAT exam, escape room, lesson plans): Gemini Pro → GPT-5.4 → Claude Sonnet
- When no OpenRouter key is set, the same tiers map to Lovable AI models (Flash-Lite / Flash / Pro).

Nothing to set up on your side: you only paste keys into the admin card. The bills for OpenRouter models land on whichever key is active.

## Technical

**Database** (`app_secrets` table, service-role only, no anon/authenticated grants):
- `name text primary key`, `value_ciphertext text`, `hint text` (last 4 chars), `set_by uuid`, `set_at timestamptz`.
- `app_secret_history` (id, name, hint, set_by, set_at, action `set|removed`) — admin-readable via RLS `has_role(admin)`.
- Encryption reuses the AES-GCM helper pattern from `googleAuth.ts` (move `encryptSecret`/`decryptSecret` to `_shared/crypto.ts`, keyed by `GOOGLE_TOKEN_ENC_KEY` — renamed alias `APP_ENC_KEY` falls back to it).

**Edge function `ai-provider-admin`** (admin-only via `has_role`): actions `status`, `set_openrouter_key` (validates with `GET /api/v1/credits` first, returns balance), `remove_openrouter_key`. Replaces `ai-balance` (its status payload folded in).

**`_shared/openrouter.ts`**:
- New async `resolveOpenRouterKey()`: reads `app_secrets.OPENROUTER_API_KEY` via service-role client, cached in-memory for 60 s per isolate, falls back to the `OPENROUTER_API_KEY` env secret.
- `getAiProviderConfig(tier)` becomes async; `fetchChatCompletion` and `getOpenRouterCredits` use it. Update the 13 call sites (`await`).
- `OPENROUTER_MODEL_CHAINS` gains a `bulk` tier and the cheaper orders above; add `LOVABLE_MODEL_CHAINS` with the same tiers for the fallback provider. `tag-standards`/DoK backfill functions pass `tier: "bulk"`.

**Frontend**: `src/components/admin/AiProviderCard.tsx` replaces `AiBalanceCard.tsx` — status, masked key, key input with "Test & save", remove button, history list. Wire into `Admin.tsx`.

**Rollout**: after publishing, the existing env-secret key keeps working until you paste a new one in the card.
