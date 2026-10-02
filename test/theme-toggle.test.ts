import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderLoginPage } from "../src/login-page";
import { renderChapterPage, renderMissing, renderNotesIndex } from "../src/reader-page";
import { parsePassage } from "../src/passage";
import type { ChapterPack } from "../src/usj";

const pack = JSON.parse(
  readFileSync(path.join(import.meta.dir, "../assets/bsb/jhn.3.json"), "utf8"),
) as ChapterPack;
const passage = parsePassage("jhn.3")!;

function expectToggle(html: string) {
  expect(html).toContain('data-theme-toggle');
  expect(html).toContain("margin_theme");
  expect(html).toContain('html[data-theme="dark"]');
  expect(html).toContain("--paper: #1c1917");
  expect(html).toContain("theme-icon-moon");
  expect(html).toContain("theme-icon-sun");
  const button = html.indexOf('class="icon-btn theme-toggle"');
  const actions = html.indexOf("topbar-actions");
  expect(actions).toBeGreaterThan(-1);
  expect(button).toBeGreaterThan(actions);
}

describe("dark mode toggle", () => {
  test("chapter, notes, login, and missing pages share the header toggle", () => {
    expectToggle(renderChapterPage({ passage, pack, notes: [] }));
    expectToggle(renderNotesIndex([], "jhn.3"));
    expectToggle(renderLoginPage({}));
    expectToggle(renderMissing("Missing"));
  });

  test("the choice is stored and applied before the page paints", () => {
    const html = renderChapterPage({ passage, pack, notes: [] });
    const script = html.indexOf("margin_theme");
    const style = html.indexOf("<style>");
    expect(script).toBeGreaterThan(-1);
    expect(style).toBeGreaterThan(script);
    expect(html).toContain('localStorage.setItem(key, next)');
    expect(html).toContain('saved === "dark" || saved === "light"');
  });
});
