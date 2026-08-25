// Shared AI provider switcher. Prefers OpenRouter when OPENROUTER_API_KEY is set;
// otherwise falls back to the Lovable AI Gateway using LOVABLE_API_KEY.
// This keeps existing functions working during a partial rollout.

export type AiProvider = "openrouter" | "lovable";

/** Default OpenRouter model. Keep this as one constant so future swaps are easy. */
export const OPENROUTER_MODEL = "google/gemini-3.7-flash";

export interface AiProviderConfig {
  provider: AiProvider;
  baseUrl: string;
  headers: Record<string, string>;
  /** Set only when the provider should override the request body's model field. */
  overrideModel?: string;
}

export function getAiProviderConfig(): AiProviderConfig {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": Deno.env.get("OPENROUTER_REFERER") ??
          "https://canvas-mastery.lovable.app",
        "X-Title": "Canvas Mastery",
      },
      overrideModel: OPENROUTER_MODEL,
    };
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("No AI provider key configured. Add OPENROUTER_API_KEY or LOVABLE_API_KEY.");
  }

  return {
    provider: "lovable",
    baseUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
  };
}

/** Post a chat-completions request through the configured provider. */
export async function fetchChatCompletion(body: Record<string, unknown>): Promise<Response> {
  const config = getAiProviderConfig();
  const requestBody = config.overrideModel
    ? { ...body, model: config.overrideModel }
    : body;

  // OpenRouter bills against the requested max tokens, so cap it to avoid
  // exhausting small credit balances on models with very high default limits.
  if (config.provider === "openrouter" && !requestBody.max_tokens) {
    requestBody.max_tokens = 4096;
  }

  return fetch(config.baseUrl, {
    method: "POST",
    headers: config.headers,
    body: JSON.stringify(requestBody),
  });
}

/** Human-readable messages for the provider-specific error codes. */
export function aiRateLimitMessage(provider: AiProvider): string {
  return "AI rate limit reached. Try again in a moment.";
}

export function aiCreditsMessage(provider: AiProvider): string {
  return provider === "openrouter"
    ? "OpenRouter credits exhausted. Add credits at openrouter.com."
    : "AI credits exhausted. Add credits in Workspace Settings.";
}

export function aiAuthMessage(provider: AiProvider): string {
  return provider === "openrouter"
    ? "OpenRouter API key is invalid. Check the OPENROUTER_API_KEY secret."
    : "AI gateway authentication failed.";
}

/** True for status codes that should be surfaced to the user instead of retried/silently swallowed. */
export function isAiProviderHardError(status: number): boolean {
  return status === 401 || status === 402 || status === 429;
}

export function aiProviderErrorMessage(status: number, provider: AiProvider): string {
  if (status === 401) return aiAuthMessage(provider);
  if (status === 402) return aiCreditsMessage(provider);
  if (status === 429) return aiRateLimitMessage(provider);
  return `AI provider error (${status}).`;
}
