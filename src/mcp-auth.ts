/** Bearer auth for /mcp. Cookie sessions stay on the human UI. */

export type McpAuthEnv = {
  MCP_BEARER_TOKEN?: string;
  MCP_LIBRARY_ID?: string;
};

/** Dylan's passphrase-bound Rails-imported library (66 notes). Prefer MCP_LIBRARY_ID secret. */
export const DEFAULT_MCP_LIBRARY_ID = "6d617267-696e-4096-a000-000000000096";

export function mcpLibraryId(env: McpAuthEnv): string {
  const fromEnv = env.MCP_LIBRARY_ID?.trim();
  return fromEnv || DEFAULT_MCP_LIBRARY_ID;
}

export function extractBearerToken(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

export function authorizeMcp(
  env: McpAuthEnv,
  authorization: string | null | undefined,
): { ok: true; libraryId: string } | { ok: false } {
  const expected = env.MCP_BEARER_TOKEN?.trim();
  if (!expected) return { ok: false };
  const got = extractBearerToken(authorization);
  if (!got || !timingSafeEqual(got, expected)) return { ok: false };
  return { ok: true, libraryId: mcpLibraryId(env) };
}

export function wwwAuthenticateBearer(resourceUrl?: string): string {
  const parts = ['Bearer realm="margin.bible"', 'error="invalid_token"'];
  if (resourceUrl) {
    parts.push(`resource_metadata="${resourceUrl}"`);
  }
  return parts.join(", ");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
