import { describe, expect, test } from "bun:test";
import {
  coversVerse,
  nextChapter,
  parsePassage,
  passageLabel,
  passageOsis,
  passageSlug,
  prevChapter,
  routeBibleUrl,
} from "../src/passage";

describe("parsePassage", () => {
  test("parses grab-bcv slugs", () => {
    const verse = parsePassage("jhn.3.16");
    expect(verse).not.toBeNull();
    expect(passageSlug(verse!)).toBe("jhn.3.16");
    expect(passageOsis(verse!)).toBe("JHN.3.16");
    expect(verse!.kind).toBe("verse");
    expect(passageLabel(verse!)).toBe("John 3:16");

    const range = parsePassage("JHN.3.16-18");
    expect(passageSlug(range!)).toBe("jhn.3.16-18");
    expect(range!.kind).toBe("range");
    expect(passageLabel(range!)).toBe("John 3:16–18");

    const chapter = parsePassage("jhn.3");
    expect(chapter!.kind).toBe("chapter");
    expect(passageSlug(chapter!)).toBe("jhn.3");
  });

  test("parses human references via grab-bcv (npm)", () => {
    expect(passageSlug(parsePassage("John 3:16")!)).toBe("jhn.3.16");
    expect(passageSlug(parsePassage("Jn 3")!)).toBe("jhn.3");
    expect(passageSlug(parsePassage("jn 3")!)).toBe("jhn.3");
    expect(passageSlug(parsePassage("jhn.3.16")!)).toBe("jhn.3.16");
    expect(passageSlug(parsePassage("1 John 1:1")!)).toBe("1jn.1.1");
    expect(passageSlug(parsePassage("Song of Solomon 2:1")!)).toBe("sng.2.1");
    expect(passageSlug(parsePassage("John 3:16–18")!)).toBe("jhn.3.16-18");
    // Bare book alias → chapter 1 (resolveBookAlias fallback)
    expect(passageSlug(parsePassage("jude")!)).toBe("jud.1");
  });

  test("rejects unknown books", () => {
    expect(parsePassage("")).toBeNull();
    expect(parsePassage("   ")).toBeNull();
    expect(parsePassage("not-a-book")).toBeNull();
    expect(parsePassage("zzz.1.1")).toBeNull();
  });

  test("walks chapter neighbors across book boundaries", () => {
    expect(passageSlug(prevChapter(parsePassage("jhn.1")!)!)).toBe("luk.24");
    expect(passageSlug(nextChapter(parsePassage("jhn.21")!)!)).toBe("act.1");
    expect(prevChapter(parsePassage("gen.1")!)).toBeNull();
    expect(nextChapter(parsePassage("rev.22")!)).toBeNull();
  });

  test("shares the route.bible slug", () => {
    expect(routeBibleUrl(parsePassage("jhn.3.16")!)).toBe("https://route.bible/jhn.3.16");
  });

  test("a range covers its verses and a chapter address does not", () => {
    const range = parsePassage("jhn.3.16-18")!;
    expect(coversVerse(range, 16)).toBe(true);
    expect(coversVerse(range, 18)).toBe(true);
    expect(coversVerse(range, 15)).toBe(false);
    expect(coversVerse(parsePassage("jhn.3")!, 16)).toBe(false);
  });
});
