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

  test("desktop scripture column shares the jump field's left and right edges", () => {
    const desk = css.slice(css.indexOf("@media (min-width: 656px)"), css.indexOf(".note-tray, .chapter-tray {"));
    expect(desk).toContain(".section-head { margin-left: 0; margin-right: 0; }");
    expect(desk).toContain(".verse { padding-left: 0; }");
    expect(desk).toContain("--verse-rail-gap: .55rem;");
    expect(desk).toContain("--verse-gutter-gap: 1.1rem;");
    expect(desk).toContain("width: calc(100% + var(--verse-gutter) + var(--verse-gutter-gap));");
    expect(desk).toContain("margin-left: calc(-1 * (var(--verse-gutter) + var(--verse-gutter-gap)));");
    expect(css).toContain("left: calc(-1 * var(--verse-rail-gap));");
    expect(css).toContain("--verse-rail-gap: 0rem;");
    expect(css).toContain("@media (min-width: 656px) {\n      .note-tray { margin-left: 0; }");
    expect(css).not.toContain("padding-right: 1.15rem");
    const phone = css.slice(css.lastIndexOf("@media (max-width: 640px)"));
    expect(phone).toContain("#reader:has(.reader-verse-rail) .chapter,\n      #reader:has(.reader-verse-rail) .pager { padding-right: .85rem; }");
    expect(phone).toContain("--verse-inset: .65rem;");
    expect(phone).toContain("--verse-inset: .5rem;");
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
    expect(html).toContain("history.scrollRestoration = \"manual\"");
    expect(html).toContain("window.scrollTo(0, 0)");
  });

  test("a normal chapter keeps the tray closed", () => {
    const html = renderChapterPage({ passage: parsePassage("jhn.3")!, pack, notes: [] });
    expect(html).toContain('id="chapter-tray" data-slug="jhn.3" hidden');
    expect(html).not.toContain("chapter-note-rail is-open");
    expect(html).not.toContain("window.scrollTo(0, 0)");
  });

  test("a verse page still centers the verse when the chapter note is also open", () => {
    const html = renderChapterPage({
      passage: parsePassage("jhn.3.16")!,
      pack,
      notes: [],
      chapterNoteOpen: true,
    });
    expect(html).toContain('id="v16"');
    expect(html).toContain("window.scrollTo(0, target)");
    expect(html).not.toContain("window.scrollTo(0, 0)");
  });
});
