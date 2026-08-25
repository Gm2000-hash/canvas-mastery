# Switch AI calls to OpenRouter with your own API key

The AI calls will be pointed at OpenRouter directly using an API key you provide, instead of Lovable's built-in AI gateway. Usage will be billed to your OpenRouter account instead of your Lovable AI credits.

Since no specific model is required, the default will be OpenRouter's `google/gemini-2.5-flash` — the same model the app uses today, so behavior and tool-calling output stay identical and only the billing path changes. The slug lives in one shared constant, so swapping to any other OpenRouter model later is a one-line change.

## What changes

All five AI-powered backend functions currently call Lovable's gateway with Google Gemini models:

| Function | Purpose | Current model |
| --- | --- | --- |
| `tag-standards` | Tags assignments/questions with standards | `google/gemini-2.5-flash` |
| `tag-question-standards` | Tags quiz questions with standards | `google/gemini-2.5-flash` |
| `import-standards` | Extracts standards from a URL or PDF | `google/gemini-2.5-flash` |
| `match-assessments-in-group` | Finds equivalent assessments in a class group | `google/gemini-2.5-flash` |
| `seed-standards` | Generates a starter standards library | `google/gemini-3-flash-preview` |

Each will be repointed to `https://openrouter.ai/api/v1/chat/completions` using your key.

## Steps

1. **Collect the OpenRouter key** — you'll be prompted to add an `OPENROUTER_API_KEY` secret. It stays server-side and is never exposed to the browser.
2. **Add a shared helper** at `supabase/functions/_shared/openrouter.ts` that builds the request (base URL, `Authorization` header, OpenRouter's `HTTP-Referer` / `X-Title` attribution headers) and centralizes the model slug in one constant so future model swaps are a one-line change.
3. **Update the five functions** to call through that helper. The request shape stays the same — all five use OpenAI-style `messages` + `tools` + `tool_choice` function calling, which OpenRouter supports.
4. **Keep a Lovable-gateway fallback** — if `OPENROUTER_API_KEY` is missing, fall back to the existing Gemini path via `LOVABLE_API_KEY` so nothing breaks for users mid-rollout.
5. **Update error handling** — map OpenRouter's 401 (bad key), 402 (out of credits), and 429 (rate limit) to the clear in-app messages the UI already shows, with wording that points at OpenRouter rather than Lovable credits.
6. **Test each function** with a real request and confirm the tool-call output still parses correctly end to end.

## Technical notes

- No frontend changes; all edits are in `supabase/functions/`.
- No database changes.
- The model slug is a single exported constant, so pointing the app at a different OpenRouter model later is a one-line edit.
