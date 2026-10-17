import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { DEFAULT_MCP_LIBRARY_ID, oauthLibraryId } from "../src/mcp-auth";
import { canApprove, consentPage, mcpResource, oauthWorker } from "../src/oauth";

describe("mcp oauth", () => {
  test("resource id follows the request origin", () => {
    expect(mcpResource("https://margin-bible.dpshade.workers.dev/x?y=1")).toBe(
      "https://margin-bible.dpshade.workers.dev/mcp",
    );
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
