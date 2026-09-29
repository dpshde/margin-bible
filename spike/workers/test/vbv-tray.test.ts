import { describe, expect, test } from "bun:test";
import { noteCoversVerse, openedVerseNeedsBlankBlock, shouldShowExpandedTray } from "../src/vbv";

describe("verse-by-verse trays", () => {
  test("a selected verse shows its tray even when the note is empty", () => {
    expect(shouldShowExpandedTray({ selected: true, hasContent: false })).toBe(true);
  });

  test("expand shows only trays that already have outline text", () => {
    expect(shouldShowExpandedTray({ expanding: true, hasContent: true })).toBe(true);
    expect(shouldShowExpandedTray({ expanding: true, hasContent: false })).toBe(false);
  });

  test("a collapsed verse stays shut while expand is on", () => {
    expect(shouldShowExpandedTray({ expanding: true, selected: true, collapsed: true, hasContent: true })).toBe(false);
  });

  test("an opened verse with no note still gets a blank block to type into", () => {
    expect(openedVerseNeedsBlankBlock(0)).toBe(true);
    expect(openedVerseNeedsBlankBlock(2)).toBe(false);
  });

  test("a verse note and a covering range stay separate records", () => {
    const verse = { kind: "verse", verseStart: 16, verseEnd: null };
    const range = { kind: "range", verseStart: 16, verseEnd: 18 };
    const chapter = { kind: "chapter", verseStart: null, verseEnd: null };
    expect(noteCoversVerse(verse, 16)).toBe(true);
    expect(noteCoversVerse(range, 17)).toBe(true);
    expect(noteCoversVerse(verse, 17)).toBe(false);
    expect(noteCoversVerse(chapter, 16)).toBe(false);
  });
});
