# Switch AI model to the Lovable default (`openai/gpt-5.6-sol`)

## Goal
Move all Lovable AI Gateway calls in the Edge Functions from the current Google Gemini models to the Lovable default server-side chat model `openai/gpt-5.6-sol`, while keeping the existing `/v1/chat/completions` path.

## Current state
All AI calls are in five Supabase Edge Functions:

- `supabase/functions/tag-standards/index.ts` — uses `google/gemini-2.5-flash` (batch + single assignment tagging)
- `supabase/functions/tag-question-standards/index.ts` — uses `google/gemini-2.5-flash`
- `supabase/functions/import-standards/index.ts` — uses `google/gemini-2.5-flash`
- `supabase/functions/match-assessments-in-group/index.ts` — uses `google/gemini-2.5-flash`
- `supabase/functions/seed-standards/index.ts` — uses `google/gemini-3-flash-preview`

None of these calls currently use `max_tokens`, `temperature`, or `response_format`.

## Plan

1. **Confirm the Lovable API key** is present before deployment.
2. **Update each Edge Function's request body** for GPT-5.6 compatibility on the chat-completions path:
   - Replace the `model` field with `"openai/gpt-5.6-sol"`.
   - Add `reasoning_effort: "none"` (required for GPT-5.6 on `/v1/chat/completions` with function tools).
   - Add a safe `max_completion_tokens` cap.
   - Confirm no `temperature` or `max_tokens` keys remain.
3. **Deploy the updated Edge Functions**.
4. **Test each function with a real request** to verify a 200 response and that the tool-call output is still parsed correctly.
5. **Run the build checks** (`dead-routes.test.ts` and the Vite build) to confirm nothing else is broken.

## Note

The AI provider stays Lovable AI Gateway; only the model changes. Since no exact model was named, the plan uses the Lovable default `openai/gpt-5.6-sol`. If you want a different supported model, reject the plan and name the exact identifier.
