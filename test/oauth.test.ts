import { beforeAll, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { DEFAULT_MCP_LIBRARY_ID, oauthLibraryId } from "../src/mcp-auth";
import { canApprove, consentPage, mcpResource, oauthWorker } from "../src/oauth";

/** Mirrors workers-oauth-provider 1.x construction check used on the metadata path. */
function assertCanonicalResource(resource: unknown): asserts resource is string {
  if (typeof resource !== "string" || !resource) {
    throw new TypeError(
      "resourceMetadata.resource is required and must be an absolute HTTPS URI without a fragment (http is accepted only on a loopback host)",
    );
  }
  const https = resource.startsWith("https://");
  const loopbackHttp = /^http:\/\/(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?)(:\d+)?(\/|$)/i.test(resource);
  if (!https && !loopbackHttp) {
    throw new TypeError(
      "resourceMetadata.resource is required and must be an absolute HTTPS URI without a fragment (http is accepted only on a loopback host)",
    );
  }
}

beforeAll(() => {
  // bun lacks cloudflare:workers; stub the provider so oauthWorker can serve metadata in tests.
  mock.module("@cloudflare/workers-oauth-provider", () => {
    class OAuthProvider {
      #resource: string;
      #resourceName: string | undefined;
      constructor(opts: { resourceMetadata?: { resource?: string; resource_name?: string } }) {
        const resource = opts.resourceMetadata?.resource;
        assertCanonicalResource(resource);
        this.#resource = resource;
        this.#resourceName = opts.resourceMetadata?.resource_name;
      }
      fetch(request: Request) {
        const url = new URL(request.url);
        if (
          url.pathname === "/.well-known/oauth-protected-resource" ||
          url.pathname.startsWith("/.well-known/oauth-protected-resource/")
        ) {
          return Response.json({
            resource: this.#resource,
            authorization_servers: [new URL(this.#resource).origin],
            bearer_methods_supported: ["header"],
            ...(this.#resourceName ? { resource_name: this.#resourceName } : {}),
          });
        }
        return new Response("ok");
      }
    }
    return { OAuthProvider };
  });
});

describe("mcp oauth", () => {
  test("resource id follows the request origin", () => {
    expect(mcpResource("https://margin-bible.dpshade.workers.dev/x?y=1")).toBe(
      "https://margin-bible.dpshade.workers.dev/mcp",
    );
  });

  test("resource id canonicalizes cleartext public hosts to https", () => {
    expect(mcpResource("http://margin-bible.dpshade.workers.dev/.well-known/oauth-protected-resource")).toBe(
      "https://margin-bible.dpshade.workers.dev/mcp",
    );
    expect(mcpResource("http://margin.bible/mcp")).toBe("https://margin.bible/mcp");
  });

  test("resource id keeps http on loopback for local dev", () => {
    expect(mcpResource("http://localhost:8787/mcp")).toBe("http://localhost:8787/mcp");
    expect(mcpResource("http://127.0.0.1:8787/x")).toBe("http://127.0.0.1:8787/mcp");
  });

  test("only a signed-in session on the MCP library can approve", () => {
    expect(canApprove({}, true, DEFAULT_MCP_LIBRARY_ID)).toBe(true);
    expect(canApprove({}, false, DEFAULT_MCP_LIBRARY_ID)).toBe(false);
    expect(canApprove({}, true, "other-library")).toBe(false);
    expect(canApprove({ MCP_LIBRARY_ID: "lib-x" }, true, "lib-x")).toBe(true);
    expect(canApprove({}, true, null)).toBe(false);
  });

  test("OAuth props carry the library id to /mcp", () => {
    expect(oauthLibraryId({ props: { libraryId: "lib-1" } })).toBe("lib-1");
    expect(oauthLibraryId({ props: {} })).toBeNull();
    expect(oauthLibraryId(undefined)).toBeNull();
  });

  test("consent page escapes client-supplied text", () => {
    const html = consentPage({ client: "<script>x</script>", redirectHost: "a.test", handle: 'h"1' });
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('value="h&quot;1"');
  });

  test("without OAUTH_KV the app handles /mcp directly (static bearer path)", async () => {
    let hits = 0;
    const worker = oauthWorker({ fetch: () => (hits++, new Response("ok")) });
    const res = await worker.fetch(new Request("https://m.test/mcp"), {}, {} as ExecutionContext);
    expect(await res.text()).toBe("ok");
    expect(hits).toBe(1);
  });

  test("protected-resource metadata endpoints return 200 JSON with resource", async () => {
    const worker = oauthWorker({ fetch: () => new Response("app") });
    const env = { OAUTH_KV: {} as KVNamespace };
    const ctx = {} as ExecutionContext;
    const origin = "https://prm-meta.test";
    const expected = `${origin}/mcp`;

    for (const path of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"]) {
      const res = await worker.fetch(new Request(`${origin}${path}`), env, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type") ?? "").toContain("application/json");
      const body = (await res.json()) as { resource?: string };
      expect(body.resource).toBe(expected);
    }
  });

  test("cleartext public probes still serve https canonical resource metadata", async () => {
    const worker = oauthWorker({ fetch: () => new Response("app") });
    const env = { OAUTH_KV: {} as KVNamespace };
    const ctx = {} as ExecutionContext;
    const res = await worker.fetch(
      new Request("http://prm-http.test/.well-known/oauth-protected-resource"),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { resource?: string };
    expect(body.resource).toBe("https://prm-http.test/mcp");
  });

  test("config binds OAUTH_KV and the provider advertises DCR + PKCE endpoints", () => {
    expect(readFileSync("cloudflare.config.ts", "utf8")).toContain("OAUTH_KV: bindings.kv(");
    const src = readFileSync("src/oauth.ts", "utf8");
    for (const s of ["clientRegistrationEndpoint", "resolveExternalToken", "resourceMetadata", "/.well-known/oauth-protected-resource"]) {
      expect(src).toContain(s);
    }
  });
});

import { safeNext, signedInLoginRedirect, renderLoginPage } from "../src/login-page";

describe("login next", () => {
  test("safeNext keeps same-origin paths and rejects open redirects", () => {
    expect(safeNext("/authorize?client_id=a&state=b")).toBe("/authorize?client_id=a&state=b");
    for (const bad of ["//evil.test/x", "https://evil.test", "/\\evil.test", "evil", "/login?next=/x", ""]) {
      expect(safeNext(bad)).toBe("/");
    }
  });

  test("signed-in /login forwards to a safe next instead of the profile", () => {
    expect(signedInLoginRedirect(true, "/authorize?x=1")).toBe("/authorize?x=1");
    expect(signedInLoginRedirect(true, "//evil.test")).toBeNull();
    expect(signedInLoginRedirect(true, "/")).toBeNull();
    expect(signedInLoginRedirect(true, undefined)).toBeNull();
    expect(signedInLoginRedirect(false, "/authorize?x=1")).toBeNull();
    expect(signedInLoginRedirect(true, "/authorize", "Passkey added.")).toBeNull();
  });

  test("passkey sign-in follows the page's next", () => {
    const html = renderLoginPage({ next: "/authorize?x=1", signedIn: false, passkeys: true, savedPasskeys: [] } as any);
    expect(html).toContain('value="/authorize?x=1"');
    expect(html).toContain('input[name="next"]');
  });
});
