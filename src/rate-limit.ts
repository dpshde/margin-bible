/** Workers Rate Limiting helpers. Limits live on the bindings in cloudflare.config.ts. */

export const HA_PERIOD_SEC = 60;
export const SUGGEST_TITLE_PERIOD_SEC = 60;
export const PUBLIC_API_PERIOD_SEC = 60;

export type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

/** Hidden Arrow search and suggest share one counter per IP. Those routes have no session. */
export function haRateKey(ip: string): string {
  return `ha:${ip}`;
}

/** Title suggestion burst. A cookie uses the session; a cookieless caller uses the IP. */
export function suggestRateKey(ip: string, sessionId: string | null): string {
  if (sessionId) return `suggest:s:${sessionId}`;
  return `suggest:ip:${ip}`;
}

/** Other public API routes share one counter per IP. */
export function publicApiRateKey(ip: string): string {
  return `api:${ip}`;
}

/**
 * Returns true when the request may proceed.
 * A missing binding allows the request so local tests without the binding still run.
 * Deployed config always declares the binding.
 */
export async function takeRateLimit(limiter: RateLimitBinding | undefined, key: string): Promise<boolean> {
  if (!limiter) return true;
  const { success } = await limiter.limit({ key });
  return success;
}

export function rateLimitedResponse(retryAfterSec: number, error: string): Response {
  const retryAfter = String(Math.max(1, Math.ceil(retryAfterSec)));
  return new Response(JSON.stringify({ ok: false, error }), {
    status: 429,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": retryAfter,
    },
  });
}
