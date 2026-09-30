import { describe, expect, test } from "bun:test";
import { page } from "../src/html";

describe("note tray CSS density", () => {
  const css = page("t", "<p>x</p>");

  test("otext matches Rails-like tight line box (no tap min-height / vertical padding)", () => {
    expect(css).toContain("min-height: 1.55em; line-height: 1.55");
    expect(css).toContain(".otext {\n      flex: 1; min-width: 0; min-height: 1.55em; line-height: 1.55;\n      padding: 0;");
    expect(css).not.toContain("min-height: var(--tap); line-height: 1.45");
    expect(css).not.toContain("padding: .55rem 0; white-space: pre-wrap");
  });

  test("obullet height follows the text line, not --tap", () => {
    expect(css).toContain("width: 1.35rem; min-width: 1.35rem; height: 1.55em;");
    expect(css).not.toContain("width: 1.35rem; min-width: 1.35rem; height: var(--tap);");
  });

  test("outliner has no forced tall min-height void", () => {
    expect(css).toContain("border-radius: .65rem; padding: .22rem 0; min-height: 0;");
    expect(css).not.toContain("min-height: 5.5rem");
    expect(css).not.toContain("min-height: 2.75rem");
  });

  test("tray-head stays a minimal footer under notes without safe-bottom void", () => {
    expect(css).toContain(".tray-head {\n      position: sticky;\n      bottom: 0;");
    expect(css).toContain("display: block;");
    expect(css).toContain(".tray-meta {");
    expect(css).toContain("padding: .05rem 0;");
    expect(css).not.toContain("flex-direction: column; gap: .1rem;");
    expect(css).not.toContain("padding: .3rem 0 calc(.35rem + var(--safe-bottom));");
    expect(css).toContain(".tray-status:empty { display: none; }");
    expect(css).not.toContain("order: 2;");
  });

  test("adjacent selected verse rails collapse their inter-row gap", () => {
    expect(css).toContain(".verse:is(.has-note, .is-open, .is-span):has(+ .verse:is(.has-note, .is-open, .is-span)) { margin-bottom: 0; }");
    expect(css).toContain(".verse:is(.has-note, .is-open, .is-span) + .verse:is(.has-note, .is-open, .is-span) { margin-top: 0; }");
    expect(css).toContain(".verse.is-open::before,\n    .verse.is-span::before");
  });

  test("note-tray bottom gap is tight before the next verse", () => {
    expect(css).toContain("padding: .12rem 0 .28rem;");
    // Contiguous selection: tray gap only when next verse is outside the marked/open run.
    expect(css).toContain(".verse:has(.note-tray:not([hidden])) + .verse:not(.has-note):not(.is-open):not(.is-span) { margin-top: .15rem; }");
    expect(css).toContain(".verse:has(.note-tray:not([hidden])) + .verse:is(.has-note, .is-open, .is-span) { margin-top: 0; }");
    expect(css).not.toContain(".verse:has(.note-tray:not([hidden])) + .verse { margin-top: .15rem; }");
    expect(css).not.toContain("padding: .2rem 0 .7rem;");
  });

  test("is-span selection rail matches is-open chrome", () => {
    expect(css).toContain(".verse.is-open,\n    .verse.is-span { border-left: 0; }");
    expect(css).toContain(".verse.is-open .vtext,\n    .verse.is-span .vtext");
  });

  test("stacked open trays tighten vertical spacing", () => {
    expect(css).toContain(".note-tray:not([hidden]) + .note-tray:not([hidden])");
    expect(css).toContain("padding-top: 0");
  });

  test("attachments stay a tight strip under the editor (not a tall band)", () => {
    expect(css).toContain(".note-tray:has(.att-board:not([hidden]))");
    expect(css).toContain(".note-tray:has(.att-board:not([hidden])) .outliner");
    expect(css).toContain(".note-tray:has(.att-board:not([hidden])) .att-board");
    expect(css).toContain(".note-tray:has(.att-board:not([hidden])) .tray-head");
    expect(css).toContain("padding: .12rem 0 .28rem;");
    expect(css).toContain(".note-tray:has(.att-board:not([hidden])) .outliner,\n    .chapter-tray:has(.att-board:not([hidden])) .outliner {\n      padding: .22rem 0;");
    expect(css).toContain("margin-top: .16rem;\n      gap: .3rem;");
    expect(css).toContain("margin-top: .1rem;\n      padding: .05rem 0;");
    expect(css).not.toContain("margin-top: .3rem;\n      gap: .28rem;");
    expect(css).not.toContain("padding: .08rem 0 .35rem;");
    expect(css).not.toContain("padding: .04rem 0 .1rem;");
    expect(css).not.toContain("margin-top: .08rem;");
    expect(css).toContain("padding: .1rem .45rem;");
    expect(css).toContain("width: 1.15rem; height: 1.15rem; min-width: 1.15rem; min-height: 1.15rem;");
    expect(css).not.toContain("min-width: var(--tap); min-height: var(--tap); padding: 0;\n      border: 0; border-radius: 999px; background: transparent;\n      color: var(--faint); cursor: pointer;\n    }\n    @media (hover: hover) and (pointer: fine) {\n      .att-remove:hover");
  });

  test("Saved status folds into tray footer meta near the ref label", () => {
    expect(css).toContain(".tray-meta {");
    expect(css).toContain("display: inline-flex; align-items: baseline; gap: .4rem;");
    expect(css).not.toContain(".tray-status {\n      margin: 0; font-size: .72rem; color: var(--muted); line-height: 1.2;\n      order: 2;");
  });

  test("note-tray open/close animation uses grid-rows clip", () => {
    expect(css).toContain("display: grid !important;");
    expect(css).toContain("will-change: grid-template-rows, opacity;");
    expect(css).toContain(".note-tray.is-tray-anim > .note-tray-clip");
    expect(css).toContain("min-height: 0;");
    expect(css).not.toContain("will-change: height, opacity;");
  });
});

describe("expand-all topbar chrome", () => {
  const css = page("t", "<p>x</p>");

  test("expand-btn.is-on matches icon-btn density (no inset bordered pill)", () => {
    expect(css).toContain(".expand-btn.is-on {\n      color: var(--ink); background: var(--fill);\n    }");
    expect(css).not.toContain("box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 16%, transparent)");
    expect(css).toContain(".expand-btn .expand-icon-out");
    expect(css).toContain(".expand-btn .expand-icon-in");
    expect(css).toContain(".expand-btn.is-on .expand-icon-in");
  });
});
