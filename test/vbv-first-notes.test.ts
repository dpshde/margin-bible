import { describe, expect, test } from "bun:test";
import { renderChapterPage } from "../src/reader-page";
import { lazyChapterNotes, parsePassage } from "../src/passage";
import { clientScript } from "../src/reader-client";
import type { ChapterPack } from "../src/usj";

const pack: ChapterPack = {
  translation: "BSB",
  book: "JHN",
  chapter: 3,
  title: "John 3",
  verses: [
    { v: 16, text: "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life." },
  ],
};

describe("when notes load with the page", () => {
  test("a chapter defers notes; a verse or range does not", () => {
    expect(lazyChapterNotes(parsePassage("jhn.3")!)).toBe(true);
    expect(lazyChapterNotes(parsePassage("jhn.3.16")!)).toBe(false);
    expect(lazyChapterNotes(parsePassage("rom.5.3-5")!)).toBe(false);
  });
});

describe("VBV-first chapter notes", () => {
  test("notesPending SSR embeds empty notes-data and marks reader pending", () => {
    const html = renderChapterPage({
      passage: parsePassage("jhn.3")!,
      pack,
      notes: [
        {
          slug: "jhn.3.16",
          kind: "verse",
          verseStart: 16,
          verseEnd: 16,
          blocks: [{ id: "b1", indent: 0, text: "loved", bullet: true }],
          bookmarked: true,
        },
      ],
      notesPending: true,
    });
    expect(html).toContain('data-notes-pending="1"');
    expect(html).toContain('<script id="notes-data" type="application/json">[]</script>');
    expect(html).toContain('href="/api/notes?chapter=jhn.3"');
    expect(html).toContain("For God so loved the world");
    // Verse shells must not be marked until hydrate (client script still mentions has-note).
    expect(html).not.toMatch(/class="[^"]*has-note/);
    expect(html).toMatch(/id="expand-all-btn"[^>]*\sdisabled/);
  });

  test("notesPending false still SSRs note markers when notes provided", () => {
    const html = renderChapterPage({
      passage: parsePassage("jhn.3.16")!,
      pack,
      notes: [
        {
          slug: "jhn.3.16",
          kind: "verse",
          verseStart: 16,
          verseEnd: 16,
          blocks: [{ id: "b1", indent: 0, text: "loved", bullet: true }],
          bookmarked: false,
        },
      ],
      notesPending: false,
    });
    expect(html).toContain('data-notes-pending="0"');
    expect(html).toContain("has-note");
    expect(html).toContain("loved");
    expect(html).not.toContain('href="/api/notes?chapter=jhn.3"');
  });

  test("clientScript hydrates notes without overwriting dirty trays", () => {
    const source = clientScript();
    expect(source).toContain("function noteIsDirty");
    expect(source).toContain("Autofocus on a direct verse link is not an edit");
    expect(source).toContain("return lastSaved.get(slug) !== key");
    expect(source).toContain("function ensureNoteTray");
    expect(source).toContain("function paintNoteIntoTray");
    expect(source).toContain("dataset.covering");
    expect(source).toContain("if (notesPending)");
  });
});

describe("range contiguous selection rail SSR", () => {
  test("focused range verses get is-open + is-span", () => {
    const rangePack: ChapterPack = {
      translation: "BSB",
      book: "ROM",
      chapter: 5,
      title: "Romans 5",
      verses: [
        { v: 3, text: "Not only that, but we also rejoice in our sufferings," },
        { v: 4, text: "perseverance, character; and character, hope." },
        { v: 5, text: "And hope does not disappoint us," },
        { v: 6, text: "For at just the right time," },
      ],
    };
    const html = renderChapterPage({
      passage: parsePassage("rom.5.3-5")!,
      pack: rangePack,
      notes: [],
    });
    expect(html).toMatch(/class="[^"]*\bis-span\b[^"]*"[^>]*id="v3"/);
    expect(html).toMatch(/class="[^"]*\bis-span\b[^"]*"[^>]*id="v4"/);
    expect(html).toMatch(/class="[^"]*\bis-span\b[^"]*"[^>]*id="v5"/);
    expect(html).toMatch(/class="[^"]*\bis-open\b[^"]*"[^>]*id="v3"/);
    expect(html).not.toMatch(/class="[^"]*\bis-span\b[^"]*"[^>]*id="v6"/);
  });
});
