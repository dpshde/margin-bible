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
