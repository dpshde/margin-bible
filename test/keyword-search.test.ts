import { describe, expect, test } from "bun:test";
import { collectKeywordVerses, keywordSearchClientSource, loadKeywordSearch } from "../src/keyword-search";

describe("in-memory keyword search", () => {
  const client = loadKeywordSearch();

  test("requires every content word and prefers the phrase", () => {
    const index = client.buildKeywordIndex([
      ["/mrk.12.31", "Mark 12:31", "Love your neighbor as yourself."],
      ["/mat.22.39", "Matthew 22:39", "Love your neighbor as yourself."],
      ["/jhn.3.16", "John 3:16", "For God so loved the world."],
      ["/1co.13.4", "1 Corinthians 13:4", "Love is patient, love is kind."],
    ]);
    const hits = client.searchKeywordIndex(index, "love your neighbor", 8);
    expect(hits.map((hit) => hit.path)).toEqual(["/mat.22.39", "/mrk.12.31"]);
    expect(hits.every((hit) => hit.text.toLowerCase().includes("neighbor"))).toBe(true);
    expect(client.searchKeywordIndex(index, "leviathan", 8)).toEqual([]);
  });

  test("client source evaluates and stays on this text", () => {
    const source = keywordSearchClientSource();
    expect(source).toContain("function buildKeywordIndex");
    expect(source).toContain("function searchKeywordIndex");
    expect(source).not.toContain("NASB");
    expect(source).not.toContain("ESV");
    expect(source).not.toContain("NIV");
    expect(source).not.toContain("LEB");
    new Function(source);
  });

  test("collects verse rows from the packs it is given", async () => {
    const rows = await collectKeywordVerses(
      [{ code: "JHN", name: "John", chapters: 1 }],
      async () => ({ verses: [{ v: 16, text: "For God so loved the world." }] }),
    );
    expect(rows).toEqual([["/jhn.1.16", "John 1:16", "For God so loved the world."]]);
  });
});
