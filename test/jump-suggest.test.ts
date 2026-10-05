import { describe, expect, test } from "bun:test";
import { canGo, insertTextFor, jumpState, passageContext } from "../src/jump-suggest";

describe("jumpState (Rails-parity grab-bcv)", () => {
  test("book prefix suggests Deuteronomy with trailing space insert", () => {
    const state = jumpState("de");
    expect(state.hits[0]?.label).toBe("Deuteronomy");
    expect(state.hint).toBeNull();
    expect(insertTextFor(state.hits[0])).toBe("Deuteronomy ");
  });

  test("exact book shows chapter hint and cannot go yet", () => {
    const state = jumpState("Deuteronomy ");
    expect(state.hits.length).toBe(0);
    expect(state.hint).toBe("34 chapters");
    expect(canGo("Deuteronomy ")).toBe(false);
  });

  test("chapter hit includes verse hint and can go", () => {
    const state = jumpState("Deuteronomy 3");
    expect(state.hits[0]?.kind).toBe("chapter");
    expect(state.hint).toBe("29 verses");
    expect(canGo("Deuteronomy 3")).toBe(true);
    expect(insertTextFor(state.hits[0])).toBe("Deuteronomy 3");
  });

  test("full verse clears hint and can go", () => {
    const state = jumpState("Deuteronomy 3:16");
    expect(state.hint).toBeNull();
    expect(canGo("Deuteronomy 3:16")).toBe(true);
  });

  test("John narrows from book to chapter to verse", () => {
    const book = jumpState("joh");
    expect(book.hits[0]?.kind).toBe("book");
    expect(book.hits[0]?.label).toBe("John");
    expect(insertTextFor(book.hits[0])).toBe("John ");
    expect(canGo("joh")).toBe(false);

    const named = jumpState("john");
    expect(named.hits).toEqual([]);
    expect(named.hint).toBe("21 chapters");
    expect(canGo("john")).toBe(false);

    const chapter = jumpState("john 3");
    expect(chapter.hits[0]?.kind).toBe("chapter");
    expect(chapter.hits[0]?.label).toBe("John 3");
    expect(chapter.hint).toBe("36 verses");
    expect(canGo("john 3")).toBe(true);

    const verses = jumpState("john 3:");
    expect(verses.hits[0]?.kind).toBe("verse");
    expect(verses.hits[0]?.label).toBe("John 3:1");
    expect(verses.hint).toBe("36 verses");

    const verse = jumpState("john 3:16");
    expect(verse.hits.map((hit) => hit.label)).toContain("John 3:16");
    expect(verse.hits.every((hit) => hit.kind === "verse")).toBe(true);
    expect(canGo("john 3:16")).toBe(true);
  });

  test("passageContext tracks book/chapter/verse", () => {
    expect(passageContext("deut")).toEqual({ book: "DEU" });
    expect(passageContext("Deuteronomy 3")?.chapter).toBe(3);
    expect(passageContext("Deuteronomy 3:2")?.verse).toBe(2);
  });
});
