import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isDocumentPrefetch } from "../src/index";
import { renderChapterPage, renderMissing, renderNotesIndex } from "../src/reader-page";
import { parsePassage } from "../src/passage";
import { chapterGridHtml } from "../src/chapter-grid";
import { verseGroupsScript } from "../src/verse-groups-ui";
import type { ChapterPack } from "../src/usj";

const pack = JSON.parse(
  readFileSync(path.join(import.meta.dir, "../assets/bsb/jhn.3.json"), "utf8"),
) as ChapterPack;

describe("document prefetch does not count as a read", () => {
  test("sec-purpose, purpose, and the margin header are prefetches", () => {
    const headers = (values: Record<string, string>) => (name: string) => values[name];
    expect(isDocumentPrefetch(headers({ "sec-purpose": "prefetch" }))).toBe(true);
    expect(isDocumentPrefetch(headers({ purpose: "prefetch" }))).toBe(true);
    expect(isDocumentPrefetch(headers({ "x-margin-prefetch": "1" }))).toBe(true);
    expect(isDocumentPrefetch(headers({}))).toBe(false);
    expect(isDocumentPrefetch(headers({ "sec-purpose": "navigate" }))).toBe(false);
  });
});

describe("mobile header chrome", () => {
  test("an open verse keeps the chapter name in the header", () => {
    const passage = parsePassage("jhn.3.16")!;
    const html = renderChapterPage({ passage, pack, notes: [] });
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    const start = header.indexOf('id="chapter-grid-title"');
    const button = header.slice(start, header.indexOf("</button>", start));
    expect(button).toContain(">John 3");
    expect(button).not.toContain("John 3:16");
    expect(html).toContain("margin_last_read");
    expect(html).toContain("history.replaceState");
  });

  test("closing search drops a full-text query instead of writing it back", () => {
    const source = readFileSync(path.join(import.meta.dir, "../src/jump-ui.ts"), "utf8");
    const close = source.slice(source.indexOf("function closeSearchModal"), source.indexOf("function bindSheetSwipe"));
    expect(close).toContain('mirrorHeader("")');
    expect(close).toContain('syncSearchQuery("")');
    const pop = source.slice(source.indexOf("function onSearchPop"), source.indexOf("const previous = window.__marginJumpShortcut"));
    expect(pop).not.toContain("syncSearchQuery(cache.query)");
    const submit = source.slice(source.indexOf("async function submitJump"), source.indexOf("function suggest()"));
    const canGo = submit.slice(submit.indexOf("local && local.canGo"), submit.indexOf("fetch(\"/api/jump-suggest"));
    expect(canGo.indexOf('syncSearchQuery("")')).toBeLessThan(canGo.indexOf("passageHref"));
  });

  test("signed-in notes and missing pages label the profile control Profile", () => {
    const notes = renderNotesIndex([], "jhn.9.5", { signedIn: true });
    const missing = renderMissing("Couldn’t resolve that passage.", { signedIn: true });
    for (const html of [notes, missing]) {
      expect(html).toContain('aria-label="Profile"');
      expect(html).toContain('title="Profile"');
      expect(html).not.toContain('aria-label="Sign in"');
    }
    const guest = renderNotesIndex([], "jhn.1");
    expect(guest).toContain('aria-label="Sign in"');
    expect(guest).toContain('data-reader-link');
    expect(guest).toContain("margin_last_read");
  });
});

describe("phone chapter sheet and verse-group description", () => {
  test("the chapter picker has a drag handle and closes on a downward swipe", () => {
    const html = chapterGridHtml("JHN", 3);
    expect(html).toContain('class="chapter-grid-handle"');
    expect(html).toContain("max-width: 767px");
    expect(html).toContain("is-grid-open");
    const notes = renderNotesIndex([], "jhn.1");
    expect(notes).toContain('id="bookmarks-view"');
    expect(notes).toContain('id="verse-groups-view"');
    expect(notes).toContain('class="phone-tabs"');
    expect(notes).toContain('aria-label="Scripture"');
    expect(notes).toContain('aria-label="Notes"');
    expect(notes).toContain('aria-label="Bookmarks"');
    expect(notes).toContain('aria-label="Verse groups"');
    expect(notes).toContain('class="phone-tab-icon"');
    expect(notes).toContain('data-phone-tab="bookmarks"');
    expect(notes).toContain('data-phone-tab="groups"');
    expect(notes).toContain("min-height: 3.35rem");
    expect(notes).toContain("bindPhoneTabs");
    expect(notes).toContain("dy >= 72");
    const css = notes;
    expect(css).toContain(".bookmarks-view > summary::after,\n      .bookmarks-view[open] > summary::after {\n        content: none;");
    expect(css).toContain("padding-left: 0;");
    expect(css).toContain("padding-right: 0;");
    expect(css).toContain('html[data-phone-tab="bookmarks"] #bookmarks-view');
    expect(css).toContain('html[data-phone-tab="groups"] #verse-groups-view');
    expect(css).toContain('html[data-phone-tab="bookmarks"] .bookmarks-panel:has(> .empty)');
    expect(css).toContain('html[data-phone-tab="groups"] .bookmarks-panel:has(> .empty)');
    expect(css).toContain("justify-content: center;");
    expect(css).toContain(".notes-main > #notes-mount .note-week {\n        border: 0;");
    expect(css).toContain(".notes-main > #notes-mount .note-list > li {\n        border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);");
    expect(css).toContain(".note-week {\n      margin: 0;\n      border-left: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);");
    expect(css).not.toContain("html:has(.bookmarks-view[open]) .search-fab");
    const chapter = renderChapterPage({ passage: parsePassage("jhn.1")!, pack, notes: [] });
    expect(chapter).toContain('class="phone-tabs"');
    expect(chapter).toContain('data-phone-tab="scripture"');
    expect(chapter).toContain('aria-current="page"');
  });

  test("description blur saves the typed value even after the debounce already fired", () => {
    const source = verseGroupsScript();
    const blur = source.slice(source.indexOf('panel.addEventListener("focusout"'), source.indexOf('panel.addEventListener("submit"'));
    expect(blur).toContain('target.name === "description"');
    expect(blur).toContain("card._descriptionDraft");
    expect(blur).toContain('post(card, "save"');
    const post = source.slice(source.indexOf("function post(card"), source.indexOf("function autoTitlePass"));
    expect(post).toContain("textarea.verse-group-description");
    expect(post).toContain("card._descriptionDraft");
    expect(post).toContain("savedField.defaultValue");
  });
});

describe("desktop notes chrome stays off the phone shell", () => {
  test("reader placement, accordion plus, and verse-group attach split at 768", () => {
    const css = readFileSync(path.join(import.meta.dir, "../src/html.ts"), "utf8");
    const phone = css.indexOf("@media (max-width: 767px) {\n      .icon-btn.notes-reader-desktop { display: none; }");
    expect(phone).toBeGreaterThan(-1);
    const base = css.slice(0, phone);
    const phoneCss = css.slice(phone);
    expect(base).toContain(".icon-btn.notes-reader-phone { display: none; }");
    expect(base).not.toContain(".topbar.topbar-notes {");
    expect(base).toContain(".tray-attach.vg-attach-phone { display: none; }");
    expect(base).toContain("min-width: 1.35rem; min-height: 1.35rem;");
    expect(base).toContain(".verse-group-verses .tray-attach {\n      color: var(--ink-soft);\n      width: 2rem;");
    expect(phoneCss).toContain(".icon-btn.notes-reader-phone { display: inline-flex; }");
    expect(phoneCss).toContain(".tray-attach.vg-attach-desktop { display: none; }");
    expect(phoneCss).toContain(".verse-group > summary .vg-attach-phone {\n        width: var(--tap);");
    const notes = renderNotesIndex([], "jhn.3");
    expect(notes).toContain('class="icon-btn notes-reader-desktop"');
    expect(notes).toContain('class="icon-btn notes-reader-phone"');
    expect(notes).toContain('class="phone-tabs"');
    expect(notes).toContain("max-width: 767px");
  });
});

describe("phone layout tokens", () => {
  test("pager and notes clear the FAB, and the book picker is a bottom sheet", () => {
    const css = readFileSync(path.join(import.meta.dir, "../src/html.ts"), "utf8");
    expect(css).toContain("margin-bottom: calc(3.4rem + 14px + 1rem + var(--safe-bottom))");
    expect(css).toContain("main.notes-main {\n        width: 100%;\n        max-width: none;\n        padding-bottom: calc(3.4rem + 14px + 1.25rem + var(--phone-tab-h, var(--safe-bottom)));");
    expect(css).toContain("top: calc(.7rem + var(--tap) + var(--safe-top) + 1px);");
    expect(css).toContain(".chapter-grid-sheet {\n        width: 100%;\n        max-width: none;");
    expect(css).not.toContain("border-radius: 1rem 1rem 0 0");
    expect(css).toContain(".chapter-grid-handle { display: none; }");
    expect(css).toContain("align-items: flex-end;");
    expect(css).toContain("html[data-theme=\"dark\"] .search-fab");
    expect(css).toContain("html.is-grid-open .search-fab");
    expect(css).toContain("html[data-theme=\"dark\"] .vnum { color: #e7e5e4; }");
    expect(css).toContain(".note-tray .att-chip,\n      .chapter-tray .att-chip");
    const client = readFileSync(path.join(import.meta.dir, "../src/reader-client.ts"), "utf8");
    const inbox = readFileSync(path.join(import.meta.dir, "../src/inbox-ui.ts"), "utf8");
    expect(client).toContain('"x-margin-prefetch": "1"');
    expect(inbox).toContain('"x-margin-prefetch": "1"');
    const index = readFileSync(path.join(import.meta.dir, "../src/index.ts"), "utf8");
    expect(index.indexOf('app.get("/inbox"')).toBeLessThan(index.indexOf('app.get("/:slug"'));
    expect(index).toContain('c.redirect("/notes", 302)');
  });
});
