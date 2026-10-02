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
    expect(mise).toContain('"npm:cf" = "1.0.0-beta.10"');
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

  test("publish stays on Wrangler and remote migrations stay on cf", () => {
    const deploy = read("scripts/deploy.sh");
    const remote = read("scripts/d1-remote.sh");
    expect(deploy).toContain("mise exec -- bunx wrangler deploy");
    const commands = deploy.split("\n").filter((line) => !line.trim().startsWith("#"));
    expect(commands.join("\n")).not.toContain("cf deploy");
    expect(remote).toContain('mise exec -- cf d1 migrations apply "$D1_ID"');
    expect(read("scripts/cloudflare-env.mjs")).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(read("scripts/cf-whoami.mjs")).toContain("tokenValid");
    expect(read("scripts/cf-whoami.mjs")).not.toContain("scopes");
    expect(read("wrangler.jsonc")).toContain('"account_id": "91ff2c2b757414041aeaa00896a8a43f"');
  });
});
