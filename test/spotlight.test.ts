import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { page } from "../src/html";
import { renderChapterPage } from "../src/reader-page";
import { parsePassage } from "../src/passage";
import type { ChapterPack } from "../src/usj";
import { clientScript } from "../src/reader-client";
import {
  spotlightFocusFollow,
  spotlightKeyboardFrame,
  spotlightTouchAction,
  spotlightViewportFollow,
} from "../src/spotlight-scroll";

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

  test("note text stays at 16px so iOS does not focus-zoom", () => {
    expect(css).toContain(".otext {\n      flex: 1; min-width: 0; min-height: 1.55em; line-height: 1.55;\n      padding: 0; white-space: pre-wrap; word-break: break-word; caret-color: var(--ink);\n      outline: none; border: 0; font-size: 16px;");
    expect(css).toContain('name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"');
    expect(css).not.toContain("maximum-scale");
  });

  test("the reader still aligns the caret while spotlight is on", () => {
    expect(source).toContain('classList.add("spotlight-on")');
    expect(source).toContain('classList.add("spotlight-fade")');
    expect(source).toContain("function smoothScrollTo");
    expect(source).toContain("Math.exp(-32 * dt)");
    expect(source).toContain("function centerScrollDelta");
    expect(source).toContain("if (topAlign) return rowTop - viewTop - stickyHeaderPx");
    expect(source).toContain('centerElement(verse.querySelector(".verse-press") || verse, false)');
    expect(source).toContain("sel.isCollapsed");
  });

  test("a finger pan cancels the glide and does not pin the open verse", () => {
    expect(spotlightTouchAction({
      dx: 1, dy: 2, coarse: true, editorFocused: true, targetInEditor: false,
    })).toEqual({ cancelGlide: false, releaseCaret: false });
    expect(spotlightTouchAction({
      dx: 0, dy: 28, coarse: true, editorFocused: true, targetInEditor: false,
    })).toEqual({ cancelGlide: true, releaseCaret: true });
    expect(spotlightTouchAction({
      dx: 0, dy: 28, coarse: true, editorFocused: true, targetInEditor: true,
    })).toEqual({ cancelGlide: true, releaseCaret: true });
    expect(spotlightTouchAction({
      dx: 28, dy: 4, coarse: true, editorFocused: true, targetInEditor: true,
    })).toEqual({ cancelGlide: true, releaseCaret: false });
    expect(spotlightTouchAction({
      dx: 12, dy: 0, coarse: false, editorFocused: true, targetInEditor: false,
    })).toEqual({ cancelGlide: true, releaseCaret: false });
    expect(spotlightFocusFollow({ placeInstant: true, coarse: true, userScrolling: false })).toBe("consume-instant");
    expect(spotlightFocusFollow({ placeInstant: false, coarse: true, userScrolling: false })).toBe("hold");
    expect(spotlightFocusFollow({ placeInstant: false, coarse: false, userScrolling: true })).toBe("hold");
    expect(spotlightFocusFollow({ placeInstant: false, coarse: false, userScrolling: false })).toBe("center");

    expect(source).toContain("function cancelScrollGlide");
    expect(source).toContain("function spotlightTouchAction");
    expect(source).toContain("function spotlightFocusFollow");
    expect(source).toContain("if (gen !== scrollGen || scrollGoal == null)");
    expect(source).toContain("if (touchPan) cancelScrollGlide()");
    expect(source).toContain("if (focusHold && focusHold.el === editing) focusHold = null");
    expect(source).toContain("editing.blur()");
    expect(source).toContain('addEventListener("wheel", () => cancelScrollGlide(), { passive: true })');
    const soon = source.slice(source.indexOf("function focusBlockSoon"), source.indexOf("function rangeAtOffset"));
    expect(soon).toContain("if (userScrolling) return;");
    expect(source).toContain("if (userScrolling) return");
    const atHold = source.indexOf('if (follow === "hold") return;');
    const atCenter = source.indexOf("centerElement(line);");
    expect(atHold).toBeGreaterThan(0);
    expect(atCenter).toBeGreaterThan(atHold);
  });

  test("a phone follows the keyboard opening once and then lets the chapter scroll", () => {
    const settled = spotlightKeyboardFrame({
      baseline: null, lowest: null, height: 800, followed: false, openedAt: null, now: 0,
    });
    expect(settled).toEqual({ baseline: 800, lowest: null, followed: false, openedAt: null, opening: false });

    const chrome = spotlightKeyboardFrame({ ...settled, height: 760, now: 10 });
    expect(chrome.opening).toBe(false);
    expect(chrome.baseline).toBe(800);

    const opening = spotlightKeyboardFrame({ ...chrome, height: 470, now: 100 });
    expect(opening.opening).toBe(true);
    expect(opening.followed).toBe(true);
    expect(opening.openedAt).toBe(100);
    expect(opening.lowest).toBe(470);

    const animating = spotlightKeyboardFrame({ ...opening, height: 420, now: 280 });
    expect(animating.opening).toBe(true);
    expect(animating.lowest).toBe(420);

    const open = spotlightKeyboardFrame({ ...animating, height: 430, now: 900 });
    expect(open.opening).toBe(false);
    expect(open.followed).toBe(true);
    expect(open.baseline).toBe(800);

    const closed = spotlightKeyboardFrame({ ...open, height: 760, now: 1200 });
    expect(closed).toMatchObject({ baseline: 760, followed: false, openedAt: null, opening: false });

    const again = spotlightKeyboardFrame({ ...closed, height: 450, now: 1500 });
    expect(again.opening).toBe(true);

    expect(spotlightViewportFollow({
      spotlight: true, coarse: true, eventType: "resize",
      userScrolling: false, fingerDown: false, keyboardOpening: true,
    })).toBe("keep");
    expect(spotlightViewportFollow({
      spotlight: true, coarse: true, eventType: "resize",
      userScrolling: false, fingerDown: false, keyboardOpening: false,
    })).toBe("ignore");
    expect(spotlightViewportFollow({
      spotlight: true, coarse: true, eventType: "resize",
      userScrolling: false, fingerDown: true, keyboardOpening: true,
    })).toBe("ignore");
    expect(spotlightViewportFollow({
      spotlight: true, coarse: true, eventType: "scroll",
      userScrolling: false, fingerDown: false, keyboardOpening: true,
    })).toBe("ignore");
    expect(spotlightViewportFollow({
      spotlight: true, coarse: true, eventType: "resize",
      userScrolling: true, fingerDown: false, keyboardOpening: true,
    })).toBe("ignore");
    expect(spotlightViewportFollow({
      spotlight: true, coarse: false, eventType: "resize",
      userScrolling: false, fingerDown: false, keyboardOpening: false,
    })).toBe("keep");
    expect(spotlightViewportFollow({
      spotlight: false, coarse: true, eventType: "scroll",
      userScrolling: false, fingerDown: false, keyboardOpening: false,
    })).toBe("keep");

    expect(source).toContain("function spotlightKeyboardFrame");
    expect(source).toContain("function spotlightViewportFollow");
    const viewport = source.slice(source.indexOf("function onViewportChange"), source.indexOf('addEventListener("resize", onViewportChange)'));
    expect(viewport).toContain("spotlightKeyboardFrame");
    expect(viewport).toContain("spotlightViewportFollow");
    expect(viewport.indexOf('if (follow === "ignore") return;')).toBeGreaterThan(0);
    expect(viewport.indexOf("keepEditingVisible(active)")).toBeGreaterThan(viewport.indexOf('if (follow === "ignore") return;'));
    expect(source).toContain('centerElement(verse.querySelector(".verse-press") || verse, false)');
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
