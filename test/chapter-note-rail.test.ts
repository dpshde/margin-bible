import { describe, expect, test } from "bun:test";
import { page } from "../src/html";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("chapter note rail CSS", () => {
  const css = page("t", "<p>x</p>");

  test("peek row is nearly invisible with transform/opacity hover (no width anim)", () => {
    expect(css).toContain(".chapter-note-peek");
    expect(css).toContain(".chapter-note-peek-bar");
    expect(css).toContain("transform: scaleX(1)");
    expect(css).toContain("transition: background .15s ease, opacity .15s ease, transform .15s ease");
    expect(css).not.toContain("transition: background .15s ease, width .15s ease");
    expect(css).toContain('.chapter-note-rail.is-open .chapter-note-peek { display: none; }');
  });

  test("chapter tray matches jump width and keeps light internal padding", () => {
    expect(css).toContain("margin: 0 0 .35rem;\n      /* Keep air vertical without shrinking the shared left/right edges. */\n      padding: .28rem 0 .42rem;");
    expect(css).not.toContain("margin: 0 0 .35rem calc(var(--verse-inset) + var(--verse-gutter) + var(--verse-gutter-gap));");
    expect(css).not.toContain("margin: 0 0 .35rem calc(var(--verse-gutter) + var(--verse-gutter-gap));");
    expect(css).toContain(".chapter-tray .outliner {\n      padding: .42rem 0;");
    expect(css).toContain(".chapter-tray {\n        margin-left: 0;\n        padding: .24rem 0 .36rem;");
  });

  test("hint can be hidden after interact", () => {
    expect(css).toContain(".hint[hidden] { display: none !important; }");
    expect(css).toContain("cursor: pointer;");
  });
});

describe("chapter note rail client boot", () => {
  const client = readFileSync(path.join(import.meta.dir, "../src/reader-client.ts"), "utf8");

  test("opens from ?chapter_note=1 and syncs rail has-note", () => {
    expect(client).toContain('get("chapter_note") === "1"');
    expect(client).toContain("setChapterNoteOpen(true, { push: false, focus: false })");
    expect(client).toContain('rail.dataset.hasNote = hasNote ? "true" : "false"');
  });
});
