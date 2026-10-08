/** Workers Rate Limiting helpers. Limits live on the bindings in cloudflare.config.ts. */

export const HA_PERIOD_SEC = 60;
export const SUGGEST_TITLE_PERIOD_SEC = 60;
export const PUBLIC_API_PERIOD_SEC = 60;
export const LOGIN_PERIOD_SEC = 60;
export const MCP_PERIOD_SEC = 60;

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

/**
 * Other public API routes share one counter.
 * A session wins, then a library, then the IP. Church wifi and carrier NAT
 * share an address, so an IP key only covers cookieless callers.
 */
export function publicApiRateKey(ip: string, sessionId: string | null, libraryId: string | null): string {
  if (sessionId) return `api:s:${sessionId}`;
  if (libraryId) return `api:l:${libraryId}`;
  return `api:ip:${ip}`;
}

/** Sign-in attempts share one counter per IP prefix. */
export function loginRateKey(ip: string): string {
  return `login:${ip}`;
}

/** MCP calls share one counter per IP prefix. */
export function mcpRateKey(ip: string): string {
  return `mcp:${ip}`;
}

/**
 * Address used in rate-limit keys.
 * IPv4 stays exact. IPv6 is the /64 so one household does not look like many clients.
 */
export function rateLimitIp(ip: string): string {
  const raw = ip.split("%")[0]?.trim().toLowerCase() ?? "";
  if (!raw || raw === "unknown") return "unknown";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(raw)) return raw;
  const mapped = raw.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1] ?? raw.slice(0, 64);
  return ipv6Network64(raw) ?? raw.slice(0, 64);
}

function ipv6Network64(address: string): string | null {
  if (!address.includes(":")) return null;
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const parse = (side: string) => (side ? side.split(":") : []);
  const left = parse(halves[0] ?? "");
  const right = halves.length === 2 ? parse(halves[1] ?? "") : [];
  if ([...left, ...right].some((part) => part.includes("."))) return null;
  const missing = halves.length === 2 ? 8 - left.length - right.length : 0;
  if (halves.length === 1 && left.length !== 8) return null;
  if (missing < 0) return null;
  const full = halves.length === 2 ? [...left, ...Array.from({ length: missing }, () => "0"), ...right] : left;
  if (full.length !== 8) return null;
  const padded = full.slice(0, 4).map(padHextet);
  if (padded.some((part) => part === null)) return null;
  return `${padded.join(":")}::/64`;
}

function padHextet(part: string): string | null {
  if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
  return part.padStart(4, "0");
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
