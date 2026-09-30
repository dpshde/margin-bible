import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderChapterPage } from "../src/reader-page";
import { parsePassage } from "../src/passage";
import type { ChapterPack } from "../src/usj";

describe("verse tray footer chrome", () => {
  const pack = JSON.parse(
    readFileSync(path.join(import.meta.dir, "../assets/bsb/jhn.3.json"), "utf8"),
  ) as ChapterPack;
  const passage = parsePassage("jhn.3.16")!;
  const html = renderChapterPage({ passage, pack, notes: [] });

  test("verse trays keep trash, paperclip, bookmark but no close ×", () => {
    // Extract one verse composer tray (data-verse-composer).
    const match = html.match(
      /data-verse-composer="1"[\s\S]*?<span class="tray-actions">([\s\S]*?)<\/span>/,
    );
    expect(match).toBeTruthy();
    const actions = match![1];
    expect(actions).toContain('class="tray-attach"');
    expect(actions).toContain('class="tray-bookmark"');
    expect(actions).toContain('class="tray-clear"');
    expect(actions).not.toContain("tray-close");
    expect(actions).not.toContain("data-close-tray");
  });

  test("Saved folds into tray-meta beside the ref (single footer row)", () => {
    expect(html).toContain('class="tray-meta"');
    expect(html).toContain('class="tray-status"');
    // status sits inside tray-meta, not as a sibling column under the toolbar
    expect(html).toMatch(/class="tray-meta"[\s\S]*?class="tray-status"[\s\S]*?<\/span>\s*<span class="tray-actions"/);
    expect(html).toContain('id="att-drop-close"');
    expect(html).toContain('type="button" class="att-drop-close"');
    expect(html).not.toContain('type="submit" class="att-drop-close"');
  });

  test("hint says tap again to close (no ×)", () => {
    expect(html).toContain("tap again to close");
    expect(html).not.toContain("tap again (or ×) to close");
  });

  test("chapter tray still has close ×", () => {
    const match = html.match(
      /id="chapter-tray"[\s\S]*?<span class="tray-actions">([\s\S]*?)<\/span>/,
    );
    expect(match).toBeTruthy();
    const actions = match![1];
    expect(actions).toContain('class="tray-close"');
    expect(actions).toContain("data-close-tray");
    expect(actions).toContain('class="tray-clear"');
    expect(actions).toContain('class="tray-attach"');
    expect(actions).toContain('class="tray-bookmark"');
  });
});

describe("expand-all header icon", () => {
  const pack = JSON.parse(
    readFileSync(path.join(import.meta.dir, "../assets/bsb/jhn.3.json"), "utf8"),
  ) as ChapterPack;
  const passage = parsePassage("jhn.3.16")!;
  const html = renderChapterPage({ passage, pack, notes: [] });

  test("stacks arrows-out + corners-in (not arrows-in collapse glyph)", () => {
    expect(html).toContain('id="expand-all-btn"');
    expect(html).toContain('class="expand-btn icon-btn"');
    expect(html).toContain('class="expand-icon-out"');
    expect(html).toContain('class="expand-icon-in"');
    // corners-in path fragment (L-bracket collapse), not the old arrows-in diagonals.
    expect(html).toContain("M152 96V48a8 8 0 0 1 16 0V88h40");
    expect(html).not.toContain("M144 104V64a8 8 0 0 1 16 0v20.69l42.34-42.35");
  });
});
