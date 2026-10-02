import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";

const client = readFileSync(new URL("../src/reader-client.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/reader-page.ts", import.meta.url), "utf8");
const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

describe("backlink round trip", () => {
  test("the reader keeps a mirror chip distinct from a user xref", () => {
    expect(client).toContain(
      'source: row.source === "manual" || row.source === "scan" || row.source === "backlink" ? row.source : undefined',
    );
    expect(client).toContain('const source = row.source === "manual" || row.source === "backlink" ? row.source : "scan"');
    expect(client).toContain(
      'source: chip.dataset.attSource === "scan" || chip.dataset.attSource === "backlink" ? chip.dataset.attSource : "manual"',
    );
    expect(client).toContain(
      'chip.dataset.attSource = row.source === "scan" || row.source === "backlink" ? row.source : "manual"',
    );
    expect(page).toContain('att.source === "scan" || att.source === "backlink"');
  });

  test("a save paints same-chapter mirrors and drops the other chapter cache", () => {
    expect(client).toContain("function reconcileChapterNotes");
    expect(client).toContain("function mergeIncomingBacklinks");
    expect(client).toContain("function dropChapterNotesCache");
    expect(client).toContain("dropLinkedChapterCaches(data.linkedSlugs)");
    expect(index).toContain("syncBidirectionalXrefs");
    expect(index).toContain("ensureBidirectionalXrefs");
    expect(index).toContain("linkedSlugs");
    expect(index).toContain("if (!queried.scoped) return { ok: true, notes: queried.notes }");
    expect(index).toContain("scoped: false");
  });
});
