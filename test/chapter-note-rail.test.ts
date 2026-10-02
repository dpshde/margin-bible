import { describe, expect, test } from "bun:test";
import { page } from "../src/html";
import { renderChapterPage } from "../src/reader-page";
import { parsePassage } from "../src/passage";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ChapterPack } from "../src/usj";

describe("chapter note rail CSS", () => {
  const css = page("t", "<p>x</p>");

  test("peek row is nearly invisible with transform/opacity hover (no width anim)", () => {
    expect(css).toContain(".chapter-note-peek");
    expect(css).toContain(".chapter-note-peek-bar");
    expect(css).toContain("transform: scaleX(1)");
    expect(css).toContain("transition: background .15s ease, opacity .15s ease, transform .15s ease");
    expect(css).not.toContain("transition: background .15s ease, width .15s ease");
    expect(css).toContain('.chapter-note-rail.is-open .chapter-note-peek { display: none; }');
  });

  test("chapter tray matches jump width and keeps light internal padding", () => {
    expect(css).toContain("margin: 0 0 .35rem;\n      /* Keep air vertical without shrinking the shared left/right edges. */\n      padding: .28rem 0 .42rem;");
    expect(css).not.toContain("margin: 0 0 .35rem calc(var(--verse-inset) + var(--verse-gutter) + var(--verse-gutter-gap));");
    expect(css).not.toContain("margin: 0 0 .35rem calc(var(--verse-gutter) + var(--verse-gutter-gap));");
    expect(css).toContain(".chapter-tray .outliner {\n      padding: .42rem 0;");
    expect(css).toContain(".chapter-tray {\n        margin-left: 0;\n        padding: .24rem 0 .36rem;");
  });

  test("hint can be hidden after interact", () => {
    expect(css).toContain(".hint[hidden],");
    expect(css).toContain('html[data-reader-hint="off"] #reader-hint { display: none !important; }');
    expect(css).toContain("cursor: pointer;");
  });
});

describe("chapter note rail client boot", () => {
  const client = readFileSync(path.join(import.meta.dir, "../src/reader-client.ts"), "utf8");

  test("opens from ?chapter_note=1 and syncs rail has-note", () => {
    expect(client).toContain('get("chapter_note") === "1"');
    expect(client).toContain("setChapterNoteOpen(true, { push: false, focus: false })");
    expect(client).toContain('rail.dataset.hasNote = hasNote ? "true" : "false"');
  });
});

describe("chapter note first paint", () => {
  const pack: ChapterPack = {
    translation: "BSB",
    book: "JHN",
    chapter: 3,
    title: "John 3",
    verses: [{ v: 16, text: "For God so loved the world" }],
  };

  test("?chapter_note=1 paints the tray open with the note", () => {
    const html = renderChapterPage({
      passage: parsePassage("jhn.3")!,
      pack,
      notes: [
        {
          slug: "jhn.3",
          kind: "chapter",
          blocks: [{ id: "b1", indent: 0, text: "chapter body", bullet: true }],
          bookmarked: false,
        },
      ],
      notesPending: false,
      chapterNoteOpen: true,
    });
    expect(html).toContain('class="chapter-note-rail is-open"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("chapter body");
    expect(html).not.toMatch(/id="chapter-tray"[^>]*\shidden/);
    expect(html).toContain('data-notes-pending="0"');
  });

  test("a normal chapter keeps the tray closed", () => {
    const html = renderChapterPage({ passage: parsePassage("jhn.3")!, pack, notes: [] });
    expect(html).toContain('id="chapter-tray" data-slug="jhn.3" hidden');
    expect(html).not.toContain("chapter-note-rail is-open");
  });
});
