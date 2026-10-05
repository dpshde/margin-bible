import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cloudflareIdsFromSource } from "../scripts/cloudflare-env.mjs";

const accountId = "91ff2c2b757414041aeaa00896a8a43f";
const databaseId = "0f48d232-f2d8-46c2-a8a3-3b36c4279feb";

describe("cloudflareIdsFromSource", () => {
  test("reads the account and D1 id from a cf config", () => {
    const source = `
      export default defineConfig({
        accountId: "${accountId}",
        worker: {
          env: {
            DB: bindings.d1({
              name: "margin-bible",
              id: "${databaseId}",
            }),
          },
        },
      });
    `;
    expect(cloudflareIdsFromSource(source)).toEqual({ account: accountId, d1Id: databaseId });
  });

  test("rejects a config that is missing the D1 id", () => {
    expect(() => cloudflareIdsFromSource(`accountId: "${accountId}"`)).toThrow(
      /accountId or d1 database id/,
    );
  });

  test("reads the committed cloudflare.config.ts", () => {
    const source = readFileSync(new URL("../cloudflare.config.ts", import.meta.url), "utf8");
    expect(cloudflareIdsFromSource(source)).toEqual({ account: accountId, d1Id: databaseId });
  });
});
