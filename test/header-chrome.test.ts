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
    // auth chip stays the profile glyph for guests and signed-in readers
    expect(html).toContain("auth-chip");
    expect(html).toContain('aria-label="Sign in"');
    expect(html).toContain("M230.92 212c-15.23-26.33-38.7-45.21-66.09-54.16");
    expect(html).not.toContain("M208 80h-32V56a48 48 0 0 0-96 0v24");
    // note-pencil path should not appear in the page (moved out of header)
    expect(html).not.toContain("m229.66 58.34l-32-32a8 8 0 0 0-11.32 0l-96 96");
    // bookmark-simple still present for chapter bookmark + tray bookmarks
    expect(html).toContain("M184 32H72a16 16 0 0 0-16 16v176a8 8 0 0 0 12.24 6.78L128 193.43");
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    const title = header.slice(header.indexOf('<h1 class="topbar-title">'), header.indexOf("</h1>"));
    const actions = header.slice(header.indexOf('<div class="topbar-actions">'), header.lastIndexOf("</div>"));
    expect(title).toContain('id="chapter-grid-title"');
    expect(title).toContain('id="chapter-bookmark-btn"');
    expect(title.indexOf('id="chapter-bookmark-btn"')).toBeLessThan(title.indexOf('id="chapter-grid-title"'));
    expect(title).toContain("topbar-chapter-mark");
    expect(actions).not.toContain('id="chapter-bookmark-btn"');
    expect(actions).toContain('id="expand-all-btn"');
    expect(html).toContain(".topbar-title {");
    expect(html).toContain("display: flex; align-items: center; justify-content: center;");
    expect(html).toMatch(/\.topbar-chapter-mark \{\s*flex: none;/);
    const phone = html.indexOf("@media (max-width: 640px)");
    expect(html.slice(phone)).toContain(".topbar-chapter-mark { margin-inline-start: .75rem; }");
  });

  test("chapter bookmark has no hover chrome and tighter padding toward the title", () => {
    const html = renderChapterPage({ passage, pack, notes: [] });
    const ruleStart = html.indexOf(".topbar-chapter-mark {");
    const rule = html.slice(ruleStart, html.indexOf("}", ruleStart));
    expect(rule).toContain("flex: none;");
    expect(rule).toContain("width: auto;");
    expect(rule).toContain("padding-inline-start: calc((var(--tap) - 1.1rem) / 2);");
    expect(rule).toContain("padding-inline-end: .4rem;");
    const hoverStart = html.indexOf(".icon-btn.topbar-chapter-mark:hover {");
    expect(hoverStart).toBeGreaterThan(-1);
    const hoverRule = html.slice(hoverStart, html.indexOf("}", hoverStart));
    expect(hoverRule).toContain("background: transparent;");
    expect(hoverRule).toContain("border-color: transparent;");
    expect(hoverRule).toContain("box-shadow: none;");
    const fineHover = html.indexOf("@media (hover: hover) and (pointer: fine)");
    const fineRuleStart = html.indexOf(".icon-btn.topbar-chapter-mark:hover {", fineHover);
    expect(fineRuleStart).toBeGreaterThan(fineHover);
    const fineRule = html.slice(fineRuleStart, html.indexOf("}", fineRuleStart));
    expect(fineRule).toContain("background: transparent;");
    expect(fineRule).toContain("border-color: transparent;");
    expect(fineRule).toContain("box-shadow: none;");
    const phone = html.indexOf("@media (max-width: 640px)");
    expect(html.slice(phone)).toContain(".topbar-chapter-mark { margin-inline-start: .75rem; }");
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
    expect(html).toContain('class="icon-btn is-on topbar-chapter-mark" id="chapter-bookmark-btn"');
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
    const hide = html.indexOf("margin_reader_hint_v1");
    const hint = html.indexOf('id="reader-hint"');
    expect(hide).toBeGreaterThan(-1);
    expect(hide).toBeLessThan(hint);
    expect(html).toContain('html[data-reader-hint="off"] #reader-hint');
    const client = readFileSync(path.join(import.meta.dir, "../src/reader-client.ts"), "utf8");
    expect(client).toContain("margin_reader_hint_v1");
    expect(client).toContain("function dismissReaderHint");
    expect(client).toContain("dismissReaderHint()");
  });
});
