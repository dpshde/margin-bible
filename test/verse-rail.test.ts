import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { page } from "../src/html";
import { renderChapterPage } from "../src/reader-page";
import { parsePassage } from "../src/passage";
import type { ChapterPack } from "../src/usj";
import { clientScript } from "../src/reader-client";
import { railDownAction, railPanScrollDelta, railWatchEnd, railWatchMove } from "../src/verse-rail-gesture";

function pack(name: string): ChapterPack {
  return JSON.parse(readFileSync(path.join(import.meta.dir, "../assets/bsb", name), "utf8")) as ChapterPack;
}

describe("verse rail", () => {
  const john = pack("jhn.3.json");
  const psalm = pack("psa.117.json");
  const css = page("t", "<p>x</p>");
  const source = clientScript();

  test("a long chapter renders 28 ticks and does not mark a current tick yet", () => {
    const html = renderChapterPage({ passage: parsePassage("jhn.3")!, pack: john, notes: [] });
    expect(html).toContain('class="reader-verse-rail"');
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-label="Jump to verse"');
    expect(html).toContain('aria-valuemin="1"');
    expect(html).toContain(`aria-valuemax="${john.verses.length}"`);
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('data-reader-rail-preview="true" hidden');
    expect(html.match(/data-reader-rail-dot-index="/g)).toHaveLength(28);
    expect(html).not.toContain("reader-verse-rail-dot current");
    expect(html).not.toContain('class="reader-rail-active-verse"');
  });

  test("an open verse sets the slider value without lighting the ticks", () => {
    const html = renderChapterPage({ passage: parsePassage("jhn.3.16")!, pack: john, notes: [] });
    const index = john.verses.findIndex((verse) => verse.v === 16);
    expect(html).toContain(`aria-valuenow="${index + 1}"`);
    expect(html).not.toContain("reader-verse-rail-dot current");
  });

  test("a short chapter has no rail", () => {
    expect(psalm.verses.length).toBeLessThan(8);
    const html = renderChapterPage({ passage: parsePassage("psa.117")!, pack: psalm, notes: [] });
    const body = html.slice(html.indexOf("<body"), html.indexOf('id="notes-data"'));
    expect(body).not.toContain("data-reader-rail");
    expect(body).not.toContain("reader-verse-modal");
  });

  test("the rail sits above the spotlight wash and under the header", () => {
    expect(css).toContain("html:has(.reader-verse-rail)");
    expect(css).toContain("scrollbar-width: none;");
    expect(css).toContain("html:has(.reader-verse-rail)::-webkit-scrollbar");
    expect(css).toContain(".reader-verse-rail {");
    expect(css).toContain("z-index: 6;");
    expect(css).toContain(".reader-verse-rail-dot.current");
    expect(css).toContain(".reader-verse-rail-dot.wave-1");
    expect(css).toContain(".reader-verse-rail-dot.wave-2");
    expect(css).toContain(".reader-verse-rail-dot.wave-3");
    expect(css).toContain(".reader-verse-rail.is-native-scroll { pointer-events: none; }");
    expect(css).toContain(".reader-verse-rail.is-selection-hidden { opacity: 0; pointer-events: none; }");
    expect(css).toContain("touch-action stays none on phones too");
    expect(css).not.toContain(".reader-verse-rail { touch-action: manipulation; }");
    expect(css).toContain(".reader-verse-modal[hidden] { display: none; }");
    expect(css).toContain(".verse.reader-rail-active-verse");
    expect(css).not.toContain("html.spotlight-on:has(.verse:is(.is-open, .is-span)) .reader-verse-rail");
  });

  test("normal scrolling stays decoupled from an explicit rail jump", () => {
    expect(source).toContain("The rail scrolls. It does not open a note or change the passage.");
    expect(source).toContain("function scrollRailToExact");
    expect(source).toContain("function setRailScrollTarget");
    expect(source).toContain("smoothScrollTo(top)");
    expect(source).not.toContain("delta * 0.32");
    expect(source).toContain("window.setTimeout(clearRailPreview, 350)");
    expect(source).toContain('verseRail.classList.add("is-native-scroll")');
    expect(source).toContain('dot.classList.toggle("current", distance === 0)');
    expect(source).toContain('dot.classList.toggle("wave-1", distance === 1)');
    expect(source).toContain('event.key === "Home"');
    expect(source).toContain('event.key === "End"');
    const railStart = source.indexOf("const verseRail =");
    const railEnd = source.lastIndexOf("syncChapterBookmarkBtn(Boolean(noteMap.get(chapterSlug)");
    const rail = source.slice(railStart, railEnd);
    expect(rail).not.toContain("openVerse");
    expect(rail).not.toContain("history.replaceState");
    expect(rail).not.toContain("addEventListener(\"scroll\"");
  });

  test("a finger pan is not captured; a mouse drag still scrubs", () => {
    expect(railDownAction("touch")).toBe("watch");
    expect(railDownAction("mouse")).toBe("scrub");
    expect(railDownAction("pen")).toBe("scrub");
    expect(railWatchMove(0, 0)).toBe("pending");
    expect(railWatchMove(2, 4)).toBe("pending");
    expect(railWatchMove(0, 24)).toBe("chapter");
    expect(railWatchMove(18, 4)).toBe("chapter");
    expect(railWatchEnd({ type: "pointerup", dx: 1, dy: 2, decided: false })).toBe("jump");
    expect(railWatchEnd({ type: "pointerup", dx: 0, dy: 30, decided: false })).toBe("ignore");
    expect(railWatchEnd({ type: "pointerup", dx: 1, dy: 1, decided: true })).toBe("ignore");
    expect(railWatchEnd({ type: "pointerup", dx: 1, dy: 1, decided: false, scrolled: true })).toBe("ignore");
    expect(railWatchEnd({ type: "pointercancel", dx: 0, dy: 0, decided: false })).toBe("ignore");
    expect(railPanScrollDelta(200, 260)).toBe(-60);
    expect(railPanScrollDelta(260, 200)).toBe(60);
    expect(railPanScrollDelta(Number.NaN, 10)).toBe(0);
    expect(railPanScrollDelta(10, Number.POSITIVE_INFINITY)).toBe(0);

    const watchMove = source.slice(source.indexOf("function onRailWatchMove"), source.indexOf("function onRailWatchEnd"));
    expect(watchMove).toContain("railPanScrollDelta(railWatch.lastY, event.clientY)");
    expect(watchMove).toContain("window.scrollBy(0, delta)");
    expect(watchMove).not.toContain("event.preventDefault");
    expect(watchMove).not.toContain("clearRailWatch");
    const down = source.slice(source.indexOf("function onRailPointerDown"), source.indexOf("function onRailTouchMove"));
    expect(down).toContain('railDownAction(event.pointerType) === "watch"');
    expect(down.indexOf("return;")).toBeLessThan(down.indexOf("event.preventDefault()"));
    expect(down).not.toContain("setPointerCapture");
    expect(source).toContain("Do not preventDefault and do not capture.");
    expect(source).toContain('addEventListener("touchstart", onRailTouchStart, { passive: true })');
  });
});
