// Shared AI provider switcher. Prefers OpenRouter when OPENROUTER_API_KEY is set;
// otherwise falls back to the Lovable AI Gateway using LOVABLE_API_KEY.
// This keeps existing functions working during a partial rollout.

export type AiProvider = "openrouter" | "lovable";

export type AiTier = "default" | "heavy";

/**
 * Ordered fallback chains sent via OpenRouter's native `models` array. If the
 * first model is rate-limited, overloaded or down, OpenRouter tries the next one
 * inside the same request. OpenRouter allows at most 3 models. (An empty account balance blocks every model, so a
 * real 402 is never rescued by the chain.)
 */
export const OPENROUTER_MODEL_CHAINS: Record<AiTier, string[]> = {
  default: [
    "google/gemini-3.7-flash",
    "openai/gpt-5.4-mini",
    "anthropic/claude-haiku-4.5",
  ],
  heavy: [
    "google/gemini-3.1-pro-preview",
    "openai/gpt-5.4",
    "anthropic/claude-sonnet-4.6",
  ],
};

/** Backwards-compatible alias: first model of the default chain. */
export const OPENROUTER_MODEL = OPENROUTER_MODEL_CHAINS.default[0];

export interface AiProviderConfig {
  provider: AiProvider;
  baseUrl: string;
  headers: Record<string, string>;
  /** Set only when the provider should override the request body's model field. */
  overrideModel?: string;
  /** OpenRouter only: full fallback chain for the tier. */
  modelChain?: string[];
}

/**
 * Normalize a pasted OpenRouter key: trim whitespace, drop an accidental
 * "Bearer " prefix, and lowercase the fixed "sk-or-v1-" prefix (mobile
 * keyboards often auto-capitalize the first letter, which OpenRouter rejects).
 */
export function normalizeOpenRouterKey(raw: string | undefined): string {
  let k = (raw ?? "").trim().replace(/^bearer\s+/i, "");
  const m = k.match(/^(sk-or(?:-v\d+)?-)(.*)$/i);
  if (m) k = m[1].toLowerCase() + m[2];
  return k;
}

export function getAiProviderConfig(tier: AiTier = "default"): AiProviderConfig {
  const OPENROUTER_API_KEY = normalizeOpenRouterKey(Deno.env.get("OPENROUTER_API_KEY"));
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
      overrideModel: OPENROUTER_MODEL_CHAINS[tier][0],
      modelChain: OPENROUTER_MODEL_CHAINS[tier],
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

export interface RetryOptions {
  /** Model tier: `default` (fast) or `heavy` (long, complex generation). */
  tier?: AiTier;
  /** Max additional attempts after the first (default 3). Set 0 to disable. */
  maxRetries?: number;
  /** Upper bound for a single wait, in ms (default 15s). */
  maxDelayMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Bounded backoff delay: honors Retry-After when present, else exponential with jitter. */
export function backoffDelayMs(res: Response, attempt: number, maxDelayMs: number): number {
  const ra = res.headers.get("retry-after");
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, maxDelayMs);
    const at = Date.parse(ra);
    if (!Number.isNaN(at)) return Math.min(Math.max(at - Date.now(), 500), maxDelayMs);
  }
  const base = Math.min(1000 * 2 ** attempt, maxDelayMs);
  return Math.round(base * (0.5 + Math.random()));
}

/**
 * Post a chat-completions request through the configured provider with bounded
 * backoff. Retries only transient failures: 429 (rate limit), 5xx, network
 * errors, and OpenRouter's "in-flight" 402 (credit reservation contention, not
 * a real balance problem). Real 400/401/402/403 responses return immediately —
 * re-sending them cannot succeed and only burns credits.
 */
export async function fetchChatCompletion(
  body: Record<string, unknown>,
  opts: RetryOptions = {},
): Promise<Response> {
  const config = getAiProviderConfig(opts.tier ?? "default");
  const requestBody: Record<string, unknown> = config.overrideModel
    ? { ...body, model: config.overrideModel }
    : { ...body };
  if (config.modelChain) requestBody.models = config.modelChain;

  // OpenRouter bills against the requested max tokens, so cap it to avoid
  // exhausting small credit balances on models with very high default limits.
  if (config.provider === "openrouter" && !requestBody.max_tokens) {
    requestBody.max_tokens = 4096;
  }
  return postProviderWithBackoff(config, requestBody, opts);
}

/** Low-level: POST an already-final body to the provider with bounded backoff. Use when the model must not be overridden (e.g. image models). */
export async function postProviderWithBackoff(
  config: AiProviderConfig,
  requestBody: Record<string, unknown>,
  opts: RetryOptions = {},
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? 3;
  const maxDelayMs = opts.maxDelayMs ?? 15_000;
  const payload = JSON.stringify(requestBody);

  let lastErr: unknown = null;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(config.baseUrl, { method: "POST", headers: config.headers, body: payload });
    } catch (e) {
      lastErr = e;
      if (attempt >= maxRetries) throw e;
      await sleep(backoffDelayMs(new Response(null), attempt, maxDelayMs));
      continue;
    }

    if (res.ok || attempt >= maxRetries) return res;

    let retryable = res.status === 429 || res.status >= 500;
    if (!retryable && res.status === 402 && config.provider === "openrouter") {
      // Peek at the body without consuming the response we might hand back.
      const txt = await res.clone().text().catch(() => "");
      retryable = /in_flight/i.test(txt);
    }
    if (!retryable) return res;

    const delay = backoffDelayMs(res, attempt, maxDelayMs);
    console.warn(`AI provider ${res.status}; retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
    await res.body?.cancel().catch(() => {});
    await sleep(delay);
  }
  // unreachable, but keeps TypeScript satisfied
  throw lastErr instanceof Error ? lastErr : new Error("AI request failed");
}

/** Human-readable messages for the provider-specific error codes. */
export function aiRateLimitMessage(provider: AiProvider): string {
  return "AI rate limit reached. Try again in a moment.";
}

export function aiCreditsMessage(provider: AiProvider): string {
  return provider === "openrouter"
    ? "AI is paused — the OpenRouter balance is empty. An admin needs to add credits at openrouter.ai."
    : "AI is paused — the workspace AI balance is empty. An admin needs to add credits.";
}

/** OpenRouter account balance (USD). Returns null when not on OpenRouter or the call fails. */
export async function getOpenRouterCredits(): Promise<{ total: number; used: number; remaining: number } | null> {
  const key = normalizeOpenRouterKey(Deno.env.get("OPENROUTER_API_KEY"));
  if (!key) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const total = Number(j?.data?.total_credits ?? 0);
    const used = Number(j?.data?.total_usage ?? 0);
    return { total, used, remaining: Math.max(0, total - used) };
  } catch {
    return null;
  }
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

/** Map a 402 body to a precise message (OpenRouter distinguishes a low balance from an in-flight budget cap). */
export function aiCreditsMessageFromBody(provider: AiProvider, bodyText: string): string {
  if (provider === "openrouter" && /in_flight/i.test(bodyText)) {
    return "OpenRouter balance is too low to run this request alongside other in-flight AI calls. Wait a minute and retry, or add credits at openrouter.com.";
  }
  return aiCreditsMessage(provider);
}

export function aiProviderErrorMessage(status: number, provider: AiProvider, bodyText = ""): string {
  if (status === 401) return aiAuthMessage(provider);
  if (status === 402) return aiCreditsMessageFromBody(provider, bodyText);
  if (status === 429) return aiRateLimitMessage(provider);
  return `AI provider error (${status}).`;
}
