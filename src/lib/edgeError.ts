/**
 * Pull the real server-side message out of a `supabase.functions.invoke()` error.
 * Without this, FunctionsHttpError only says "Edge Function returned a non-2xx status code".
 */
export async function readEdgeError(error: unknown, fallback = "Something went wrong"): Promise<string> {
  try {
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof ctx.clone === "function") {
      const text = await ctx.clone().text();
      if (text) {
        try {
          const body = JSON.parse(text);
          if (body?.error) return String(body.error);
          if (body?.message) return String(body.message);
        } catch {
          return text.slice(0, 300);
        }
      }
    }
  } catch { /* ignore */ }
  return (error as { message?: string })?.message || fallback;
}
