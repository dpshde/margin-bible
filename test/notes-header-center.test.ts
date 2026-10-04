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
    expect(html).toContain('class="topbar-side"></div>');
    expect(html).toContain('aria-label="Reader"');
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

  test("phone-width CSS centers only the notes title; desktop tracks stay equal", () => {
    const css = readFileSync(path.join(import.meta.dir, "../src/html.ts"), "utf8");
    const desktop = css.indexOf("grid-template-columns: 1fr auto 1fr");
    const phone = css.indexOf("@media (max-width: 640px)");
    const notesRule = css.indexOf(".topbar-notes .topbar-title");
    expect(desktop).toBeGreaterThan(-1);
    expect(phone).toBeGreaterThan(desktop);
    expect(notesRule).toBeGreaterThan(phone);
    expect(css.slice(0, phone)).not.toContain(".topbar-notes");
    expect(css).toContain(".topbar { grid-template-columns: auto 1fr auto; gap: .25rem;");

    const rule = css.slice(notesRule, css.indexOf(".topbar-notes .topbar-title-btn"));
    expect(rule).toContain("grid-column: 1 / -1");
    expect(rule).toContain("grid-row: 1");
    expect(rule).toContain("justify-self: center");
    expect(rule).toContain("width: max-content");
    expect(css).toContain(".topbar-notes .topbar-actions { grid-column: 3; grid-row: 1; z-index: 2; }");
    expect(css).toContain(".topbar-notes .topbar-side { grid-column: 1; grid-row: 1; z-index: 2; }");
  });
});
