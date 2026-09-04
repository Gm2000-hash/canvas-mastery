# AI model fallbacks on OpenRouter

## What happened, and who it affects

All AI features (content generator, question tagging, lesson tools) run through one shared OpenRouter account. When its balance hits zero, every teacher gets the same "credits exhausted" error at once. Model fallbacks cannot fix that specific case — an empty balance blocks every model on the account equally — so the balance still needs a top-up. Fallbacks do protect against the other outages teachers would otherwise share: a model being rate-limited, overloaded, or temporarily down.

## What will change

**Automatic model fallback chain (all AI calls)**
Every request goes to OpenRouter with an ordered list of models. If the first fails (rate limit, 5xx, model unavailable), OpenRouter moves to the next one automatically in the same request — teachers see no error and no delay beyond the retry.

Default chain (exact ids confirmed against OpenRouter's model list at build time):
1. Google Gemini Flash (current default)
2. OpenAI GPT mini-tier
3. Anthropic Claude Haiku/Sonnet-tier
4. An open-weights model (e.g. Llama / Qwen) as the last resort

Heavy jobs (ISAT exam, escape room, lesson regeneration) use the same chain with the stronger tier of each family.

**Clear, shared error state**
When the account is truly out of credits, the generator shows a plain message ("AI is paused — the OpenRouter balance is empty. An admin needs to add credits.") instead of "Edge Function returned a non-2xx status code". Background tagging already pauses; that pause banner is reused.

**Admin low-balance warning**
The admin page shows the current OpenRouter balance (read from OpenRouter's credits endpoint) with a warning under a configurable threshold, so a top-up happens before teachers are blocked.

## Technical details

- `supabase/functions/_shared/openrouter.ts`
  - Replace the single `OPENROUTER_MODEL` constant with `OPENROUTER_MODEL_CHAINS = { default: [...], heavy: [...] }`.
  - `fetchChatCompletion` sends `model: chain[0]` plus OpenRouter's native `models: chain` array, so fallback happens server-side on OpenRouter without extra round-trips; accept a `tier` option (`default | heavy`).
  - Keep existing backoff for 429/5xx; 402 (non in-flight) and 401/403 remain terminal.
  - Add `getOpenRouterCredits()` helper hitting `GET /api/v1/credits`.
- Callers: the ~10 edge functions using `fetchChatCompletion` pass `tier` where appropriate; no other call-site changes.
- Client `model_override` is already ignored by the server (provider model always wins), so the removed "AI Engine" picker had no effect; the remaining pickers in ISAT/escape-room/regenerate dialogs are removed for consistency.
- `src/modules/curriculum/lib/content-generator.ts` and the generator dialogs: parse the function's JSON error body and surface its `error` message instead of the generic Supabase invoke text.
- New edge function `ai-balance` (admin-only, checks `has_role(admin)`) returning balance + threshold; admin page card with warning state. Threshold stored in a new `app_settings` row (or a constant if a settings table would be overkill).
- Verify with one real request per tier through the deployed function after the balance is topped up.
