import { describe, expect, test } from "bun:test";
import { createPassage } from "../src/passage";
import { loadOutliner } from "../src/reader-client";
import { renderChapterPage } from "../src/reader-page";
import type { ChapterPack } from "../src/usj";

const pack: ChapterPack = {
  translation: "BSB",
  book: "JHN",
  chapter: 3,
  source: "test",
  license: "public-domain",
  verses: [
    { v: 16, text: "For God so loved the world", heading: "John 3:16" },
    { v: 17, text: "For God did not send His Son into the world to condemn the world" },
    { v: 18, text: "Whoever believes in Him is not condemned" },
  ],
};

describe("browser reader", () => {
  test("replaces the textarea with a verse page and outliner boot", () => {
    const html = renderChapterPage({
      passage: createPassage("JHN", 3, 16),
      pack,
      notes: [
        {
          slug: "jhn.3.16",
          osis: "JHN.3.16",
          kind: "verse",
          book: "JHN",
          chapter: 3,
          verseStart: 16,
          verseEnd: null,
          blocks: [{ id: "b_loved", indent: 0, text: "loved", bullet: true }],
        },
        {
          slug: "jhn.3.16-18",
          osis: "JHN.3.16-18",
          kind: "range",
          book: "JHN",
          chapter: 3,
          verseStart: 16,
          verseEnd: 18,
          blocks: [{ id: "b_span", indent: 0, text: "the span", bullet: true }],
        },
      ],
    });

    expect(html).not.toContain("<textarea");
    expect(html).toContain('id="reader-boot"');
    expect(html).toContain("For God so loved the world");
    expect(html).toContain('data-verse="16"');
    expect(html).toContain('data-action="chapter"');
    expect(html).toContain('data-action="expand"');
    expect(html).toContain("--paper: #f6f5f2");
    expect(html).toContain("Source+Serif+4");
    expect(html).toContain("PUT");
    expect(html).toContain("/api/notes/");
    expect(html).toContain("jhn.3.16-18");
    expect(html).toContain("jhn.3.16");
  });
});

describe("outliner edits", () => {
  const api = loadOutliner();
  const block = (id: string, text: string, indent = 0, bullet = true) => ({ id, indent, text, bullet });

  test("an empty note seeds one blank block", () => {
    expect(api.seedBlocks([], "b_blank")).toEqual([block("b_blank", "")]);
  });

  test("return splits a block into the next row", () => {
    const result = api.splitBlock([block("b_1", "loved the world")], 0, 5, "b_2");
    expect(result.blocks.map((item) => item.text)).toEqual(["loved", " the world"]);
    expect(result.focusIndex).toBe(1);
    expect(result.blocks[1].indent).toBe(0);
  });

  test("a leading space indents the second block and is consumed", () => {
    const blocks = [block("b_1", "root"), block("b_2", " child")];
    const applied = api.applyLeadingSpace(blocks, 1);
    expect(applied.changed).toBe(true);
    expect(applied.blocks[1]).toMatchObject({ text: "child", indent: 1 });
    expect(applied.blocks[0].indent).toBe(0);
  });

  test("the first block cannot indent", () => {
    expect(api.canIndent([block("b_1", "root")], 0)).toBe(false);
    expect(api.applyLeadingSpace([block("b_1", " root")], 0).changed).toBe(false);
  });

  test("bullet toggle keeps the text", () => {
    const next = api.toggleBullet([block("b_1", "loved", 0, true)], 0);
    expect(next[0]).toMatchObject({ text: "loved", bullet: false });
  });

  test("a selected empty verse and a covering range stay two trays", () => {
    const notes = [
      {
        slug: "jhn.3.16-18",
        label: "John 3:16–18",
        kind: "range",
        verseStart: 16,
        verseEnd: 18,
        blocks: [block("b_span", "span")],
      },
    ];
    const rows = api.traysForVerse(16, {
      notes,
      drafts: new Map(),
      selection: { start: 16, end: 16 },
      expanded: false,
      collapsed: new Set(),
      book: "JHN",
      chapter: 3,
      bookName: "John",
    });
    expect(rows.map((row) => row.slug)).toEqual(["jhn.3.16-18", "jhn.3.16"]);
  });

  test("expand shows a note that already has text and skips an empty one", () => {
    const notes = [
      {
        slug: "jhn.3.16",
        label: "John 3:16",
        kind: "verse",
        verseStart: 16,
        verseEnd: null,
        blocks: [block("b_1", "loved")],
      },
    ];
    const shown = api.traysForVerse(16, {
      notes,
      drafts: new Map(),
      selection: null,
      expanded: true,
      collapsed: new Set(),
      book: "JHN",
      chapter: 3,
      bookName: "John",
    });
    const hidden = api.traysForVerse(17, {
      notes,
      drafts: new Map(),
      selection: null,
      expanded: true,
      collapsed: new Set(),
      book: "JHN",
      chapter: 3,
      bookName: "John",
    });
    expect(shown.map((row) => row.slug)).toEqual(["jhn.3.16"]);
    expect(hidden).toEqual([]);
  });
});
