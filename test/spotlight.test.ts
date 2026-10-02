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

  test("dim is pure CSS on the focused bullet, and chrome stays out of it", () => {
    expect(css).toContain("html.spotlight-on:has(.otext:focus) .verse");
    expect(css).toContain("opacity: 0.3;");
    expect(css).toContain("html.spotlight-on:has(.otext:focus) .verse:focus-within");
    expect(css).toContain("opacity: 1;");
    expect(css).toContain("html.spotlight-on:has(.otext:focus)::before");
    expect(css).toContain("radial-gradient(");
    expect(css).toContain("html.spotlight-on #chapter { padding-top: 50vh; }");
    expect(css).toContain("html.spotlight-on #more-menu-btn { display: none; }");
    expect(css).not.toContain("html.spotlight-on:has(.otext:focus) .topbar");
    expect(css).not.toContain("html.spotlight-on:has(.otext:focus) .jump");
  });

  test("header offers More, a focus chip, and the shortcut", () => {
    expect(html).toContain('id="more-menu-btn"');
    expect(html).toContain('id="spotlight-chip"');
    expect(html).toContain('id="spotlight-toggle"');
    expect(html).toContain('aria-keyshortcuts="Control+K Meta+K"');
    expect(html).toContain("M232 120h-8.34A96.14");
    expect(html).toContain("M140 128a12 12 0 1 1-12-12");
    const expandIdx = html.indexOf('id="expand-all-btn"');
    expect(html.indexOf('id="spotlight-chip"')).toBeGreaterThan(expandIdx);
  });

  test("client toggles two classes and persists the mode per browser", () => {
    expect(source).toContain('const SPOTLIGHT_KEY = "margin_spotlight"');
    expect(source).toContain('localStorage.setItem(SPOTLIGHT_KEY, next ? "true" : "false")');
    expect(page("t", "")).toContain('localStorage.getItem("margin_spotlight") === "true"');
    expect(source).toContain('classList.add("spotlight-on")');
    expect(source).toContain('classList.add("spotlight-fade")');
    expect(source).toContain("const KEYBOARD_SLIDE_MS = 120");
    expect(source).toContain("const POINTER_SLIDE_MS = 200");
    expect(source).toContain("const BREATH_MS = 200");
    expect(source).toContain("function centerScrollDelta");
    expect(source).toContain("if (topAlign) return rowTop - viewTop - stickyHeaderPx");
    expect(source).toContain("sel.isCollapsed");
    expect(source).toContain('event.key === "k" || event.key === "K"');
  });
});
