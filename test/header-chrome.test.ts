import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderChapterPage } from "../src/reader-page";
import { parsePassage } from "../src/passage";
import type { ChapterPack } from "../src/usj";

const pack = JSON.parse(
  readFileSync(path.join(import.meta.dir, "../assets/bsb/jhn.3.json"), "utf8"),
) as ChapterPack;
const passage = parsePassage("jhn.3")!;

describe("header chrome without chapter note pencil", () => {
  test("keeps profile, bookmark, expand — no note-pencil in topbar", () => {
    const html = renderChapterPage({ passage, pack, notes: [] });
    expect(html).not.toContain('id="chapter-note-btn"');
    expect(html).not.toContain('aria-label="Chapter note"');
    expect(html).toContain('id="chapter-bookmark-btn"');
    expect(html).toContain('aria-label="Bookmark chapter"');
    expect(html).toContain('id="expand-all-btn"');
    // auth chip (profile / sign-in) still present
    expect(html).toContain("auth-chip");
    // note-pencil path should not appear in the page (moved out of header)
    expect(html).not.toContain("m229.66 58.34l-32-32a8 8 0 0 0-11.32 0l-96 96");
    // bookmark-simple still present for chapter bookmark + tray bookmarks
    expect(html).toContain("M184 32H72a16 16 0 0 0-16 16v176a8 8 0 0 0 12.24 6.78L128 193.43");
    const bmIdx = html.indexOf('id="chapter-bookmark-btn"');
    const expandIdx = html.indexOf('id="expand-all-btn"');
    expect(bmIdx).toBeGreaterThan(-1);
    expect(expandIdx).toBeGreaterThan(bmIdx);
  });

  test("chapter bookmark button reflects bookmarked chapter note on SSR", () => {
    const html = renderChapterPage({
      passage,
      pack,
      notes: [
        {
          slug: "jhn.3",
          kind: "chapter",
          verseStart: null,
          verseEnd: null,
          blocks: [{ id: "b1", indent: 0, text: "", bullet: true }],
          bookmarked: true,
          attachments: [],
        },
      ],
    });
    expect(html).toMatch(/id="chapter-bookmark-btn"[^>]*aria-pressed="true"/);
    expect(html).toContain('class="icon-btn is-on"');
  });

  test("chapter note lives in an expandable rail above chapter text", () => {
    const html = renderChapterPage({ passage, pack, notes: [] });
    expect(html).toContain('id="chapter-note-rail"');
    expect(html).toContain('id="chapter-note-peek"');
    expect(html).toContain('id="chapter-tray"');
    expect(html).toContain('aria-controls="chapter-tray"');
    expect(html).toContain("chapter-note-peek-bar");
    const peekIdx = html.indexOf('id="chapter-note-peek"');
    const trayIdx = html.indexOf('id="chapter-tray"');
    const chapterIdx = html.indexOf('id="chapter"');
    expect(peekIdx).toBeGreaterThan(-1);
    expect(trayIdx).toBeGreaterThan(peekIdx);
    expect(chapterIdx).toBeGreaterThan(trayIdx);
  });

  test("client toggles chapter note via peek row, not header pencil", () => {
    const client = readFileSync(path.join(import.meta.dir, "../src/reader-client.ts"), "utf8");
    expect(client).not.toContain("#chapter-note-btn");
    expect(client).toContain("#chapter-note-peek");
    expect(client).toContain("setChapterNoteOpen");
    expect(client).toContain("syncChapterNoteChrome");
    expect(client).toContain("#chapter-bookmark-btn");
    expect(client).toContain("syncChapterBookmarkBtn");
    expect(client).toContain('history.replaceState({}, "", "/" + chapterSlug + "?chapter_note=1")');
    expect(client).toContain("const next = !isBookmarked(tray);");
  });

  test("reader hint dismisses once interacted (localStorage)", () => {
    const html = renderChapterPage({ passage, pack, notes: [] });
    expect(html).toContain('id="reader-hint"');
    expect(html).toContain("Tap a verse to open its outliner");
    const client = readFileSync(path.join(import.meta.dir, "../src/reader-client.ts"), "utf8");
    expect(client).toContain("margin_reader_hint_v1");
    expect(client).toContain("function dismissReaderHint");
    expect(client).toContain("dismissReaderHint()");
  });
});
