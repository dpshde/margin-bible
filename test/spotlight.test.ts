import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { page } from "../src/html";
import { renderChapterPage } from "../src/reader-page";
import { parsePassage } from "../src/passage";
import type { ChapterPack } from "../src/usj";
import { clientScript } from "../src/reader-client";

const pack = JSON.parse(
  readFileSync(path.join(import.meta.dir, "../assets/bsb/jhn.3.json"), "utf8"),
) as ChapterPack;

describe("verse spotlight", () => {
  const css = page("t", "<p>x</p>");
  const html = renderChapterPage({ passage: parsePassage("jhn.3")!, pack, notes: [] });
  const source = clientScript();

  test("selected verses are not washed with a background tint", () => {
    expect(css).not.toContain("background: color-mix(in srgb, var(--ink) 4%, transparent);");
    expect(css).toContain(".verse.is-open::before,\n    .verse.is-span::before");
  });

  test("a selection dims the rest of the chapter, and a range stays fully readable", () => {
    expect(css).toContain("html.spotlight-on:has(.verse:is(.is-open, .is-span)) .verse");
    expect(css).toContain("opacity: 0.3;");
    expect(css).toContain("html.spotlight-on:has(.verse:is(.is-open, .is-span)) .verse:is(.is-open, .is-span)");
    expect(css).toContain(".section-head:has(+ .verse:is(.is-open, .is-span))");
    expect(css).toContain("opacity: 1;");
    expect(css).toContain("html.spotlight-on:has(.verse:is(.is-open, .is-span))::before");
    expect(css).toContain("radial-gradient(");
    expect(css).not.toContain("padding-top: 50vh");
    expect(css).not.toContain("html.spotlight-on:has(.verse:is(.is-open, .is-span)) .topbar");
    expect(css).not.toContain("html.spotlight-on:has(.verse:is(.is-open, .is-span)) .jump");
    expect(css).not.toContain(".otext:focus");
  });

  test("there is no spotlight toggle", () => {
    expect(html).not.toContain('id="more-menu-btn"');
    expect(html).not.toContain('id="spotlight-chip"');
    expect(html).not.toContain('id="spotlight-toggle"');
    expect(html).not.toContain("aria-keyshortcuts");
    expect(source).not.toContain("margin_spotlight");
    expect(source).not.toContain('event.key === "k" || event.key === "K"');
    expect(page("t", "")).toContain('classList.add("spotlight-on")');
    expect(page("t", "")).not.toContain('localStorage.getItem("margin_spotlight")');
  });

  test("the reader still aligns the caret while spotlight is on", () => {
    expect(source).toContain('classList.add("spotlight-on")');
    expect(source).toContain('classList.add("spotlight-fade")');
    expect(source).toContain("const KEYBOARD_SLIDE_MS = 120");
    expect(source).toContain("const POINTER_SLIDE_MS = 200");
    expect(source).toContain("function centerScrollDelta");
    expect(source).toContain("if (topAlign) return rowTop - viewTop - stickyHeaderPx");
    expect(source).toContain("const VERSE_SLIDE_MS = 280");
    expect(source).toContain('centerElement(verse.querySelector(".verse-press") || verse, VERSE_SLIDE_MS, false)');
    expect(source).toContain("sel.isCollapsed");
  });

  test("a verse range marks every verse in the range and leaves the neighbors out", () => {
    const range = renderChapterPage({ passage: parsePassage("jhn.3.16-18")!, pack, notes: [] });
    expect(range).toContain('document.getElementById("v18")');
    expect(range).toContain("dataset.placedScroll");
    expect(renderChapterPage({ passage: parsePassage("jhn.3")!, pack, notes: [] })).not.toContain("dataset.placedScroll");
    expect(range).toMatch(/class="verse is-open is-span" id="v16"/);
    expect(range).toMatch(/class="verse is-open is-span" id="v17"/);
    expect(range).toMatch(/class="verse is-open is-span" id="v18"/);
    expect(range).not.toMatch(/class="[^"]*is-span[^"]*" id="v15"/);
    expect(range).not.toMatch(/class="[^"]*is-open[^"]*" id="v19"/);
  });
});
