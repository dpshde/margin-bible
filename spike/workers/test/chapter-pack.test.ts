import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("vendored BSB chapter cache", () => {
  test("John 3 matches the official USJ flattening", () => {
    const file = path.join(import.meta.dir, "../assets/bsb/jhn.3.json");
    const pack = JSON.parse(readFileSync(file, "utf8")) as {
      translation: string;
      book: string;
      chapter: number;
      verses: Array<{ v: number; text: string; heading?: string }>;
    };
    expect(pack.translation).toBe("BSB");
    expect(pack.book).toBe("JHN");
    expect(pack.chapter).toBe(3);
    expect(pack.verses).toHaveLength(36);
    expect(pack.verses[0].heading).toContain("Nicodemus");
    expect(pack.verses.find((verse) => verse.v === 16)?.text).toContain("For God so loved the world");
  });
});
