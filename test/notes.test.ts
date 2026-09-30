import { describe, expect, test } from "bun:test";
import { blocksFromText, bodyText, draftNote, noteCoversVerse, sequentialIds } from "../src/notes";
import { parsePassage } from "../src/passage";

describe("notes", () => {
  test("keeps indent and round-trips body text", () => {
    const blocks = blocksFromText("loved\n  the world", sequentialIds());
    expect(blocks.map((block) => [block.indent, block.text])).toEqual([
      [0, "loved"],
      [1, "the world"],
    ]);
    expect(bodyText(blocks)).toBe("loved\n  the world");
  });

  test("clamps a jump in indent", () => {
    const blocks = blocksFromText("root\n      too deep", sequentialIds());
    expect(blocks[1].indent).toBe(1);
  });

  test("verse and range drafts stay different slugs", () => {
    const ids = sequentialIds();
    const verse = draftNote(parsePassage("jhn.3.16")!, { text: "verse note" }, ids);
    const range = draftNote(parsePassage("jhn.3.16-18")!, { text: "range note" }, ids);
    expect(verse.ok && range.ok).toBe(true);
    if (!verse.ok || !range.ok) return;
    expect(verse.note.slug).toBe("jhn.3.16");
    expect(range.note.slug).toBe("jhn.3.16-18");
    expect(verse.delete).toBe(false);
    expect(range.delete).toBe(false);
  });

  test("blank text deletes and does not absorb the other address", () => {
    const cleared = draftNote(parsePassage("jhn.3.16")!, { text: "   \n" }, sequentialIds());
    expect(cleared.ok && cleared.delete).toBe(true);
  });

  test("covering a verse does not turn a chapter note into a verse note", () => {
    expect(noteCoversVerse({ kind: "verse", verseStart: 16, verseEnd: null }, 16)).toBe(true);
    expect(noteCoversVerse({ kind: "verse", verseStart: 16, verseEnd: null }, 17)).toBe(false);
    expect(noteCoversVerse({ kind: "range", verseStart: 16, verseEnd: 18 }, 17)).toBe(true);
    expect(noteCoversVerse({ kind: "chapter", verseStart: null, verseEnd: null }, 16)).toBe(false);
  });

  test("rejects an oversized note", () => {
    const huge = draftNote(parsePassage("jhn.3.16")!, { text: "a".repeat(20_001) }, sequentialIds());
    expect(huge.ok).toBe(false);
  });

  test("bookmarked empty note is kept", () => {
    const kept = draftNote(parsePassage("jhn.3.16")!, { text: "   \n", bookmarked: true }, sequentialIds());
    expect(kept.ok && !kept.delete).toBe(true);
    if (!kept.ok) return;
    expect(kept.note.bookmarked).toBe(true);
  });

  test("inline xref in text becomes an attachment on draft", () => {
    const drafted = draftNote(
      parsePassage("jhn.3.16")!,
      { text: "see [[rom.8.28]]" },
      sequentialIds(),
    );
    expect(drafted.ok).toBe(true);
    if (!drafted.ok) return;
    expect(drafted.note.attachments.some((att) => att.kind === "xref" && att.slug === "rom.8.28")).toBe(true);
  });

  test("does not resurrect a chip the client explicitly removed even if text still mentions it", () => {
    const drafted = draftNote(
      parsePassage("jhn.3.16")!,
      {
        text: "see [[rom.8.28]]",
        attachments: [],
        previousAttachments: [
          { id: "att_abcd", kind: "xref", slug: "rom.8.28", title: "Romans 8:28", source: "scan" },
        ],
      },
      sequentialIds(),
    );
    expect(drafted.ok).toBe(true);
    if (!drafted.ok) return;
    expect(drafted.note.attachments.some((att) => att.kind === "xref" && att.slug === "rom.8.28")).toBe(false);
  });
});
