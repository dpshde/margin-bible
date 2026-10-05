import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { canGo, jumpState } from "../src/jump-suggest";
import { passageHelpers, passageHelpersClientSource } from "../src/passage-helpers";

const samples = [
  "j",
  "jo",
  "joh",
  "john",
  "john ",
  "John",
  "john 3",
  "john 3:",
  "john 3:1",
  "john 3:16",
  "jhn.3.16",
  "jn 3",
  "1 jo",
  "1 john",
  "1 john 1:1",
  "de",
  "Deuteronomy",
  "Deuteronomy ",
  "Deuteronomy 3",
  "Deuteronomy 3:16",
  "ps 23",
  "psalm 23:1",
  "song",
  "ge",
  "gn 1",
  "obadiah",
  "philemon 1",
  "jude 1",
  "rev 22:21",
  "john 3:16-",
  "john 3:16-1",
  "love",
  "love your neighbor",
  "",
  "   ",
];

describe("passage helpers", () => {
  test("matches jump suggestions for book, chapter, and verse prefixes", () => {
    for (const query of samples) {
      const remote = jumpState(query);
      const local = passageHelpers(query);
      expect(local.hits.map((hit) => ({ kind: hit.kind, label: hit.label, insertText: hit.insertText })), query).toEqual(
        remote.hits.map((hit) => ({ kind: hit.kind, label: hit.label, insertText: hit.insertText })),
      );
      expect(local.hint, query).toBe(remote.hint);
      expect(local.canGo, query).toBe(canGo(query));
    }
  });

  test("the client source is the same function and carries the book list", () => {
    const source = passageHelpersClientSource();
    expect(source).toContain("const PASSAGE_DATA = ");
    expect(source).toContain('"JHN":"John"');
    expect(source).toContain("function passageHelpers(raw)");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("__name(");
    expect(source).not.toContain(".toString(");
    const api = new Function(`${source}; return passageHelpers;`)() as (raw: string) => ReturnType<typeof passageHelpers>;
    expect(api("jo").hits[0]?.label).toBe("Job");
    expect(api("joh").hits.map((hit) => hit.label)).toEqual(["John"]);
    expect(api("john").hint).toBe("21 chapters");
    expect(api("john 3").hits[0]).toMatchObject({ kind: "chapter", label: "John 3" });
    expect(api("john 3:").hits[0]?.label).toBe("John 3:1");
    expect(api("john 3:16").canGo).toBe(true);
  });

  test("a keep-names bundle still serves helpers without __name", async () => {
    const outfile = join(mkdtempSync(join(tmpdir(), "passage-helpers-")), "bundle.mjs");
    await esbuild.build({
      stdin: {
        contents: `import { passageHelpersClientSource } from "./src/passage-helpers.ts";
const source = passageHelpersClientSource();
if (source.includes("__name(")) throw new Error("client source contains __name");
console.log("ok");
`,
        resolveDir: join(import.meta.dir, ".."),
        sourcefile: "keep-names-check.ts",
      },
      bundle: true,
      format: "esm",
      platform: "neutral",
      keepNames: true,
      outfile,
    });
    const result = spawnSync("bun", [outfile], { encoding: "utf8" });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("ok");
  });
});
