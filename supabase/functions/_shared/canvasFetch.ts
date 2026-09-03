// Shared Canvas HTTP helper with bounded backoff.
//
// Canvas throttles with HTTP 403 + body "Rate Limit Exceeded" (plus the
// X-Rate-Limit-Remaining header), and occasionally returns 429/5xx. Those are
// retried with Retry-After / exponential jitter; everything else (real 401/403,
// 404, 4xx) returns immediately so callers keep their existing semantics.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isCanvasThrottle(status: number, bodyText: string): boolean {
  return status === 429 || (status === 403 && /rate limit exceeded/i.test(bodyText));
}

function delayFor(res: Response | null, attempt: number, maxDelayMs: number): number {
  const ra = res?.headers.get("retry-after");
  const secs = ra ? Number(ra) : NaN;
  if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, maxDelayMs);
  const base = Math.min(1000 * 2 ** attempt, maxDelayMs);
  return Math.round(base * (0.5 + Math.random()));
}

/**
 * fetch() with retries for Canvas throttling / transient failures.
 * Returns the final Response (possibly non-ok) so callers handle errors as before.
 */
export async function canvasFetch(
  url: string,
  init: RequestInit,
  opts: { maxRetries?: number; maxDelayMs?: number } = {},
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? 3;
  const maxDelayMs = opts.maxDelayMs ?? 10_000;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      if (attempt >= maxRetries) throw e;
      await sleep(delayFor(null, attempt, maxDelayMs));
      continue;
    }
    if (res.ok || attempt >= maxRetries) return res;

    let retry = res.status >= 500 || res.status === 429;
    if (!retry && res.status === 403) {
      const txt = await res.clone().text().catch(() => "");
      retry = isCanvasThrottle(res.status, txt);
    }
    if (!retry) return res;

    const delay = delayFor(res, attempt, maxDelayMs);
    console.warn(`Canvas ${res.status}; retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
    await res.body?.cancel().catch(() => {});
    await sleep(delay);
  }
}

/** Light pacing between paginated requests: slow down as Canvas's bucket drains. */
export async function paceByRemaining(res: Response): Promise<void> {
  const remaining = Number(res.headers.get("x-rate-limit-remaining"));
  if (!Number.isFinite(remaining)) return;
  if (remaining < 50) await sleep(1500);
  else if (remaining < 150) await sleep(400);
}
