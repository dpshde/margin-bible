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

function headerClass(html: string): string {
  const match = html.match(/<header class="([^"]*)">/);
  return match?.[1] ?? "";
}

describe("Notes title centering", () => {
  test("notes inbox marks its header without changing the title control", () => {
    const html = renderNotesIndex([], "jhn.3");
    expect(headerClass(html)).toBe("topbar topbar-notes");
    expect(html).toContain(
      '<button type="button" class="topbar-title-btn" id="chapter-grid-title" aria-haspopup="dialog" aria-expanded="false" aria-controls="chapter-grid" title="Choose book or chapter">Notes</button>',
    );
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    const side = header.slice(header.indexOf("topbar-side"), header.indexOf("topbar-title"));
    const actions = header.slice(header.indexOf("topbar-actions"));
    expect(side).toContain('class="icon-btn notes-reader-phone"');
    expect(side).toContain('aria-label="Reader"');
    expect(side).toContain('href="/jhn.3"');
    expect(actions).toContain('class="icon-btn notes-reader-desktop"');
    expect(actions).toContain('aria-label="Reader"');
    expect(html).toContain("theme-toggle");
  });

  test("chapter, login, and missing titles stay on the shared header", () => {
    for (const html of [
      renderChapterPage({ passage, pack, notes: [] }),
      renderLoginPage({}),
      renderMissing("Missing"),
    ]) {
      expect(headerClass(html)).toBe("topbar");
      expect(html).toContain('<header class="topbar">');
      expect(html).not.toContain('<header class="topbar topbar-notes">');
    }
  });

  test("notes title centering and the left reader control stay inside the phone query", () => {
    const css = readFileSync(path.join(import.meta.dir, "../src/html.ts"), "utf8");
    const desktop = css.indexOf("grid-template-columns: 1fr auto 1fr");
    const phone = css.indexOf("@media (max-width: 767px) {\n      .notes-reader-desktop { display: none; }");
    expect(desktop).toBeGreaterThan(-1);
    expect(phone).toBeGreaterThan(desktop);
    const rule = css.slice(phone, css.indexOf(".pager {\n        margin-bottom: calc(3.4rem + 14px + 1rem + var(--phone-tab-h"));
    expect(rule).toContain(".notes-reader-phone { display: inline-flex; }");
    expect(rule).toContain("minmax(max-content, 1fr) auto minmax(max-content, 1fr)");
    expect(rule).toContain(".topbar.topbar-notes .topbar-title {");
    expect(rule).toContain("justify-self: center");
    expect(css.indexOf(".notes-reader-phone { display: none; }")).toBeLessThan(phone);
    expect(css).not.toContain("grid-column: 1 / -1");
    expect(css).not.toContain("max-width: calc(100% - 9.5rem)");
  });
});
