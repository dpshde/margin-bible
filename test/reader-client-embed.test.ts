import { describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { clientScript } from "../src/reader-client";
import { jumpScript } from "../src/jump-ui";
import { notesInboxScript } from "../src/inbox-ui";
import { renderMissing, renderNotesIndex } from "../src/reader-page";
import { page } from "../src/html";

function nodeCheck(source: string, label: string) {
  const path = join(tmpdir(), `margin-${label}-${process.pid}.js`);
  writeFileSync(path, source);
  try {
    const result = spawnSync("node", ["--check", path], { encoding: "utf8" });
    expect(result.status, result.stderr || result.stdout).toBe(0);
  } finally {
    try { unlinkSync(path); } catch { /* ignore */ }
  }
}

describe("embedded reader scripts", () => {
  test("clientScript has no raw newlines inside string literals (node --check)", () => {
    const source = clientScript();
    expect(source.includes('slice(0, caret) + "\n" +')).toBe(false);
    expect(source.includes('slice(0, caret) + "\\n" +')).toBe(true);
    expect(source).toContain("insertNewlineAt");
    expect(source).toContain("addEventListener");
    nodeCheck(source, "client");
  });


  test("clientScript defines newId for outliner block splits", () => {
    const source = clientScript();
    expect(source).toContain("function newId()");
    expect(source).toMatch(/function newId\(\) \{[\s\S]*?return "b_"/);
    expect(source).toContain("splitAtCaret");
    // Outliner uses newId; attachments keep newAttId — both must exist.
    expect(source).toContain("function newAttId()");
  });

  test("clientScript declares lastSaved and sibling reader state", () => {
    const source = clientScript();
    expect(source).toContain("const lastSaved = new Map()");
    expect(source).toContain("const noteMap = new Map");
    expect(source).toContain("const timers = new Map()");
    expect(source).toContain("const collapsedNotes = new Set()");
    expect(source).toContain("const openVerses = new Set()");
    expect(source).toContain("let expanding = false");
    expect(source).toContain("let selectedVerse = null");
    expect(source).toContain("let attTray = null");
    expect(source).toContain("let xrefSpan = null");
    expect(source).toContain("function closeOneVerse");
    expect(source).toContain("Multi-open: show this verse's tray; leave other open trays alone");
    expect(source).not.toContain("document.querySelectorAll(\".verse\").forEach((v) => v.classList.remove(\"is-open\"));\n    const verse = document.querySelector('.verse[data-verse=\"' + verseNum + '\"]');");
  });


  test("clientScript two-space indent helpers (Rails parity)", () => {
    const source = clientScript();
    expect(source).toContain("function shouldIndentOnSpace");
    expect(source).toContain("function consumeLeadingSpace");
    expect(source).toContain("function shouldBulletOnSpace");
    expect(source).toContain("keepEditingVisible");
    expect(source).toContain("scrollBottomInset");
    expect(source).toContain("visualViewport");
  });

  test("jumpScript passes node --check", () => {
    nodeCheck(jumpScript(), "jump");
  });

  test("search prefetch and soft-nav share the reader html cache", () => {
    const source = clientScript();
    expect(source).toContain("window.__marginPrefetchChapter = prefetchSearchChapter");
    expect(source).toContain("window.__marginSoftNav = softNavTo");
    expect(source).toContain('priority: "low"');
    expect(source).toContain("new AbortController()");
    expect(source).toContain("useChapterCache");
    expect(source).toContain("htmlCache.get(chapterKey)");
    expect(source).toContain("function verseTargetFromLocation");
    expect(source).toContain("applyXref({ start: located.start, end: located.end })");
    expect(source).toContain("const chapterPromise = htmlCache.get(chapterKey);");
    const inbox = notesInboxScript();
    expect(inbox).toContain("window.__marginPrefetchChapter = prefetchSearchChapter");
    expect(inbox).toContain("window.__marginSoftNav = softNavTo");
    expect(inbox).toContain("htmlCache.get(chapterKey)");
  });

  test("the served jump script has no esbuild keep-names helper", () => {
    const script = jumpScript();
    expect(script).not.toContain("__name(");
    const html = renderMissing("missing");
    const embedded = html.slice(html.indexOf("<script>"), html.lastIndexOf("</script>"));
    expect(embedded).toContain("function passageHelpers(raw)");
    expect(embedded).not.toContain("__name(");
  });

  test("a range's left border opens one note under the last verse", () => {
    const source = clientScript();
    expect(source).toContain("function openRangeNote");
    expect(source).toContain("function rangeRailForEvent");
    expect(source).toContain('event.target?.closest?.(".verse-range-rail")');
    expect(source).toContain("function mountRangeTray");
    expect(source).toContain("The left border of a range opens that range's one note under its last verse.");
    expect(source).toContain('if (span && span.start !== span.end) return span.end;');
    nodeCheck(source, "range-rail");
  });

  test("clientScript paints contiguous is-span chrome for open range/covering trays", () => {
    const source = clientScript();
    expect(source).toContain("function syncSpanChrome");
    expect(source).toContain("function spanFromNoteSlug");
    expect(source).toContain('classList.toggle("is-span"');
    expect(source).toContain("syncSpanChrome()");
    expect(source).toContain("function syncOpenChrome");
    expect(source).toContain("The address alone does not keep the spotlight on.");
    expect(source).not.toContain('if (passage.includes("-"))');
  });

  test("clientScript animates verse note trays open/close (~100ms grid-rows)", () => {
    const source = clientScript();
    expect(source).toContain("function setNoteTray");
    expect(source).toContain("const TRAY_MS = 100");
    expect(source).toContain("is-tray-anim");
    expect(source).toContain("is-tray-closing");
    expect(source).toContain("prefers-reduced-motion");
    expect(source).toContain("ensureTrayClip");
    expect(source).toContain("transitionend");
    expect(source).toContain("grid-template-rows");
    expect(source).toContain('trans = "grid-template-rows " + TRAY_MS + "ms ease, opacity " + TRAY_MS + "ms ease"');
    expect(source).not.toContain('transition = "height " + TRAY_MS');
    expect(source).toContain("setNoteTray(tray, false)");
    expect(source).toContain("setNoteTray(tray, true, { animate: false })");
  });

  test("clientScript has snappy verse scroll and inbox prefetch", () => {
    const source = clientScript();
    expect(source).toContain("function snappyScrollIntoView");
    expect(source).toContain("function scrollBottomInset");
    expect(source).toContain("function safeInsetBottom");
    expect(source).toContain('snappyScrollIntoView(scrollTarget, { block: "nearest" })');
    expect(source).toContain("TRAY_MS + 16");
    expect(source).toContain("keepEditingVisible(focused)");
    expect(source).toContain("prefetchInbox");
    expect(source).toContain("openInbox");
    expect(source).toContain("margin_inbox_v4");
    expect(source).toContain("focus({ preventScroll: true })");
    expect(source).not.toContain("scrollIntoView({ block:");
  });

  test("expand-all scrolls first opened note tray into view after tray anim", () => {
    const source = clientScript();
    expect(source).toContain('document.querySelector(".note-tray:not([hidden])")');
    expect(source).toContain('snappyScrollIntoView(firstTray, { block: "nearest" })');
    expect(source).toContain("TRAY_MS + 16");
    // Expand click path must schedule the first-tray scroll (not only openVerse).
    expect(source).toMatch(/expanding = true;[\s\S]*?firstTray[\s\S]*?snappyScrollIntoView\(firstTray/);
  });

  test("notes inbox keeps jump bar and starter chapters", () => {
    const empty = renderNotesIndex([], "jhn.1");
    expect(empty).toContain('class="jump"');
    expect(empty).toContain('href="/jhn.3"');
    expect(empty).toContain('href="/rom.8"');
    expect(empty).toContain('href="/psa.23"');
    expect(empty).toContain('href="/deu.6"');
    expect(empty).toContain("No notes yet — jump to a passage below or type a reference.");
    expect(empty).not.toContain("This library has no notes yet");
    expect(empty).not.toContain("Cloudflare Workers");
    const withNotes = renderNotesIndex([{
      slug: "jhn.1.1",
      kind: "verse",
      verseStart: 1,
      verseEnd: 1,
      blocks: [{ id: "b1", indent: 0, text: "In the beginning", bullet: true }],
      bookmarked: false,
    }], "jhn.1");
    expect(withNotes).toContain('class="jump"');
    expect(withNotes).toContain('class="note-row"');
    expect(withNotes).toContain("John 1:1");
    // Soft-nav openInbox no longer embeds jump/list HTML — full /notes SSR owns that.
    const source = clientScript();
    expect(source).toContain('location.assign("/notes")');
    expect(source).not.toContain("el.innerHTML = inboxListHtml");
    nodeCheck(notesInboxScript(), "inbox");
    expect(notesInboxScript()).toContain("margin_inbox_v4");
    expect(notesInboxScript()).not.toContain("mount.innerHTML = rowsHtml");
    expect(page("t", "<p>hi</p>")).not.toContain("banner");
  });


  test("clientScript preserves whitespace collapse as /\\s+/g (not /s+/g)", () => {
    const source = clientScript();
    expect(source).toContain(".replace(/\\s+/g, \" \").trim()");
    expect(source).not.toMatch(/\.replace\(\/s\+\/g/);
  });

  test("splitAtCaret keeps left bullet true (Rails splitSibling parity)", () => {
    const source = clientScript();
    expect(source).toContain("current.bullet = current.bullet !== false");
    expect(source).toContain("bullet: true");
  });

  test("clientScript moves ArrowUp/Down across outliner nodes (Rails parity)", () => {
    const source = clientScript();
    expect(source).toContain("function arrowBlockNav");
    expect(source).toContain("function atFirstVisualLine");
    expect(source).toContain('event.key === "ArrowUp" || event.key === "ArrowDown"');
    expect(source).toContain("action === \"leave\"");
  });

  test("VBV-first hydrates chapter notes via /api/notes (soft-nav prefetches in parallel)", () => {
    const source = clientScript();
    expect(source).toContain("function hydrateChapterNotes");
    expect(source).toContain("function applyHydratedNotes");
    expect(source).toContain("function prefetchChapterNotes");
    expect(source).toContain("notesPending");
    expect(source).toContain("/api/notes?chapter=");
    const chapterNotes = source.slice(source.indexOf("function prefetchChapterNotes"), source.indexOf("async function hydrateChapterNotes"));
    expect(chapterNotes).toContain('credentials: "include"');
    // Chapter soft-nav still fetches notes. An exact verse or range does not.
    expect(source).toContain("function hrefIsExactNote");
    expect(source).toContain("if (slug && !hrefIsExactNote(url.href)) prefetchChapterNotes(slug)");
    expect(source).toContain("if (!hrefIsExactNote(href)) prefetchChapterNotes(slug)");
    expect(source).toContain("function extractNotesFromHtml");
    expect(source).toContain("seedNotesFromHtml");
  });

  test("soft-nav intercepts note-row chapter hops (inbox→chapter)", () => {
    const source = clientScript();
    expect(source).toContain('a.classList?.contains("note-row")');
    expect(source).toContain("Soft-nav chapter hops (pager + chapter grid + inbox note-rows)");
  });

  test("post-paint prefetch warms pager adjacent only (not whole chapter grid)", () => {
    const source = clientScript();
    expect(source).toContain("function warmAdjacentChapters");
    expect(source).toContain('document.querySelectorAll(".pager a[href]")');
    // Must not storm every data-chapter-nav grid cell after paint.
    expect(source).not.toContain('document.querySelectorAll(".pager a[href], a[data-chapter-nav][href]")');
    expect(source).toContain("do NOT select every a[data-chapter-nav]");
  });
});

describe("inbox Older chapter bundles in reader client", () => {
  test("client embeds Older chapter bundling + v4 cache", () => {
    const source = clientScript();
    expect(source).toContain("INBOX_RECENT_DAYS");
    expect(source).toContain("inboxChapterSlugOf");
    expect(source).toContain("note-row-chapter");
    expect(source).toContain("note-week-older");
    expect(source).toContain(">Older<");
    expect(source).toContain("margin_inbox_v4");
    expect(source).toContain('location.assign("/notes")');
    expect(source).not.toMatch(/touchInboxCache[\s\S]*?updatedAt: new Date\(\)\.toISOString/);
  });

  test("notes link soft-navs a warm inbox document and leaves a cold tap to the browser", () => {
    const source = clientScript();
    expect(source).toContain("prefetchInbox");
    expect(source).toContain("function prefetchInboxHtml");
    expect(source).toContain("INBOX_HTML_TTL = 20000");
    expect(source).toContain("INBOX_HTML_MAX = 120000");
    expect(source).toContain("function inboxHtmlFresh");
    expect(source).toContain("function dropInboxHtml");
    expect(source).toContain("function scheduleInboxHtml");
    expect(source).toContain('headers: { accept: "text/html", purpose: "prefetch" }');
    expect(source).toContain("htmlCache.set(href, Promise.resolve(html))");
    const click = source.slice(source.indexOf('a.getAttribute("href") === "/notes"'), source.indexOf("if (a.closest?.(\".att-drop\"))"));
    expect(click).toContain("inboxHtmlFresh()");
    expect(click).toContain("softNavTo(a.href, { push: true })");
    expect(click).not.toContain("openInbox");
    // Cold path does not preventDefault into the old client inbox. Older rows stay SSR.
    expect(source).not.toMatch(/data-inbox-link[\s\S]*?event\.preventDefault\(\);\s*openInbox/);
    expect(source).not.toContain("el.innerHTML = inboxListHtml");
    const save = source.slice(source.indexOf("A save makes the prefetched inbox document stale"), source.indexOf("syncVerseMarks();"));
    expect(save).toContain("dropInboxHtml()");
    expect(save).toContain("prefetchInbox()");
  });

  test("notesInboxScript soft-navs note-row (and Older chapter) to chapter without full reload", () => {
    const source = notesInboxScript();
    expect(source).toContain("function softNavTo");
    expect(source).toContain("function chapterSlugFromHref");
    expect(source).toContain("isInboxChapterLink");
    expect(source).toContain('a.classList?.contains("note-row")');
    expect(source).toContain("Soft-nav inbox → chapter");
    expect(source).toContain("document.write(html)");
    expect(source).toContain("/api/notes?chapter=");
    // Older chapter hrefs stay chapter-level (/rom.6), not verse OSIS.
    expect(source).toContain("Preserve Older hrefs like /rom.6");
    nodeCheck(source, "inbox-softnav");
  });

  test("openInbox and popstate full-navigate to /notes (no client list overwrite)", () => {
    const source = clientScript();
    expect(source).toContain('location.assign("/notes")');
    expect(source).toContain('location.replace("/notes")');
    expect(source).not.toContain("el.innerHTML = inboxListHtml(data.notes)");
    expect(source).toContain('"1 note"');
    expect(source).toContain(' + " notes"');
  });
});

describe("attachment xref UX", () => {
  test("http urls attach as external refs and are not parsed into xrefs", () => {
    const source = clientScript();
    const fn = source.slice(source.indexOf("function parseAttachmentInput"), source.indexOf("function normalizeAttachments"));
    expect(fn.indexOf("absoluteHttpUrl")).toBeGreaterThan(-1);
    expect(fn.indexOf("absoluteHttpUrl")).toBeLessThan(fn.indexOf("resolveWikiTarget"));
    expect(fn).toContain('kind: "url"');
    expect(fn).not.toContain("fromPath");
  });

  test("chapter soft-nav pins the window before write unless the address is a verse", () => {
    const source = clientScript();
    const inbox = notesInboxScript();
    for (const script of [source, inbox]) {
      const soft = script.slice(script.indexOf("async function softNavTo"));
      expect(soft).toContain("Chapter arrival starts at the top.");
      expect(soft.indexOf("window.scrollTo(0, 0)")).toBeGreaterThan(-1);
      expect(soft.indexOf("window.scrollTo(0, 0)")).toBeLessThan(soft.indexOf("document.open()"));
      expect(soft).toContain('history.scrollRestoration = "manual"');
    }
    const boot = source.slice(0, source.indexOf("await import"));
    expect(boot).toContain("window.scrollTo(0, 0)");
    expect(boot).toContain("arrivalPath");
  });

  test("suggest hit attaches when passage parses (no second Enter)", () => {
    const source = clientScript();
    expect(source).toContain("async function applyAttHit(hit)");
    expect(source).toContain("if (parseAttachmentInput(next))");
    expect(source).toContain("await attachFromInput(next)");
    expect(source).not.toContain("sameAttEntry(current, next) && (await attCanGo(current))");
  });

  test("dismissed xrefs are tracked so × sticks across merge/save", () => {
    const source = clientScript();
    expect(source).toContain("const dismissedXrefs = new Map()");
    expect(source).toContain('remove.title = "Remove attachment"');
    expect(source).toContain("dismissedXrefs.get(slug)?.delete(parsed.slug)");
    expect(source).toContain("set.add(chip.dataset.attSlug)");
    expect(source).toContain("mergeParsedXrefs(readAttachments(tray), blocks, dismissedXrefs.get(slug))");
  });

  test("att-drop form cannot cancel via implicit submit; close is a button", () => {
    const source = clientScript();
    expect(source).toContain('querySelector("#att-drop-form")');
    expect(source).toContain("Never let Enter / implicit submit dismiss");
    expect(source).toContain('querySelector("#att-drop-close")');
  });

  test("flush-on-attach awaits saveSlug and writes chapter notes cache", () => {
    const source = clientScript();
    expect(source).toContain("async function attachFromInput(raw)");
    expect(source).toContain("Flush-on-attach: await PUT");
    expect(source).toContain("await saveSlug(slug, blocks, {");
    expect(source).toContain("writeChapterNotesCache(chapterSlug, [...noteMap.values()])");
    expect(source).toContain("notesPrefetch.delete(chapterSlug)");
  });

  test("soft-nav and visibilitychange flush pending attach/xref before leave", () => {
    const source = clientScript();
    expect(source).toContain("const pendingSaves = new Map()");
    expect(source).toContain("async function flushAll({ keepalive = true } = {})");
    expect(source).toContain("for (const pending of pendingSaves.values()) jobs.push(pending)");
    expect(source).toContain("await Promise.allSettled(jobs)");
    // soft-nav must await flush before document.write tears the page down
    expect(source).toMatch(/async function softNavTo[\s\S]*?await flushAll\(\{ keepalive: false \}\)/);
    expect(source).toContain('document.addEventListener("visibilitychange"');
    expect(source).toContain('if (document.visibilityState === "hidden") flushAll()');
    expect(source).toContain('window.addEventListener("pagehide", flushAll)');
  });
});
