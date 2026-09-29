import { describe, expect, test } from "bun:test";
import { chapterJson } from "../src/chapter-api";
import type { NoteRecord } from "../src/library";
import { parsePassage } from "../src/passage";
import type { ChapterPack } from "../src/usj";

const pack: ChapterPack = {
  translation: "BSB",
  book: "JHN",
  chapter: 3,
  source: "test",
  license: "public-domain",
  verses: [
    { v: 1, text: "Nicodemus came at night.", heading: "Jesus and Nicodemus" },
    { v: 16, text: "For God so loved the world." },
  ],
};

function note(slug: string, kind: NoteRecord["kind"], text: string, verseStart: number | null, verseEnd: number | null): NoteRecord {
  return {
    slug,
    osis: slug.toUpperCase(),
    kind,
    book: "JHN",
    chapter: 3,
    verseStart,
    verseEnd,
    blocks: [{ id: "b_1", indent: 0, text, bullet: true }],
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
  };
}

describe("chapter API document", () => {
  test("focuses a verse and keeps verse and range notes side by side", () => {
    const document = chapterJson(parsePassage("jhn.3.16")!, pack, [
      note("jhn.3.16", "verse", "verse note", 16, null),
      note("jhn.3.16-18", "range", "range note", 16, 18),
    ]);
    expect(document.passage.slug).toBe("jhn.3.16");
    expect(document.passage.kind).toBe("verse");
    expect(document.chapter.slug).toBe("jhn.3");
    expect(document.chapter.verses[0]?.heading).toBe("Jesus and Nicodemus");
    expect(document.routeBibleUrl).toBe("https://route.bible/jhn.3.16");
    expect(document.notes.map((entry) => entry.slug)).toEqual(["jhn.3.16", "jhn.3.16-18"]);
    expect(document.notes[0]?.text).toBe("verse note");
    expect(document.notes[1]?.text).toBe("range note");
  });

  test("names the previous chapter across the book boundary", () => {
    const document = chapterJson(parsePassage("jhn.1")!, { ...pack, chapter: 1 }, []);
    expect(document.prev).toBe("luk.24");
    expect(document.next).toBe("jhn.2");
  });
});
