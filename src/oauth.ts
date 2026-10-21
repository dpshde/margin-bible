/**
 * MCP OAuth for /mcp: protected-resource + authorization-server metadata, DCR,
 * PKCE code flow and tokens via @cloudflare/workers-oauth-provider (KV: OAUTH_KV).
 * Consent is gated on Margin's own sign-in: only a session bound to the MCP
 * library may approve. The static MCP_BEARER_TOKEN still works as an external token.
 */
import type { OAuthHelpers, OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { authorizeMcp, mcpLibraryId, type McpAuthEnv } from "./mcp-auth";

export const AUTHORIZE_PATH = "/authorize";
export const TOKEN_PATH = "/oauth/token";
export const REGISTER_PATH = "/oauth/register";
export const MCP_SCOPE = "notes:read";

export type OAuthEnv = McpAuthEnv & { OAUTH_KV?: KVNamespace; OAUTH_PROVIDER?: OAuthHelpers };

type Handler = { fetch(request: Request, env: any, ctx: ExecutionContext): Response | Promise<Response> };

/** Same loopback rule as @cloudflare/workers-oauth-provider (http allowed only here). */
function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host === "[::1]") return true;
  const ipv4 = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  return ipv4 !== null && ipv4.slice(1).every((octet) => Number(octet) <= 255);
}

/**
 * Resource id is per origin so prod, previews and local dev each validate their own audience.
 * Public hosts are always https: workers-oauth-provider 1.x throws
 * `resourceMetadata.resource is required and must be an absolute HTTPS URI...` when
 * constructing OAuthProvider with an http resource on a non-loopback host (e.g. cleartext probes).
 */
export function mcpResource(requestUrl: string): string {
  const url = new URL(requestUrl);
  if (url.protocol !== "https:" && !isLoopbackHostname(url.hostname)) {
    url.protocol = "https:";
  }
  return `${url.origin}/mcp`;
}

const providers = new Map<string, OAuthProvider>();

export function oauthWorker(app: Handler): Handler {
  return {
    async fetch(request, env, ctx) {
      if (!env.OAUTH_KV) return app.fetch(request, env, ctx);
      // Loaded lazily: the package imports cloudflare:workers, which bun tests lack.
      const { OAuthProvider } = await import("@cloudflare/workers-oauth-provider");
      const resource = mcpResource(request.url);
      let provider = providers.get(resource);
      if (!provider) {
        provider = new OAuthProvider({
          apiRoute: "/mcp",
          apiHandler: app as any,
          defaultHandler: app as any,
          authorizeEndpoint: AUTHORIZE_PATH,
          tokenEndpoint: TOKEN_PATH,
          clientRegistrationEndpoint: REGISTER_PATH,
          scopesSupported: [MCP_SCOPE],
          resourceMetadata: { resource, resource_name: "Margin" },
          accessTokenTTL: 3600,
          refreshTokenTTL: 60 * 60 * 24 * 30,
          resolveExternalToken: async ({ token, env: e }) => {
            const auth = authorizeMcp(e as McpAuthEnv, `Bearer ${token}`);
            return auth.ok ? { props: { libraryId: auth.libraryId }, audience: resource } : null;
          },
        });
        providers.set(resource, provider);
      }
      // Some clients probe the bare well-known path; serve the /mcp resource's metadata there too.
      const url = new URL(request.url);
      if (url.pathname === "/.well-known/oauth-protected-resource") {
        url.pathname = "/.well-known/oauth-protected-resource/mcp";
        return provider.fetch(new Request(url, request), env, ctx);
      }
      return provider.fetch(request, env, ctx);
    },
  };
}

/** Only a signed-in session on the MCP library may approve a client. */
export function canApprove(env: McpAuthEnv, signedIn: boolean, libraryId: string | null): boolean {
  return signedIn && !!libraryId && libraryId === mcpLibraryId(env);
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function consentPage(input: { client: string; redirectHost: string; handle: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect to Margin</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem}button{font:inherit;padding:.5rem 1rem;margin-right:.5rem}</style></head>
<body><h1>Connect to Margin</h1><p><strong>${esc(input.client)}</strong> wants read access to your Margin notes.</p>
<p>It will return to <code>${esc(input.redirectHost)}</code>.</p>
<form method="post" action="${AUTHORIZE_PATH}"><input type="hidden" name="handle" value="${esc(input.handle)}">
<button name="decision" value="approve">Allow</button><button name="decision" value="deny">Deny</button></form></body></html>`;
}
