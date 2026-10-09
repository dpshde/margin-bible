import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);

function read(name: string): string {
  return readFileSync(new URL(name, root), "utf8");
}

describe("durable CI/CD", () => {
  const mise = read("mise.toml");
  const workflow = read(".github/workflows/ci.yml");

  test("mise pins bun, node, and the Cloudflare CLI", () => {
    expect(mise).toContain('bun = "1.4.2"');
    expect(mise).toContain('node = "22.23.3"');
    expect(mise).toContain('"npm:cf" = "1.0.0-beta.13"');
  });

  test("GitHub and a laptop share the mise tasks", () => {
    expect(workflow).toContain("run: mise run ci");
    expect(workflow).toContain("run: mise run cf:whoami");
    expect(workflow).toContain("run: mise run deploy");
    expect(mise).toContain('run = "sh scripts/deploy.sh"');
    expect(mise).toContain('run = "sh scripts/d1-remote.sh"');
    expect(workflow).not.toContain("migrations apply");
    expect(workflow).not.toContain("prod/workers");
    expect(existsSync(new URL(".github/workflows/deploy.yml", root))).toBe(false);
  });

  test("publish and migrations use cf", () => {
    const deploy = read("scripts/deploy.sh");
    const remote = read("scripts/d1-remote.sh");
    const local = read("scripts/d1-local.sh");
    const config = read("cloudflare.config.ts");
    expect(deploy).toContain("mise exec -- cf deploy");
    expect(deploy).not.toContain("wrangler deploy");
    expect(remote).toContain('mise exec -- cf d1 migrations apply "$D1_ID" --dir migrations');
    expect(local).toContain('mise exec -- cf d1 migrations apply "$D1_ID" --local --dir migrations --persist-to .wrangler/state');
    expect(read("scripts/cloudflare-env.mjs")).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(read("scripts/cf-whoami.mjs")).toContain("tokenValid");
    expect(read("scripts/cf-whoami.mjs")).not.toContain("scopes");
    expect(config).toContain('accountId: "91ff2c2b757414041aeaa00896a8a43f"');
    expect(config).toContain('name: "margin-bible"');
    expect(config).toContain('id: "0f48d232-f2d8-46c2-a8a3-3b36c4279feb"');
    expect(config).toContain("workersDev: true");
    expect(config).toContain("runWorkerFirst: true");
    expect(config).toContain("redactQueryString: true");
    expect(config).toContain("issues:");
    expect(config).toContain("logs:");
    expect(config).toContain("traces:");
    expect(config).not.toContain("TODO(@cloudflare)");
    expect(config).not.toContain("throw new Error");
    expect(existsSync(new URL("wrangler.jsonc", root))).toBe(false);
    expect(read("wrangler.config.ts")).toContain('assetsDirectory: "./assets"');
    expect(mise).toContain("mise exec -- bun run dry-run");
    expect(mise).not.toContain("wrangler deploy");
  });
});
