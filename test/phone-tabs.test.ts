import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { page } from "../src/html";
import { notesInboxScript } from "../src/inbox-ui";
import {
  phoneCollectionHref,
  phoneCollectionTabFromLocation,
  phoneShellScript,
  phoneTabBootScript,
} from "../src/phone-shell";
import { renderChapterPage, renderNotesIndex } from "../src/reader-page";
import { parsePassage } from "../src/passage";
import type { ChapterPack } from "../src/usj";

const pack = JSON.parse(
  readFileSync(path.join(import.meta.dir, "../assets/bsb/jhn.3.json"), "utf8"),
) as ChapterPack;

describe("phone collection tab from the location", () => {
  test("a bookmarks hash paints bookmarks even when the topics query is still there", () => {
    expect(phoneCollectionTabFromLocation("#bookmarks", "?vg=topics")).toBe("bookmarks");
    expect(phoneCollectionTabFromLocation("#groups", "?vg=topics")).toBe("groups");
    expect(phoneCollectionTabFromLocation("", "?vg=topics")).toBe("groups");
    expect(phoneCollectionTabFromLocation("", "?vg=set")).toBe("groups");
    expect(phoneCollectionTabFromLocation("", "?vg=folder")).toBe("groups");
    expect(phoneCollectionTabFromLocation("", "")).toBe("notes");
    expect(phoneCollectionTabFromLocation("#notes", "")).toBe("notes");
  });

  test("collection hrefs stay on /notes so the lists do not reload each other", () => {
    expect(phoneCollectionHref("notes")).toBe("/notes");
    expect(phoneCollectionHref("bookmarks")).toBe("/notes#bookmarks");
    expect(phoneCollectionHref("groups")).toBe("/notes#groups");
  });
});

describe("phone tab first paint", () => {
  test("hash is chosen before the topics query, and the list opens before the feed", () => {
    const boot = phoneTabBootScript();
    expect(boot.indexOf('hash === "bookmarks"')).toBeLessThan(boot.indexOf('vg === "topics"'));
    const notes = renderNotesIndex([], "jhn.3");
    expect(notes.indexOf('setAttribute("data-phone-tab"')).toBeLessThan(notes.indexOf('id="bookmarks-view"'));
    expect(notes.indexOf('id="verse-groups-view"')).toBeLessThan(notes.indexOf("bookmarks.open = tab === \"bookmarks\""));
    expect(notes.indexOf("bookmarks.open = tab === \"bookmarks\"")).toBeLessThan(notes.indexOf('id="notes-mount"'));
    expect(notes).toContain('href="/notes#groups"');
    expect(notes).not.toContain("/notes?vg=topics#groups");
  });

  test("pointerdown applies the tab before click can navigate", () => {
    const source = notesInboxScript();
    const bind = source.slice(source.indexOf("function bindPhoneTabs"));
    const down = bind.indexOf('addEventListener("pointerdown"');
    const click = bind.indexOf('addEventListener("click"');
    expect(down).toBeGreaterThan(-1);
    expect(down).toBeLessThan(click);
    const pointer = bind.slice(down, click);
    expect(pointer).toContain("apply(name)");
    expect(pointer).not.toContain("location.href");
    const clickBody = bind.slice(click, bind.indexOf("bindPhoneTabs();"));
    expect(clickBody).toContain("preventDefault()");
    expect(clickBody.indexOf("apply(name)")).toBeLessThan(clickBody.indexOf("pushState"));
    expect(clickBody).toContain('"/notes#" + name');
    expect(source).toContain("window.__marginApplyPhoneTab");
  });
});

describe("phone reader stays mounted", () => {
  test("the shell preloads the other surface and reveals it only after its own tab is painted", () => {
    const source = phoneShellScript();
    expect(source).not.toContain("document.write");
    expect(source).not.toContain("document.open");
    expect(source).toContain('frame.loading = "eager"');
    expect(source).toContain("phone_embed");
    expect(source).toContain("window.parent !== window");
    expect(source).toContain("getElementById(\"reader\")");
    expect(source).not.toContain("reader.remove(");
    const show = source.slice(source.indexOf("function showCollection"), source.indexOf("function showTab"));
    expect(show.indexOf("/* paint tab before reveal */")).toBeLessThan(show.indexOf("/* reveal kept surface */"));
    expect(show.indexOf("__marginApplyPhoneTab(tab)")).toBeLessThan(show.indexOf("reveal(frame)"));
    expect(source).toContain('performance.mark("margin-phone-reader")');
    const chapter = renderChapterPage({ passage: parsePassage("jhn.3")!, pack, notes: [] });
    const notes = renderNotesIndex([], "jhn.3");
    expect(chapter).toContain("phone-kept-surface");
    expect(notes).toContain("phone-kept-surface");
    expect(chapter).toContain('id="reader"');
  });
});

describe("phone bookmark cards reuse the topic card", () => {
  test("the shared card rule lives in the phone query and desktop does not restyle bookmark rows", () => {
    const css = page("t", "<p>x</p>");
    const marker = css.indexOf("/* phone-collection-card */");
    expect(marker).toBeGreaterThan(-1);
    const before = css.slice(Math.max(0, marker - 500), marker);
    expect(before).toContain("max-width: 767px");
    expect(before).not.toContain("min-width: 768px");
    const block = css.slice(marker, marker + 3600);
    expect(block).toContain("#verse-groups-view .verse-group,\n      #bookmarks-view .collection-card {");
    expect(block).toContain("border-radius: .75rem;");
    expect(block).toContain("html[data-phone-tab=\"groups\"] #verse-groups-view,\n      html[data-phone-tab=\"bookmarks\"] #bookmarks-view { background: var(--paper); }");
    expect(block).not.toContain("background: var(--fill)");
    expect(block).toContain("background: var(--paper);");
    expect(block).toContain("#verse-groups-view .verse-group[open] > summary.note-row");
    expect(block).toContain("background: transparent;");
    expect(block).toContain("gap: .4rem;");
    expect(block).toContain("padding: .45rem .8rem;");
    expect(block).toContain("font-weight: 600;");
    expect(block).toContain("color: var(--muted);");
    const desktop = css.indexOf("@media (min-width: 768px)");
    expect(desktop).toBeGreaterThan(marker);
    expect(css.slice(desktop)).not.toContain("#bookmarks-view .collection-card");
    expect(css).toContain(".bookmarks-panel .note-list .note-row { border-radius: .35rem; }");
    expect(css).toContain("iframe.phone-kept-surface { display: none; }");
    const phoneFrame = css.indexOf("iframe.phone-kept-surface.is-live");
    const frameMedia = css.lastIndexOf("@media", phoneFrame);
    expect(css.slice(frameMedia, phoneFrame)).toContain("max-width: 767px");
  });
});
