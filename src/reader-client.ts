import { EMPTY_NOTES_COPY, starterChipsHtml } from "./inbox-ui";
import { jumpFormHtml } from "./jump-ui";

/** Browser reader client script (string). Kept separate so Worker can serve a zero-build page. */
export function clientScript(): string {
  // Language: JavaScript (browser). Loads grab-bcv for wiki/attachment parsing (Rails parity).
  return `(async () => {
  if (history.scrollRestoration) history.scrollRestoration = "manual";
  // Chapter arrival starts at the top. A verse address keeps its placement.
  var arrivalPath = location.pathname.replace(/^\\/+/, "");
  if (!/^[a-z0-9]+\\.\\d+\\.\\d+/i.test(arrivalPath)) window.scrollTo(0, 0);
  const { tryParseAnyPassage } = await import("/vendor/grab-bcv/parse.js");
  const root = document.querySelector("#reader");
  if (!root) return;
  if (history.scrollRestoration) history.scrollRestoration = "manual";
  // Chapter arrival starts at the top. A verse address keeps its placement.
  if (!/^[a-z0-9]+\\.\\d+\\.\\d+/i.test(arrivalPath)) window.scrollTo(0, 0);
  const chapterSlug = root.dataset.chapterSlug;
  const notesPending = root.dataset.notesPending === "1";
  const notes = JSON.parse(document.querySelector("#notes-data").textContent || "[]");
  const noteMap = new Map(notes.map((n) => [n.slug, {
    ...n,
    bookmarked: Boolean(n.bookmarked),
    attachments: Array.isArray(n.attachments) ? n.attachments : [],
    updatedAt: n.updatedAt || "",
    createdAt: n.createdAt || "",
  }]));
  let notesHydrated = !notesPending;
  const notesPrefetch = new Map();
  const chapterNotesGen = new Map();
  let attTray = null;
  let xrefSpan = null;
  /** noteSlug → Set of xref slugs dismissed with × (until manually re-attached). */
  const dismissedXrefs = new Map();
  const timers = new Map();
  const lastSaved = new Map();
  /** In-flight PUT /api/notes/:slug promises — soft-nav awaits these so attach survives chapter hops. */
  const pendingSaves = new Map();
  let expanding = false;
  let selectedVerse = null;
  const openVerses = new Set();
  const collapsedNotes = new Set();
  const INBOX_KEY = "margin_inbox_v4";
  let readerTitle = document.title;
  let inboxOpen = false;
  let inboxPrefetch = null;
  let scrollGoal = null;
  let scrollFrame = 0;
  let scrollStamp = 0;
  let scrollGen = 0;
  // Set while a finger pan owns the page, including the momentum just after lift.
  let userScrolling = false;
  let userScrollTimer = 0;
  function cancelScrollGlide() {
    scrollGen += 1;
    scrollGoal = null;
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    scrollStamp = 0;
  }
  function armUserScroll() {
    userScrolling = true;
    if (userScrollTimer) clearTimeout(userScrollTimer);
    userScrollTimer = setTimeout(() => {
      userScrolling = false;
      userScrollTimer = 0;
    }, 800);
  }
  function coarsePointer() {
    return window.matchMedia("(hover: none), (pointer: coarse)").matches;
  }
  function spotlightTouchAction(dx, dy, coarse, editorFocused, targetInEditor) {
    const slop = 10;
    const moved = Number.isFinite(dx) && Number.isFinite(dy) && (Math.abs(dx) >= slop || Math.abs(dy) >= slop);
    if (!moved) return { cancelGlide: false, releaseCaret: false };
    const vertical = Math.abs(dy) > Math.abs(dx);
    return {
      cancelGlide: true,
      releaseCaret: !!(coarse && editorFocused && (!targetInEditor || vertical)),
    };
  }
  function spotlightFocusFollow(placeInstantFlag, coarse, scrolling) {
    if (placeInstantFlag) return "consume-instant";
    if (coarse || scrolling) return "hold";
    return "center";
  }
  function spotlightKeyboardFrame(baseline, lowest, height, followed, openedAt, now) {
    const threshold = 140;
    const settleMs = 500;
    const closeRise = 120;
    if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(now)) {
      return { baseline: baseline, lowest: lowest, followed: followed, openedAt: openedAt, opening: false };
    }
    if (baseline == null) return { baseline: height, lowest: null, followed: false, openedAt: null, opening: false };
    if (followed && lowest != null && height >= lowest + closeRise) {
      return { baseline: height, lowest: null, followed: false, openedAt: null, opening: false };
    }
    if (height > baseline) return { baseline: height, lowest: null, followed: false, openedAt: null, opening: false };
    if (baseline - height < threshold) {
      return { baseline: baseline, lowest: lowest, followed: followed, openedAt: openedAt, opening: false };
    }
    const at = openedAt == null ? now : openedAt;
    return {
      baseline: baseline,
      lowest: lowest == null ? height : Math.min(lowest, height),
      followed: true,
      openedAt: at,
      opening: now - at <= settleMs,
    };
  }
  function spotlightViewportFollow(spotlight, coarse, eventType, scrolling, fingerDown, keyboardOpening) {
    if (scrolling) return "ignore";
    if (!spotlight) return "keep";
    if (eventType !== "resize") return "ignore";
    if (!coarse) return "keep";
    if (fingerDown || !keyboardOpening) return "ignore";
    return "keep";
  }
  // One glide for every programmatic move: verse select, caret, rail, and tray follow.
  // The rate is per second, so a dropped frame does not change the curve.
  // A finger pan or wheel cancels it. The glide must not fight the reader.
  function smoothScrollTo(top) {
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const height = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
    const maxY = Math.max(0, height - vh);
    const goal = Math.max(0, Math.min(maxY, top));
    if (prefersReduceMotion()) {
      cancelScrollGlide();
      window.scrollTo(0, goal);
      return;
    }
    scrollGoal = goal;
    if (scrollFrame) return;
    scrollStamp = 0;
    const gen = scrollGen;
    const step = (now) => {
      if (gen !== scrollGen || scrollGoal == null) { scrollFrame = 0; return; }
      const dt = scrollStamp ? Math.min(0.032, (now - scrollStamp) / 1000) : 0.016;
      scrollStamp = now;
      const from = window.scrollY || window.pageYOffset || 0;
      const delta = scrollGoal - from;
      if (Math.abs(delta) < 0.5) {
        window.scrollTo(0, scrollGoal);
        scrollGoal = null;
        scrollFrame = 0;
        scrollStamp = 0;
        return;
      }
      const k = 1 - Math.exp(-32 * dt);
      window.scrollTo(0, from + delta * k);
      scrollFrame = requestAnimationFrame(step);
    };
    scrollFrame = requestAnimationFrame(step);
  }
  let touchPan = null;
  window.addEventListener("touchstart", (event) => {
    const t = event.touches && event.touches[0];
    touchPan = t ? { x: t.clientX, y: t.clientY } : null;
    // Finger down ends a glide still pulling the open verse to mid-screen.
    // A tap must still focus the note, so the caret stays until the gesture is a pan.
    if (touchPan) cancelScrollGlide();
  }, { passive: true });
  window.addEventListener("touchend", () => { touchPan = null; }, { passive: true });
  window.addEventListener("touchcancel", () => { touchPan = null; }, { passive: true });
  window.addEventListener("touchmove", (event) => {
    const t = event.touches && event.touches[0];
    if (!t || !touchPan) return;
    const active = document.activeElement;
    const editing = active && active.closest ? active.closest(".otext") : null;
    const editorFocused = !!(editing && root.contains(editing));
    const targetInEditor = !!(editorFocused && event.target && editing.contains(event.target));
    const action = spotlightTouchAction(
      t.clientX - touchPan.x,
      t.clientY - touchPan.y,
      coarsePointer(),
      editorFocused,
      targetInEditor,
    );
    if (!action.cancelGlide) return;
    cancelScrollGlide();
    armUserScroll();
    if (action.releaseCaret) {
      // Drop the Enter-focus hold too, or its timer puts the caret back and iOS pins the verse.
      if (focusHold && focusHold.el === editing) focusHold = null;
      editing.blur();
    }
  }, { passive: true });
  window.addEventListener("wheel", () => cancelScrollGlide(), { passive: true });

  function safeInsetBottom() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom").trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }
  /** Match CSS scroll-margin-bottom: 1.25rem + safe-area under tray-head. */
  function scrollBottomInset() {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return Math.round(1.25 * rem + safeInsetBottom());
  }
  function snappyScrollIntoView(el, { block = "nearest", ms = 150, bottomInset } = {}) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    let delta = 0;
    if (block === "center") {
      delta = rect.top - (vh - rect.height) / 2;
    } else {
      const padTop = 12;
      const padBottom = bottomInset != null ? bottomInset : scrollBottomInset();
      if (rect.top < padTop) delta = rect.top - padTop;
      else if (rect.bottom > vh - padBottom) delta = rect.bottom - (vh - padBottom);
      else return;
    }
    if (Math.abs(delta) < 2) return;
    const maxY = Math.max(0, (document.documentElement.scrollHeight || document.body.scrollHeight) - vh);
    const from = window.scrollY || window.pageYOffset || 0;
    const to = Math.max(0, Math.min(maxY, from + delta));
    if (Math.abs(to - from) < 2) return;
    smoothScrollTo(to);
  }

  function inboxNoteExcerpt(n) {
    const ex = n.excerpt != null ? String(n.excerpt).replace(/\\s+/g, " ").trim() : "";
    if (ex) return ex;
    const fromBlocks = String(bodyText(n.blocks || []) || "").replace(/\\s+/g, " ").trim();
    if (fromBlocks) return fromBlocks;
    return String(n.text || "").replace(/\\s+/g, " ").trim();
  }
  function inboxNormalize(notes) {
    return (notes || []).map((n) => ({
      slug: n.slug,
      label: n.label || slugLabel(n.slug),
      excerpt: inboxNoteExcerpt(n),
      bookmarked: Boolean(n.bookmarked),
      updatedAt: n.updatedAt || "",
      createdAt: n.createdAt || "",
    })).filter((n) => !n.bookmarked || n.excerpt);
  }
  function bodyText(blocks) {
    return (blocks || []).map((b) => ("  ").repeat(b.indent || 0) + (b.text || "")).join("\\n");
  }
  function readInboxCache() {
    try {
      const raw = sessionStorage.getItem(INBOX_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.notes)) return null;
      return data;
    } catch { return null; }
  }
  function writeInboxCache(notes, backSlug) {
    try {
      const prev = readInboxCache();
      sessionStorage.setItem(INBOX_KEY, JSON.stringify({
        notes: inboxNormalize(notes),
        backSlug: backSlug || prev?.backSlug || chapterSlug,
        savedAt: Date.now(),
      }));
    } catch {}
  }
  function touchInboxCache(slug, { deleted = false, blocks, bookmarked, label, updatedAt, createdAt } = {}) {
    const prev = readInboxCache() || { notes: [], backSlug: chapterSlug };
    let notes = prev.notes.filter((n) => n.slug !== slug);
    if (!deleted) {
      const excerpt = String(bodyText(blocks || [])).replace(/\\s+/g, " ").trim();
      if (excerpt) {
        const prevNote = (prev.notes || []).find((n) => n.slug === slug);
        // Prefer server timestamps — client Date.now() falsely pulls Older notes into the 14d week wall.
        const when = updatedAt || prevNote?.updatedAt || "";
        const created = createdAt || prevNote?.createdAt || when || "";
        notes.unshift({
          slug,
          label: label || slugLabel(slug),
          excerpt,
          bookmarked: Boolean(bookmarked),
          updatedAt: when,
          createdAt: created,
        });
      }
    }
    writeInboxCache(notes, chapterSlug);
  }
  function prefetchInbox() {
    // HTML goes into the soft-nav cache. JSON still warms sessionStorage.
    prefetchInboxHtml();
    if (inboxPrefetch) return inboxPrefetch;
    inboxPrefetch = fetch("/api/notes", {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      priority: "low",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.notes)) {
          writeInboxCache(data.notes, chapterSlug);
        }
        return data;
      })
      .catch((err) => { inboxPrefetch = null; throw err; });
    return inboxPrefetch;
  }
  function inboxNoteWhen(n) {
    const raw = n.updatedAt || n.createdAt || "";
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  }
  function inboxStartOfWeek(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - x.getDay());
    return x;
  }
  function inboxWeekLabel(weekStart, now) {
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const thisWeek = inboxStartOfWeek(now);
    const lastWeek = new Date(thisWeek);
    lastWeek.setDate(lastWeek.getDate() - 7);
    if (weekStart.getTime() === thisWeek.getTime()) return "This week";
    if (weekStart.getTime() === lastWeek.getTime()) return "Last week";
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const sameYear = weekStart.getFullYear() === end.getFullYear();
    const nowYear = now.getFullYear();
    const showYear = weekStart.getFullYear() !== nowYear || end.getFullYear() !== nowYear;
    if (sameYear && weekStart.getMonth() === end.getMonth()) {
      return MONTHS[weekStart.getMonth()] + " " + weekStart.getDate() + "–" + end.getDate() + (showYear ? ", " + weekStart.getFullYear() : "");
    }
    const left = MONTHS[weekStart.getMonth()] + " " + weekStart.getDate() + (showYear ? ", " + weekStart.getFullYear() : "");
    const right = MONTHS[end.getMonth()] + " " + end.getDate() + (showYear ? ", " + end.getFullYear() : "");
    return left + " – " + right;
  }
  const INBOX_RECENT_DAYS = 14;
  function inboxChapterSlugOf(slug) {
    const m = /^([a-z0-9]+)\.(\d+)/i.exec(String(slug || "").trim());
    return m ? m[1].toLowerCase() + "." + m[2] : String(slug || "").trim();
  }
  function inboxChapterTitle(n) {
    const chapterSlug = inboxChapterSlugOf(n.slug);
    // Prefer human title from slug (Romans 6), not raw OSIS.
    const fromSlug = slugLabel(chapterSlug);
    if (fromSlug && fromSlug !== chapterSlug) return fromSlug;
    const label = String(n.label || "").trim();
    const m = /^(.+?\s+\d+)(?::|$)/.exec(label);
    if (m) return m[1];
    return fromSlug || chapterSlug || label || n.slug;
  }
  function inboxNoteRow(n) {
    let titleRaw = String(n.label || "").trim();
    if (!titleRaw || /^[a-z0-9]+\.\d+/i.test(titleRaw)) titleRaw = slugLabel(n.slug) || n.slug;
    const excerpt = n.excerpt ? '<span class="note-row-excerpt">' + escapeHtml(n.excerpt) + "</span>" : "";
    const when = inboxNoteWhen(n);
    const stamp = when.getTime() ? when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
    const titleAttr = stamp ? ' title="' + escapeHtml(stamp) + '"' : "";
    return '<li><a class="note-row" href="/' + escapeHtml(n.slug) + '"' + titleAttr + '><span class="note-row-title">' + escapeHtml(titleRaw) + "</span>" + excerpt + "</a></li>";
  }
  function inboxChapterRow(ch) {
    const when = inboxNoteWhen({ updatedAt: ch.updatedAt });
    const stamp = when.getTime() ? when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
    return inboxChapterBundleRow(ch.slug, ch.label || ch.slug, { excerpt: ch.excerpt || "", stamp, rowOpensNote: true });
  }
  function inboxWeekChapterRows(notes) {
    const order = [];
    const byChapter = new Map();
    for (const n of notes) {
      const key = inboxChapterSlugOf(n.slug);
      if (!byChapter.has(key)) { byChapter.set(key, []); order.push(key); }
      byChapter.get(key).push(n);
    }
    let html = "";
    for (const slug of order) {
      const list = byChapter.get(slug);
      let verses = "";
      for (const n of list) {
        let label = String(n.label || "").trim();
        if (!label || /^[a-z0-9]+\.\d+/i.test(label)) label = slugLabel(n.slug) || label;
        const colon = label.lastIndexOf(":");
        if (colon < 0) continue;
        const place = label.slice(colon + 1).trim();
        if (!place) continue;
        const when = inboxNoteWhen(n);
        const stamp = when.getTime() ? when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
        const titleAttr = stamp ? ' title="' + escapeHtml(stamp) + '"' : "";
        verses += '<a class="note-bundle-verse" href="/' + escapeHtml(n.slug) + '" aria-label="' + escapeHtml(label) + '"' + titleAttr + ">" + escapeHtml(place) + "</a>";
      }
      if (!verses) {
        for (const n of list) {
          const when = inboxNoteWhen(n);
          const stamp = when.getTime() ? when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
          html += inboxChapterBundleRow(slug, inboxChapterTitle(n), { excerpt: n.excerpt || "", stamp });
        }
        continue;
      }
      html += inboxChapterBundleRow(slug, inboxChapterTitle(list[0]), { verses });
    }
    return html;
  }
  function inboxChapterBundleRow(slug, title, opts) {
    const titleAttr = opts.stamp ? ' title="' + escapeHtml(opts.stamp) + '"' : "";
    const body = opts.verses
      ? '<span class="note-bundle-verses">' + opts.verses + "</span>"
      : (opts.excerpt ? '<span class="note-row-excerpt">' + escapeHtml(opts.excerpt) + "</span>" : "");
    const rowClass = opts.verses ? "note-bundle" : "note-bundle note-row-chapter";
    const openHref = opts.rowOpensNote ? ("/" + escapeHtml(slug) + "?chapter_note=1") : ("/" + escapeHtml(slug));
    return '<li class="' + rowClass + '"><a class="note-bundle-open" href="' + openHref + '" tabindex="-1" aria-hidden="true"></a><a class="note-bundle-name" href="/' + escapeHtml(slug) + '?chapter_note=1"' + titleAttr + ">" + escapeHtml(title) + "</a>" + body + "</li>";
  }
  function inboxListHtml(notes) {
    const rows = inboxNormalize(notes);
    if (!rows.length) {
      return '<p class="empty">' + ${JSON.stringify(EMPTY_NOTES_COPY)} + '</p>';
    }
    const sorted = rows.slice().sort((a, b) => inboxNoteWhen(b) - inboxNoteWhen(a));
    const now = new Date();
    const cutoff = now.getTime() - INBOX_RECENT_DAYS * 24 * 60 * 60 * 1000;
    const recent = [];
    const older = [];
    for (const n of sorted) {
      const when = inboxNoteWhen(n).getTime();
      // No date → Older (never invent now). Still chapter-bundled below.
      if (when > 0 && when >= cutoff) recent.push(n);
      else older.push(n);
    }
    const parts = [];
    const groups = new Map();
    const order = [];
    for (const n of recent) {
      const key = inboxStartOfWeek(inboxNoteWhen(n)).getTime();
      if (!groups.has(key)) { groups.set(key, []); order.push(key); }
      groups.get(key).push(n);
    }
    for (const key of order) {
      const label = inboxWeekLabel(new Date(key), now);
      const list = inboxWeekChapterRows(groups.get(key));
      parts.push('<section class="note-week"><h2 class="note-week-label">' + escapeHtml(label) + '</h2><ul class="note-list">' + list + "</ul></section>");
    }
    if (older.length) {
      const byChapter = new Map();
      const chapterOrder = [];
      for (const n of older) {
        const key = inboxChapterSlugOf(n.slug);
        if (!byChapter.has(key)) { byChapter.set(key, []); chapterOrder.push(key); }
        byChapter.get(key).push(n);
      }
      const list = chapterOrder.map((slug) => {
        const chapterNotes = byChapter.get(slug);
        const newest = chapterNotes[0];
        const excerpt = chapterNotes.length === 1 ? "1 note" : (chapterNotes.length + " notes");
        const chapterSlug = /^[a-z0-9]+\.\d+\.\d+/i.test(slug) ? inboxChapterSlugOf(slug) : slug;
        return inboxChapterRow({
          slug: chapterSlug,
          label: inboxChapterTitle(newest),
          updatedAt: newest.updatedAt || newest.createdAt || "",
          excerpt,
        });
      }).join("");
      parts.push('<section class="note-week note-week-older"><h2 class="note-week-label">Older</h2><ul class="note-list">' + list + "</ul></section>");
    }
    return parts.join("");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function ensureInboxMount() {
    let mount = document.getElementById("inbox-mount");
    if (mount) return mount;
    mount = document.createElement("div");
    mount.id = "inbox-mount";
    mount.hidden = true;
    document.body.appendChild(mount);
    mount.addEventListener("click", (event) => {
      const back = event.target.closest('a[data-inbox-back]');
      if (back) {
        event.preventDefault();
        if (history.state && history.state.inbox) history.back();
        else closeInbox({ restoreUrl: true });
        return;
      }
    });
    return mount;
  }
  function openInbox({ push = true } = {}) {
    // Hard kill soft-nav inbox paint. Client inboxListHtml previously overwrote SSR
    // Older chapter rows with verse OSIS titles (rom.6.18). Full /notes owns the list.
    if (location.pathname === "/notes" && !push) {
      location.replace("/notes");
      return;
    }
    location.assign("/notes");
  }
  function closeInbox({ restoreUrl = false } = {}) {
    const mount = document.getElementById("inbox-mount");
    if (mount) mount.hidden = true;
    root.hidden = false;
    document.title = readerTitle;
    inboxOpen = false;
    if (restoreUrl && location.pathname === "/notes") {
      history.replaceState({}, "", "/" + (root.dataset.passageSlug || chapterSlug));
    }
  }


  const BOOK_NAMES = {"GEN":"Genesis","EXO":"Exodus","LEV":"Leviticus","NUM":"Numbers","DEU":"Deuteronomy","JOS":"Joshua","JDG":"Judges","RUT":"Ruth","1SA":"1 Samuel","2SA":"2 Samuel","1KI":"1 Kings","2KI":"2 Kings","1CH":"1 Chronicles","2CH":"2 Chronicles","EZR":"Ezra","NEH":"Nehemiah","EST":"Esther","JOB":"Job","PSA":"Psalms","PRO":"Proverbs","ECC":"Ecclesiastes","SNG":"Song of Solomon","ISA":"Isaiah","JER":"Jeremiah","LAM":"Lamentations","EZK":"Ezekiel","DAN":"Daniel","HOS":"Hosea","JOL":"Joel","AMO":"Amos","OBA":"Obadiah","JON":"Jonah","MIC":"Micah","NAM":"Nahum","HAB":"Habakkuk","ZEP":"Zephaniah","HAG":"Haggai","ZEC":"Zechariah","MAL":"Malachi","MAT":"Matthew","MRK":"Mark","LUK":"Luke","JHN":"John","ACT":"Acts","ROM":"Romans","1CO":"1 Corinthians","2CO":"2 Corinthians","GAL":"Galatians","EPH":"Ephesians","PHP":"Philippians","COL":"Colossians","1TH":"1 Thessalonians","2TH":"2 Thessalonians","1TI":"1 Timothy","2TI":"2 Timothy","TIT":"Titus","PHM":"Philemon","HEB":"Hebrews","JAS":"James","1PE":"1 Peter","2PE":"2 Peter","1JN":"1 John","2JN":"2 John","3JN":"3 John","JUD":"Jude","REV":"Revelation"};

  function slugLabel(slug) {
    const m = /^([a-z0-9]+)\\.(\\d+)(?:\\.(\\d+)(?:-(\\d+))?)?$/i.exec(String(slug || ""));
    if (!m) return String(slug || "");
    const name = BOOK_NAMES[m[1].toUpperCase()] || m[1];
    if (!m[3]) return name + " " + m[2];
    if (m[4]) return name + " " + m[2] + ":" + m[3] + "–" + m[4];
    return name + " " + m[2] + ":" + m[3];
  }
  function resolveWikiTarget(raw) {
    const input = String(raw || "").trim();
    if (!input) return null;
    const parsed = tryParseAnyPassage(input);
    if (!parsed.ok) return null;
    const value = Array.isArray(parsed.value) ? parsed.value[0] : parsed.value;
    const slug = String(value?.canonical || "").toLowerCase();
    if (!slug) return null;
    return { slug, href: hrefForXref(slug), label: slugLabel(slug) };
  }
  function absoluteHttpUrl(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const candidate = /^www\\./i.test(text) ? "https://" + text : text;
    try {
      const url = new URL(candidate);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      if (!url.hostname) return null;
      return url.toString();
    } catch { return null; }
  }
  function urlTitle(url) {
    try { return new URL(url).hostname.replace(/^www\\./, "") || url; } catch { return url; }
  }
  function requestLinkTitle(url) {
    return fetch("/api/link-title?url=" + encodeURIComponent(url), { headers: { accept: "application/json" }, credentials: "same-origin" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => (data && !data.fallback && data.title ? String(data.title) : ""))
      .catch(() => "");
  }
  function applySavedUrlTitle(tray, url, fallbackTitle, pageTitle) {
    if (!tray || !pageTitle || pageTitle === fallbackTitle) return;
    const chip = [...tray.querySelectorAll(".att-chip")].find((node) => node.dataset.attKind === "url" && node.dataset.attUrl === url);
    if (!chip || (chip.dataset.attTitle || "") !== fallbackTitle) return;
    chip.dataset.attTitle = pageTitle;
    chip.textContent = pageTitle;
    const outliner = tray.querySelector(".outliner");
    if (!outliner) return;
    const slug = outliner.dataset.slug;
    const blocks = clampIndent(readBlocks(outliner));
    const next = readAttachments(tray);
    const bookmarked = isBookmarked(tray);
    const prev = noteMap.get(slug) || { slug, kind: slug === chapterSlug ? "chapter" : "verse" };
    noteMap.set(slug, { ...prev, blocks, bookmarked, attachments: next });
    saveSlug(slug, blocks, { bookmarked, attachments: next, tray });
  }
  function newId() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return "b_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function newAttId() {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return "att_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function parseAttachmentInput(raw) {
    const text = String(raw || "").trim();
    if (!text) return null;
    const url = absoluteHttpUrl(text);
    if (url) return { id: newAttId(), kind: "url", url, title: urlTitle(url), source: "manual" };
    if (/\\d/.test(text)) {
      const resolved = resolveWikiTarget(text);
      if (resolved) return { id: newAttId(), kind: "xref", slug: resolved.slug, title: resolved.label, source: "manual" };
    }
    return null;
  }
  function normalizeAttachments(raw) {
    const rows = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const out = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      let normalized = null;
      if (row.kind === "xref" || row.slug) {
        const resolved = resolveWikiTarget(row.slug || row.title || "");
        if (!resolved) continue;
        normalized = {
          id: /^att_[A-Za-z0-9]{4,16}$/.test(row.id || "") ? row.id : newAttId(),
          kind: "xref",
          slug: resolved.slug,
          title: String(row.title || resolved.label),
          source: row.source === "manual" || row.source === "scan" || row.source === "backlink" ? row.source : undefined,
        };
      } else if (row.kind === "url" || row.url) {
        const url = absoluteHttpUrl(row.url || row.href || "");
        if (!url) continue;
        normalized = {
          id: /^att_[A-Za-z0-9]{4,16}$/.test(row.id || "") ? row.id : newAttId(),
          kind: "url",
          url,
          title: String(row.title || urlTitle(url)),
          source: "manual",
        };
      }
      if (!normalized) continue;
      const key = normalized.kind === "xref" ? "xref:" + normalized.slug : "url:" + normalized.url;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(normalized);
    }
    return out;
  }
  function hrefForXref(slug) {
    const m = /^([a-z0-9]+)\\.(\\d+)(?:\\.(\\d+)(?:-(\\d+))?)?$/i.exec(String(slug || ""));
    if (!m) return "/" + String(slug || "").replace(/^\\//, "");
    const base = "/" + m[1].toLowerCase() + "." + m[2];
    if (!m[3]) return base;
    if (m[4]) return base + "." + m[3] + "-" + m[4] + "?xref=1";
    return base + "." + m[3] + "?xref=1";
  }
  function attachmentHref(row) {
    return row?.kind === "xref" ? hrefForXref(row.slug) : (row?.url || "");
  }
  const WIKI_RE = /\\[\\[([^\\]|]+)(?:\\|([^\\]]+))?\\]\\]/g;
  const XREF_RE = /[1-3]?[A-Za-z]{2,}\\.\\d+(?:\\.\\d+)?(?:-[1-3]?[A-Za-z]{2,}\\.\\d+\\.\\d+|-\\d+)?|(?:[1-3]\\s*)?[A-Za-z]+(?:\\s+of\\s+[A-Za-z]+)?\\s+\\d+(?:(?::|\\s)\\d+(?:\\s*[–—-]\\s*\\d+)?)?/g;
  function wikiTokens(text) {
    const source = String(text || "");
    const tokens = [];
    let last = 0;
    WIKI_RE.lastIndex = 0;
    let match;
    while ((match = WIKI_RE.exec(source))) {
      if (match.index > last) tokens.push(...splitXref(source.slice(last, match.index)));
      const target = match[1];
      const custom = match[2];
      const resolved = resolveWikiTarget(target);
      tokens.push({
        type: "wiki",
        raw: match[0],
        target,
        label: custom || (resolved ? resolved.label : target),
        slug: resolved?.slug || null,
        href: resolved ? resolved.href : null,
      });
      last = match.index + match[0].length;
    }
    if (last < source.length) tokens.push(...splitXref(source.slice(last)));
    return tokens.length ? tokens : [{ type: "text", value: source }];
  }
  function codeRanges(source) {
    const ranges = [];
    const pattern = /\`[^\`]*\`/g;
    let match;
    while ((match = pattern.exec(source))) ranges.push([match.index, match.index + match[0].length]);
    return ranges;
  }
  function splitXref(source) {
    const protectedRanges = codeRanges(source);
    const tokens = [];
    let last = 0;
    XREF_RE.lastIndex = 0;
    let match;
    while ((match = XREF_RE.exec(source))) {
      const start = match.index;
      const end = start + match[0].length;
      if (protectedRanges.some(([from, to]) => start >= from && end <= to)) continue;
      const resolved = resolveWikiTarget(match[0]);
      if (resolved) {
        if (start > last) tokens.push({ type: "text", value: source.slice(last, start) });
        tokens.push({
          type: "wiki",
          raw: match[0],
          target: match[0],
          label: match[0],
          slug: resolved.slug,
          href: resolved.href,
        });
        last = end;
      }
    }
    if (last < source.length) tokens.push({ type: "text", value: source.slice(last) });
    return tokens.length ? tokens : [{ type: "text", value: source }];
  }
  function displayTokens(text) {
    return wikiTokens(text).flatMap((token) => {
      if (token.type !== "text") return [token];
      return inlineMdTokens(token.value);
    });
  }
  function isWordChar(ch) { return ch != null && /[A-Za-z0-9]/.test(ch); }
  function inlineMdTokens(text) {
    const source = String(text || "");
    const tokens = [];
    let i = 0;
    while (i < source.length) {
      if (source[i] === "\`") {
        const end = source.indexOf("\`", i + 1);
        if (end > i + 1 && source.slice(i + 1, end).indexOf("\\n") < 0) {
          tokens.push({ type: "code", value: source.slice(i + 1, end) });
          i = end + 1;
          continue;
        }
      }
      if (source[i] === "*" && source[i + 1] === "*") {
        const end = source.indexOf("**", i + 2);
        if (end > i + 2 && source.slice(i + 2, end).indexOf("\\n") < 0) {
          tokens.push({ type: "strong", value: source.slice(i + 2, end) });
          i = end + 2;
          continue;
        }
      }
      if (source[i] === "*" && source[i + 1] !== "*") {
        const end = source.indexOf("*", i + 1);
        if (end > i + 1 && source[end + 1] !== "*" && source.slice(i + 1, end).indexOf("\\n") < 0) {
          tokens.push({ type: "em", value: source.slice(i + 1, end) });
          i = end + 1;
          continue;
        }
      }
      if (source[i] === "_" && !isWordChar(source[i - 1])) {
        const end = source.indexOf("_", i + 1);
        if (end > i + 1 && !isWordChar(source[end + 1]) && source.slice(i + 1, end).indexOf("\\n") < 0) {
          tokens.push({ type: "em", value: source.slice(i + 1, end) });
          i = end + 1;
          continue;
        }
      }
      const start = i;
      i += 1;
      while (i < source.length && source[i] !== "*" && source[i] !== "\`" && source[i] !== "_") i += 1;
      tokens.push({ type: "text", value: source.slice(start, i) });
    }
    return tokens;
  }
  function fillEditable(el, text, { decorate = true } = {}) {
    el.replaceChildren();
    const lines = String(text || "").split("\\n");
    lines.forEach((line, i) => {
      if (decorate) {
        displayTokens(line).forEach((token) => {
          if (token.type === "wiki" && token.href) {
            const link = document.createElement("a");
            link.className = "wiki";
            link.href = token.href;
            link.dataset.wikiRaw = token.raw;
            link.contentEditable = "false";
            link.textContent = token.label;
            el.append(link);
          } else if (token.type === "strong" || token.type === "em" || token.type === "code") {
            const mark = document.createElement(token.type === "strong" ? "strong" : token.type === "em" ? "em" : "code");
            mark.textContent = token.value;
            el.append(mark);
          } else {
            el.append(document.createTextNode(token.type === "wiki" ? token.raw : token.value));
          }
        });
      } else {
        el.append(document.createTextNode(line));
      }
      if (i < lines.length - 1) el.append(document.createElement("br"));
    });
  }
  function editableNodes(element) {
    const nodes = [];
    const visit = (node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) nodes.push(child);
        else if (child.nodeName === "BR") nodes.push(child);
        else if (child.nodeType === Node.ELEMENT_NODE && child.matches?.("a.wiki")) {
          /* wiki chip is atomic — skip internals */
        } else if (child.nodeType === Node.ELEMENT_NODE) visit(child);
      });
    };
    if (element) visit(element);
    return nodes;
  }
  function readEditableText(el) {
    const chunks = [];
    const visit = (node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) chunks.push(child.nodeValue);
        else if (child.nodeName === "BR") chunks.push("\\n");
        else if (child.nodeType === Node.ELEMENT_NODE && child.matches?.("a.wiki")) {
          chunks.push(child.dataset.wikiRaw || child.textContent);
        } else if (child.nodeName === "STRONG") {
          chunks.push("**" + (child.textContent || "") + "**");
        } else if (child.nodeName === "EM") {
          chunks.push("*" + (child.textContent || "") + "*");
        } else if (child.nodeName === "CODE") {
          chunks.push("\`" + (child.textContent || "") + "\`");
        } else if (child.nodeType === Node.ELEMENT_NODE) visit(child);
      });
    };
    if (el) visit(el);
    return chunks.join("");
  }
  function parsedXrefsFromBlocks(blocks) {
    const found = [];
    const seen = new Set();
    for (const block of blocks || []) {
      for (const token of wikiTokens(block?.text || "")) {
        if (token.type !== "wiki" || !token.slug || seen.has(token.slug)) continue;
        seen.add(token.slug);
        found.push({ id: newAttId(), kind: "xref", slug: token.slug, title: slugLabel(token.slug), source: "scan" });
      }
    }
    return found;
  }
  function mergeParsedXrefs(list, blocks, suppressScanSlugs) {
    const current = normalizeAttachments(list);
    const suppress = suppressScanSlugs instanceof Set ? suppressScanSlugs : new Set(suppressScanSlugs || []);
    const parsed = parsedXrefsFromBlocks(blocks);
    const parsedSlugs = new Set(parsed.map((r) => r.slug));
    const kept = current.filter((row) => row.kind !== "xref" || row.source !== "scan" || parsedSlugs.has(row.slug)).map((row) => {
      if (row.kind !== "xref" || !parsedSlugs.has(row.slug)) return row;
      const title = parsed.find((i) => i.slug === row.slug)?.title || row.title;
      const source = row.source === "manual" || row.source === "backlink" ? row.source : "scan";
      return { ...row, title, source };
    });
    const present = new Set(kept.filter((r) => r.kind === "xref").map((r) => r.slug));
    const added = [];
    let next = kept;
    for (const xref of parsed) {
      if (present.has(xref.slug)) continue;
      if (suppress.has(xref.slug)) continue;
      if (next.some((r) => r.kind === "xref" && r.slug === xref.slug)) continue;
      const row = { ...xref, id: newAttId(), source: "scan" };
      next = [...next, row];
      added.push(row);
      present.add(xref.slug);
    }
    return { list: next, added, changed: JSON.stringify(current) !== JSON.stringify(next) };
  }
  function readAttachments(tray) {
    return normalizeAttachments([...tray?.querySelectorAll?.(".att-chip") || []].map((chip) => ({
      id: chip.dataset.attId,
      kind: chip.dataset.attKind,
      slug: chip.dataset.attSlug,
      url: chip.dataset.attUrl,
      title: chip.dataset.attTitle || chip.textContent,
      source: chip.dataset.attSource === "scan" || chip.dataset.attSource === "backlink" ? chip.dataset.attSource : "manual",
    })));
  }
  function isBookmarked(tray) {
    return Boolean(tray?.querySelector?.(".tray-bookmark.is-on"));
  }
  function attachmentItem(row, { fresh = false } = {}) {
    const item = document.createElement("li");
    item.className = "att-item";
    const chip = document.createElement("a");
    chip.className = row.kind === "xref" ? "att-chip wiki" : "att-chip att-url";
    if (fresh) chip.classList.add("is-fresh");
    chip.href = attachmentHref(row);
    chip.dataset.attId = row.id;
    chip.dataset.attKind = row.kind;
    chip.dataset.attTitle = row.title;
    chip.dataset.attSource = row.source === "scan" || row.source === "backlink" ? row.source : "manual";
    if (row.kind === "xref") chip.dataset.attSlug = row.slug;
    else {
      chip.dataset.attUrl = row.url;
      chip.target = "_blank";
      chip.rel = "noreferrer";
    }
    chip.textContent = row.title;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "att-remove";
    remove.dataset.attId = row.id;
    remove.setAttribute("aria-label", "Remove attachment");
    remove.title = "Remove attachment";
    remove.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31 61.66 205.66a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66A8 8 0 0 1 61.66 50.34L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>';
    item.append(chip, remove);
    return item;
  }
  function paintAttBoard(tray, list, { freshIds = [] } = {}) {
    const board = tray?.querySelector(".att-board");
    if (!board) return;
    const rows = normalizeAttachments(list);
    const fresh = new Set(freshIds);
    board.replaceChildren();
    rows.forEach((row) => board.append(attachmentItem(row, { fresh: fresh.has(row.id) })));
    board.hidden = rows.length === 0;
  }
  function syncStateIcon(button, on) {
    if (!button) return;
    button.dataset.stateOn = on ? "true" : "false";
  }
  function syncChapterNoteChrome() {
    const rail = document.querySelector("#chapter-note-rail");
    const peek = document.querySelector("#chapter-note-peek");
    const tray = document.querySelector("#chapter-tray");
    const open = Boolean(tray && !tray.hidden);
    const hasNote = noteMap.has(chapterSlug);
    if (rail) {
      rail.classList.toggle("is-open", open);
      rail.dataset.hasNote = hasNote ? "true" : "false";
    }
    if (peek) {
      peek.setAttribute("aria-expanded", open ? "true" : "false");
      peek.setAttribute("aria-label", open ? "Close chapter note" : "Open chapter note");
      peek.title = open ? "Close chapter note" : "Chapter note";
    }
  }
  function setChapterNoteOpen(open, { push = true, focus = false } = {}) {
    const tray = document.querySelector("#chapter-tray");
    if (!tray) return;
    tray.hidden = !open;
    syncChapterNoteChrome();
    if (open) {
      if (focus) tray.querySelector(".otext")?.focus();
      if (push) history.replaceState({}, "", "/" + chapterSlug + "?chapter_note=1");
    } else if (push) {
      history.replaceState({}, "", "/" + chapterSlug);
    }
  }
  function syncChapterBookmarkBtn(on) {
    const button = document.querySelector("#chapter-bookmark-btn");
    if (!button) return;
    button.classList.toggle("is-on", Boolean(on));
    button.setAttribute("aria-pressed", on ? "true" : "false");
    syncStateIcon(button, Boolean(on));
  }
  function syncBookmarkButton(tray, on) {
    const button = tray?.querySelector?.(".tray-bookmark");
    if (button) {
      button.classList.toggle("is-on", Boolean(on));
      button.setAttribute("aria-pressed", on ? "true" : "false");
      syncStateIcon(button, Boolean(on));
    }
    // Header chapter bookmark mirrors the chapter-tray bookmark (Rails split).
    if (tray && (tray.id === "chapter-tray" || tray.classList?.contains("chapter-tray"))) {
      syncChapterBookmarkBtn(on);
    }
  }
  function flashAttachButton(tray) {
    const button = tray?.querySelector(".tray-attach");
    if (!button) return;
    button.classList.add("is-ok");
    clearTimeout(button._okTimer);
    button._okTimer = setTimeout(() => button.classList.remove("is-ok"), 900);
  }
  function trayHost(el) {
    return el?.closest?.(".note-tray, .chapter-tray");
  }
  const TRAY_MS = 100;
  function prefersReduceMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function ensureTrayClip(tray) {
    let clip = tray.querySelector(":scope > .note-tray-clip");
    if (clip) return clip;
    clip = document.createElement("div");
    clip.className = "note-tray-clip";
    while (tray.firstChild) clip.appendChild(tray.firstChild);
    tray.appendChild(clip);
    return clip;
  }
  function clearTrayAnim(tray) {
    if (!tray) return;
    if (tray._trayAnim) { clearTimeout(tray._trayAnim); tray._trayAnim = 0; }
    if (tray._trayAnimEnd) {
      tray.removeEventListener("transitionend", tray._trayAnimEnd);
      tray._trayAnimEnd = null;
    }
    tray.classList.remove("is-tray-anim", "is-tray-closing");
    tray.style.gridTemplateRows = "";
    tray.style.opacity = "";
    tray.style.transition = "";
  }
  function finishTrayAnim(tray, { hide = false } = {}) {
    tray._trayAnim = 0;
    tray._trayAnimEnd = null;
    if (hide) tray.hidden = true;
    tray.classList.remove("is-tray-anim", "is-tray-closing");
    tray.style.gridTemplateRows = "";
    tray.style.opacity = "";
    tray.style.transition = "";
  }
  /** Quick grid-rows/opacity expand for verse note trays (~100ms). Instant when reduced-motion. */
  function setNoteTray(tray, open, { animate = true } = {}) {
    if (!tray) return;
    if (!tray.classList.contains("note-tray")) {
      tray.hidden = !open;
      return;
    }
    const wantOpen = Boolean(open);
    const closing = tray.classList.contains("is-tray-closing");
    if (wantOpen) {
      if (!tray.hidden && !closing) return;
    } else if (tray.hidden || closing) {
      return;
    }
    clearTrayAnim(tray);
    if (!animate || prefersReduceMotion()) {
      tray.hidden = !wantOpen;
      return;
    }
    ensureTrayClip(tray);
    const trans = "grid-template-rows " + TRAY_MS + "ms ease, opacity " + TRAY_MS + "ms ease";
    const onEnd = (ev) => {
      if (ev.target !== tray) return;
      if (ev.propertyName !== "grid-template-rows") return;
      tray.removeEventListener("transitionend", onEnd);
      if (tray._trayAnim) { clearTimeout(tray._trayAnim); tray._trayAnim = 0; }
      finishTrayAnim(tray, { hide: !wantOpen });
    };
    tray._trayAnimEnd = onEnd;
    tray.addEventListener("transitionend", onEnd);
    tray._trayAnim = setTimeout(() => {
      if (!tray.classList.contains("is-tray-anim")) return;
      tray.removeEventListener("transitionend", onEnd);
      finishTrayAnim(tray, { hide: !wantOpen });
    }, TRAY_MS + 80);
    if (wantOpen) {
      tray.classList.add("is-tray-anim");
      tray.style.gridTemplateRows = "0fr";
      tray.style.opacity = "0";
      tray.style.transition = "none";
      tray.hidden = false;
      void tray.offsetWidth;
      requestAnimationFrame(() => {
        if (!tray.classList.contains("is-tray-anim")) return;
        tray.style.transition = trans;
        tray.style.gridTemplateRows = "1fr";
        tray.style.opacity = "1";
      });
    } else {
      tray.classList.add("is-tray-anim", "is-tray-closing");
      tray.style.gridTemplateRows = "1fr";
      tray.style.opacity = "1";
      tray.style.transition = "none";
      void tray.offsetWidth;
      requestAnimationFrame(() => {
        if (!tray.classList.contains("is-tray-closing")) return;
        tray.style.transition = trans;
        tray.style.gridTemplateRows = "0fr";
        tray.style.opacity = "0";
      });
    }
  }
  function applyXref(span) {
    if (!span?.start) return;
    xrefSpan = { start: span.start, end: span.end || span.start };
    selectedVerse = null;
    openVerses.clear();
    // Arrival scrolls to the verse. It does not paint a selection: the old
    // is-xref border and text wash stayed up until the next tap.
    document.querySelectorAll(".verse.is-xref").forEach((row) => row.classList.remove("is-xref"));
    document.querySelectorAll(".note-tray").forEach((tray) => { setNoteTray(tray, false); });
    syncOpenChrome();
    const slug = chapterSlug + "." + xrefSpan.start + (xrefSpan.end !== xrefSpan.start ? "-" + xrefSpan.end : "");
    history.replaceState({}, "", "/" + slug + "?xref=1");
    snappyScrollIntoView(document.querySelector('.verse[data-verse="' + xrefSpan.start + '"]'), { block: "center" });
  }
  function clearXref({ replaceUrl = true } = {}) {
    if (!xrefSpan) return;
    xrefSpan = null;
    document.querySelectorAll(".verse.is-xref").forEach((row) => row.classList.remove("is-xref"));
    if (replaceUrl) history.replaceState({}, "", "/" + chapterSlug);
  }
  function parseXrefHref(href) {
    try {
      const url = new URL(href, location.origin);
      const slug = url.pathname.replace(/^\\//, "").toLowerCase();
      const m = /^([a-z0-9]+)\\.(\\d+)(?:\\.(\\d+)(?:-(\\d+))?)?$/.exec(slug);
      if (!m) return null;
      return {
        book: m[1],
        chapter: Number(m[2]),
        verseStart: m[3] ? Number(m[3]) : null,
        verseEnd: m[4] ? Number(m[4]) : (m[3] ? Number(m[3]) : null),
        kind: m[3] ? (m[4] ? "range" : "verse") : "chapter",
        slug,
      };
    } catch { return null; }
  }

  function clampIndent(blocks) {
    for (let i = 0; i < blocks.length; i++) {
      blocks[i].indent = Math.max(0, Math.min(32, blocks[i].indent | 0));
      if (i === 0) blocks[i].indent = 0;
      else blocks[i].indent = Math.min(blocks[i].indent, blocks[i - 1].indent + 1);
    }
    return blocks;
  }
  function subtreeEnd(blocks, index) {
    const base = blocks[index].indent;
    let c = index + 1;
    while (c < blocks.length && blocks[c].indent > base) c++;
    return c;
  }
  function indentSubtree(blocks, index, delta) {
    if (delta > 0) {
      if (index === 0) return false;
      if (blocks[index].indent >= blocks[index - 1].indent + 1) return false;
    } else if (delta < 0) {
      if (blocks[index].indent <= 0) return false;
    } else return false;
    const end = subtreeEnd(blocks, index);
    for (let c = index; c < end; c++) blocks[c].indent += delta;
    clampIndent(blocks);
    return true;
  }
  // Rails outliner-blocks: two spaces (space-space) == indent.
  function shouldIndentOnSpace(text, offset) {
    const value = String(text || "");
    const at = Number(offset);
    if (!Number.isFinite(at) || at < 0) return false;
    if (at === 1 && value.startsWith(" ")) return true;
    if (at === 0 && value.startsWith(" ")) return true;
    return false;
  }
  function shouldBulletOnSpace(text, offset) {
    const value = String(text || "");
    return offset === value.length && /^[-–—*+]$/.test(value);
  }
  function consumeLeadingSpace(blocks, index) {
    if (!Array.isArray(blocks) || index < 0 || index >= blocks.length) return false;
    const block = blocks[index];
    const before = String(block.text || "");
    if (!before.startsWith(" ")) return false;
    block.text = before.replace(/^ +/, "");
    indentSubtree(blocks, index, 1);
    return true;
  }
  // Rails outliner-blocks: ArrowUp/ArrowDown move caret across nodes.
  function arrowDirection(key) {
    if (key === "ArrowUp") return -1;
    if (key === "ArrowDown") return 1;
    return 0;
  }
  function caretForNeighbor(direction, neighborTextLength) {
    return direction < 0 ? neighborTextLength : 0;
  }
  // Enter's beforeinput follows keydown. Suppress only that echo so key repeat still splits.
  let suppressEnterUntil = 0;
  function enterInputSuppressed(suppressUntil, now) {
    return Number.isFinite(suppressUntil) && Number.isFinite(now) && now < suppressUntil;
  }
  function armEnterInputSuppression() {
    suppressEnterUntil = Date.now() + 50;
  }
  // Repaint must keep the caret's row. Falling back to row 1 is what pinned mobile Enter.
  function repaintFocus(input) {
    if (!input.wasFocused) return null;
    const blocks = Array.isArray(input.blocks) ? input.blocks : [];
    if (!blocks.length) return null;
    const wanted = String(input.activeId || "");
    let block = wanted ? blocks.find((row) => row.id === wanted) : undefined;
    if (!block) {
      const index = input.activeIndex;
      if (Number.isInteger(index) && index >= 0 && index < blocks.length) block = blocks[index];
    }
    if (!block) return null;
    const text = String(block.text || "");
    const caret = Number(input.caret);
    const at = Number.isFinite(caret) ? Math.max(0, Math.min(Math.trunc(caret), text.length)) : text.length;
    return { id: block.id, caret: at };
  }
  // WebKit puts the caret back on the first recreated row after Enter. Hold the new row briefly.
  let focusHold = null;
  function arrowBlockNav(input) {
    if (input.shiftKey || input.altKey || input.metaKey || input.ctrlKey) return null;
    const direction = arrowDirection(input.key);
    if (!direction) return null;
    const leave = input.singleVisualLine
      || (direction < 0 && input.atFirstVisualLine)
      || (direction > 0 && input.atLastVisualLine);
    if (!leave) return { action: "within" };
    const next = input.index + direction;
    if (next < 0 || next >= input.length) return { action: "edge" };
    return { action: "leave", index: next, direction };
  }
  function lineHeightOf(el) {
    const style = window.getComputedStyle(el);
    const lh = Number.parseFloat(style.lineHeight);
    if (Number.isFinite(lh) && lh > 0) return lh;
    const fs = Number.parseFloat(style.fontSize) || 16;
    return fs * 1.45;
  }
  function caretLineRect() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0).cloneRange();
    if (range.collapsed) {
      const probe = document.createElement("span");
      probe.textContent = "\\u200b";
      range.insertNode(probe);
      const rect = probe.getBoundingClientRect();
      probe.remove();
      return rect.width || rect.height ? rect : null;
    }
    const rects = range.getClientRects();
    return rects.length ? rects[0] : range.getBoundingClientRect();
  }
  function rectFromRange(range) {
    if (!range) return null;
    const rects = range.getClientRects();
    if (rects.length) return rects[0];
    const rect = range.getBoundingClientRect();
    return rect.width || rect.height ? rect : null;
  }
  function lineSlop(el, rect) {
    return Math.max(rect?.height || 0, lineHeightOf(el), 8) * 0.6;
  }
  function singleVisualLine(el) {
    return el.getBoundingClientRect().height <= lineHeightOf(el) * 1.65;
  }
  function atBlockStart(el) {
    return caretOffset(el) === 0;
  }
  function atBlockEnd(el) {
    return caretOffset(el) >= readEditableText(el).length;
  }
  function atFirstVisualLine(el) {
    if (atBlockStart(el)) return true;
    const text = readEditableText(el);
    if (!text.includes("\\n") && singleVisualLine(el)) return true;
    const rect = caretLineRect();
    if (!rect) return false;
    const first = rectFromRange(rangeAtOffset(el, 0));
    if (!first) return false;
    return Math.abs(rect.top - first.top) <= lineSlop(el, rect);
  }
  function atLastVisualLine(el) {
    if (atBlockEnd(el)) return true;
    const text = readEditableText(el);
    if (!text.includes("\\n") && singleVisualLine(el)) return true;
    const rect = caretLineRect();
    if (!rect) return false;
    const last = rectFromRange(rangeAtOffset(el, text.length));
    if (!last) return false;
    return Math.abs(rect.top - last.top) <= lineSlop(el, rect);
  }
  function visualBottom() {
    const vv = window.visualViewport;
    if (vv) return vv.offsetTop + vv.height;
    return window.innerHeight || document.documentElement.clientHeight || 0;
  }
  function chromeTopPad() {
    const bar = document.querySelector(".topbar");
    const banner = document.querySelector(".banner");
    const top = (bar?.getBoundingClientRect().bottom || 0);
    return Math.max(top, banner?.getBoundingClientRect().bottom || 0) + 8;
  }
  function keepEditingVisible(textEl) {
    if (!textEl) return;
    const tray = textEl.closest(".note-tray, .chapter-tray");
    const head = tray?.querySelector(".tray-head");
    const bottom = visualBottom();
    const topPad = chromeTopPad();
    const rect = textEl.getBoundingClientRect();
    const headRect = head?.getBoundingClientRect();
    let delta = 0;
    // Tray chrome is a footer under the outliner — keep status/actions above keyboard + safe-area.
    const floor = bottom - scrollBottomInset();
    if (headRect && headRect.bottom > floor) delta = headRect.bottom - floor;
    else if (rect.bottom > floor) delta = rect.bottom - floor;
    if (rect.top - delta < topPad) delta = rect.top - topPad;
    if (Math.abs(delta) < 2) return;
    const from = window.scrollY || window.pageYOffset || 0;
    smoothScrollTo(from + delta);
  }
  function isEmpty(blocks) {
    return blocks.every((b) => !String(b.text || "").trim());
  }
  function readBlocks(outliner) {
    return [...outliner.querySelectorAll(".oblock")].map((row) => ({
      id: row.dataset.blockId || newId(),
      indent: Number.parseInt(row.style.getPropertyValue("--depth") || "0", 10) || 0,
      text: readEditableText(row.querySelector(".otext")),
      bullet: row.dataset.bullet !== "0",
    }));
  }
  function renderOutliner(outliner, blocks, focusId, caret) {
    const frag = document.createDocumentFragment();
    for (const block of blocks) {
      const row = document.createElement("div");
      const bulletOn = block.bullet !== false;
      row.className = bulletOn ? "oblock is-bullet" : "oblock";
      row.dataset.blockId = block.id;
      row.dataset.bullet = bulletOn ? "1" : "0";
      row.style.setProperty("--depth", String(block.indent || 0));
      const bullet = document.createElement("span");
      bullet.className = "obullet";
      bullet.setAttribute("aria-hidden", "true");
      const text = document.createElement("div");
      text.className = "otext";
      text.contentEditable = "true";
      text.setAttribute("role", "textbox");
      text.setAttribute("aria-multiline", "true");
      text.spellcheck = true;
      const focused = focusId && block.id === focusId;
      if (focused) text.dataset.editing = "1";
      fillEditable(text, block.text || "", { decorate: !focused });
      row.append(bullet, text);
      frag.append(row);
    }
    outliner.replaceChildren(frag);
    if (!focusId) return;
    const el = outliner.querySelector('[data-block-id="' + CSS.escape(focusId) + '"] .otext');
    if (!el) return;
    const at = caret == null ? readEditableText(el).length : caret;
    focusBlockSoon(el, at);
  }
  function focusBlockSoon(el, offset) {
    focusHold = { el, offset, until: Date.now() + 100 };
    const apply = () => {
      if (!el.isConnected) return;
      // A newer Enter or arrow move replaced this hold. Don't pull the caret back.
      if (!focusHold || focusHold.el !== el) return;
      // A finger pan owns the page. Putting the caret back would pin the verse mid-screen.
      if (userScrolling) return;
      const outliner = el.closest(".outliner");
      const active = document.activeElement;
      const inside = !!(active && outliner && outliner.contains(active));
      // A click that left this note stays where it landed. Desktop click-away is unchanged.
      if (active && active !== document.body && active !== document.documentElement && !inside) return;
      if (active !== el) el.focus({ preventScroll: true });
      const sel = window.getSelection();
      const inBlock = !!(sel && sel.anchorNode && el.contains(sel.anchorNode));
      if (inBlock && caretOffset(el) === offset) return;
      placeCaret(el, offset);
    };
    apply();
    requestAnimationFrame(apply);
    // iOS restores the pre-split selection after the key event, then again after layout.
    setTimeout(apply, 0);
    setTimeout(apply, 48);
  }
  function rangeAtOffset(el, offset) {
    const range = document.createRange();
    let remaining = Math.max(0, offset);
    for (const node of editableNodes(el)) {
      const length = node.nodeName === "BR" ? 1 : (node.nodeValue?.length || 0);
      if (remaining <= length) {
        if (node.nodeName === "BR") {
          if (remaining === 0) range.setStartBefore(node);
          else range.setStartAfter(node);
        } else {
          range.setStart(node, remaining);
        }
        range.collapse(true);
        return range;
      }
      remaining -= length;
    }
    range.selectNodeContents(el);
    range.collapse(false);
    return range;
  }
  function placeCaret(el, offset) {
    const sel = window.getSelection();
    if (!sel) return;
    const range = rangeAtOffset(el, offset);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function caretOffset(el) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return readEditableText(el).length;
    const range = sel.getRangeAt(0).cloneRange();
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length + pre.cloneContents().querySelectorAll("br").length;
  }
  function splitAtCaret(outliner, blocks, index, caret) {
    const current = blocks[index];
    const left = current.text.slice(0, caret);
    const right = current.text.slice(caret);
    current.text = left;
    // Rails splitSibling parity: left keeps its bullet; new sibling is always bulleted.
    current.bullet = current.bullet !== false;
    const created = { id: newId(), indent: current.indent, text: right, bullet: true };
    blocks.splice(subtreeEnd(blocks, index), 0, created);
    renderOutliner(outliner, blocks, created.id, 0);
    scheduleSave(outliner);
  }
  function insertNewlineAt(outliner, blocks, index, caret) {
    const current = blocks[index];
    current.text = current.text.slice(0, caret) + "\\n" + current.text.slice(caret);
    renderOutliner(outliner, blocks, current.id, caret + 1);
    scheduleSave(outliner);
  }
  function setStatus(slug, text) {
    document.querySelectorAll('[data-status-for="' + CSS.escape(slug) + '"]').forEach((el) => {
      el.textContent = text;
    });
  }
  function trayPayload(outliner) {
    const tray = trayHost(outliner);
    const blocks = clampIndent(readBlocks(outliner));
    const bookmarked = isBookmarked(tray);
    const slug = outliner.dataset.slug;
    const { list, added, changed } = mergeParsedXrefs(readAttachments(tray), blocks, dismissedXrefs.get(slug));
    return { slug, blocks, bookmarked, attachments: list, addedAttachments: added, attachmentsChanged: changed, tray };
  }
  async function saveSlug(slug, blocks, { keepalive = false, bookmarked, attachments, tray } = {}) {
    const host = tray || document.querySelector('.outliner[data-slug="' + CSS.escape(slug) + '"]')?.closest(".note-tray, .chapter-tray");
    const bm = bookmarked ?? isBookmarked(host);
    let atts = attachments;
    if (!atts) {
      const merged = mergeParsedXrefs(readAttachments(host), blocks, dismissedXrefs.get(slug));
      atts = merged.list;
      if (merged.changed) paintAttBoard(host, merged.list, { freshIds: merged.added.map((r) => r.id) });
    }
    const payload = { blocks, bookmarked: bm, attachments: atts };
    const key = JSON.stringify(payload);
    if (lastSaved.get(slug) === key) return;
    setStatus(slug, "Saving");
    const job = (async () => {
      try {
        const send = () => fetch("/api/notes/" + encodeURIComponent(slug), {
          method: "PUT",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(payload),
          keepalive,
        });
        let response = await send();
        if (response.status === 429 && !keepalive) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const waitSec = Math.min(90, Math.max(1, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60));
          setStatus(slug, "Slow down");
          await new Promise((resolve) => window.setTimeout(resolve, waitSec * 1000));
          response = await send();
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setStatus(slug, response.status === 429 ? "Slow down" : (data.error || "Not saved"));
          return;
        }
        lastSaved.set(slug, key);
        setStatus(slug, data.deleted ? "Cleared" : "Saved");
        if (data.deleted) {
          noteMap.delete(slug);
          touchInboxCache(slug, { deleted: true });
          if (slug === chapterSlug) {
            syncChapterBookmarkBtn(false);
            syncChapterNoteChrome();
          }
        } else {
          const savedAtts = Array.isArray(data.attachments) ? data.attachments : atts;
          noteMap.set(slug, {
            slug,
            blocks,
            bookmarked: Boolean(data.bookmarked ?? bm),
            attachments: savedAtts,
            kind: slug === chapterSlug ? "chapter" : "verse",
            updatedAt: noteMap.get(slug)?.updatedAt || "",
            createdAt: noteMap.get(slug)?.createdAt || "",
          });
          if (host && Array.isArray(data.attachments)) paintAttBoard(host, data.attachments);
          syncBookmarkButton(host, Boolean(data.bookmarked ?? bm));
          if (slug === chapterSlug) syncChapterNoteChrome();
          const savedNote = data.note || null;
          if (savedNote?.updatedAt || savedNote?.createdAt) {
            noteMap.set(slug, {
              ...noteMap.get(slug),
              updatedAt: savedNote.updatedAt || "",
              createdAt: savedNote.createdAt || "",
            });
          }
          touchInboxCache(slug, {
            blocks,
            bookmarked: Boolean(data.bookmarked ?? bm),
            updatedAt: savedNote?.updatedAt || "",
            createdAt: savedNote?.createdAt || "",
          });
        }
        // Paint same-chapter mirrors from this save, and drop other chapters' caches
        // so the next visit refetches the backlink instead of showing the old list.
        if (Array.isArray(data.chapterNotes)) reconcileChapterNotes(data.chapterNotes);
        dropLinkedChapterCaches(data.linkedSlugs);
        if (!Array.isArray(data.chapterNotes)) bumpChapterNotesGen(chapterSlug);
        notesPrefetch.delete(chapterSlug);
        writeChapterNotesCache(chapterSlug, [...noteMap.values()]);
        // A save makes the prefetched inbox document stale. Drop it, then fetch the new SSR.
        inboxPrefetch = null;
        dropInboxHtml();
        prefetchInbox().catch(() => {});
        syncVerseMarks();
        syncExpandBtn();
        refreshExpand();
      } catch (err) {
        setStatus(slug, "Not saved");
      }
    })();
    pendingSaves.set(slug, job);
    try { await job; }
    finally { if (pendingSaves.get(slug) === job) pendingSaves.delete(slug); }
  }
  function scheduleSave(outliner) {
    const payload = trayPayload(outliner);
    window.clearTimeout(timers.get(payload.slug));
    timers.delete(payload.slug);
    if (payload.attachmentsChanged) {
      paintAttBoard(payload.tray, payload.attachments, { freshIds: payload.addedAttachments.map((r) => r.id) });
      if (payload.addedAttachments.length) flashAttachButton(payload.tray);
    }
    timers.set(payload.slug, window.setTimeout(() => {
      timers.delete(payload.slug);
      saveSlug(payload.slug, payload.blocks, {
        bookmarked: payload.bookmarked,
        attachments: payload.attachments,
        tray: payload.tray,
      });
    }, 400));
  }
  /** Flush debounced + in-flight note saves. Soft-nav must await this before document.write. */
  async function flushAll({ keepalive = true } = {}) {
    const jobs = [];
    document.querySelectorAll(".outliner").forEach((outliner) => {
      const payload = trayPayload(outliner);
      window.clearTimeout(timers.get(payload.slug));
      timers.delete(payload.slug);
      const key = JSON.stringify({ blocks: payload.blocks, bookmarked: payload.bookmarked, attachments: payload.attachments });
      if (lastSaved.get(payload.slug) === key) return;
      jobs.push(saveSlug(payload.slug, payload.blocks, {
        keepalive,
        bookmarked: payload.bookmarked,
        attachments: payload.attachments,
        tray: payload.tray,
      }));
    });
    for (const pending of pendingSaves.values()) jobs.push(pending);
    if (jobs.length) await Promise.allSettled(jobs);
  }
  function syncVerseMarks() {
    document.querySelectorAll(".verse").forEach((verse) => {
      const v = Number(verse.dataset.verse);
      const slug = verse.dataset.slug;
      const noteHas = (n) => Boolean(n) && (Boolean(n.bookmarked) || (n.attachments || []).length || !isEmpty(n.blocks || []));
      const has =
        noteHas(noteMap.get(slug)) ||
        [...noteMap.values()].some((n) => n.kind !== "chapter" && n.slug !== slug && covers(n, v) && noteHas(n));
      verse.classList.toggle("has-note", has);
    });
    syncSpanChrome();
    syncRangeRails();
  }
  function noteShowsMark(note) {
    return Boolean(note) && (Boolean(note.bookmarked) || (note.attachments || []).length || !isEmpty(note.blocks || []));
  }
  function isRangeSlug(slug) {
    const span = spanFromNoteSlug(slug);
    return Boolean(span && span.start !== span.end);
  }
  function trayAnchorVerse(note) {
    const span = spanFromNoteSlug(note?.slug);
    if (span && span.start !== span.end) return span.end;
    if (note?.kind === "range" && note.verseEnd != null) return note.verseEnd;
    return note?.verseStart;
  }
  /** Narrowest range whose left border is on this verse. The open passage range counts even when its note is empty. */
  function rangeSlugForVerse(verseNum) {
    const found = [];
    noteMap.forEach((note) => {
      const span = spanFromNoteSlug(note.slug);
      if (!span || span.start === span.end) return;
      if (verseNum < span.start || verseNum > span.end) return;
      const passageHit = (root.dataset.passageSlug || "") === note.slug;
      if (!noteShowsMark(note) && !passageHit) return;
      found.push({ slug: note.slug, width: span.end - span.start });
    });
    const passage = root.dataset.passageSlug || "";
    const passageSpan = spanFromNoteSlug(passage);
    if (passageSpan && passageSpan.start !== passageSpan.end && verseNum >= passageSpan.start && verseNum <= passageSpan.end) {
      if (!found.some((row) => row.slug === passage)) found.push({ slug: passage, width: passageSpan.end - passageSpan.start });
    }
    found.sort((a, b) => a.width - b.width);
    return found.length ? found[0].slug : "";
  }
  function syncRangeRails() {
    document.querySelectorAll(".verse").forEach((verse) => {
      const slug = rangeSlugForVerse(Number(verse.dataset.verse));
      let rail = verse.querySelector(":scope > .verse-range-rail");
      if (!slug) {
        if (rail) rail.remove();
        return;
      }
      if (!rail) {
        rail = document.createElement("button");
        rail.type = "button";
        rail.className = "verse-range-rail";
        verse.insertBefore(rail, verse.firstChild);
      }
      rail.dataset.rangeSlug = slug;
      rail.setAttribute("aria-label", "Note for " + slugLabel(slug));
    });
  }
  function mountRangeTray(tray, note) {
    if (!tray || !isRangeSlug(note?.slug)) return tray;
    const anchor = trayAnchorVerse(note);
    const verse = anchor == null ? null : document.querySelector('.verse[data-verse="' + anchor + '"]');
    if (!verse) return tray;
    tray.dataset.rangeComposer = "1";
    if (tray.parentElement !== verse) {
      const composer = verse.querySelector(".note-tray[data-verse-composer]");
      if (composer) composer.before(tray);
      else verse.append(tray);
    }
    return tray;
  }
  function covers(note, verse) {
    if (note.verseStart == null) return false;
    const last = note.verseEnd ?? note.verseStart;
    return verse >= note.verseStart && verse <= last;
  }
  /** Parse rom.5.3-5 → {start:3,end:5}; single verse → start===end. */
  function spanFromNoteSlug(slug) {
    const m = /^[a-z0-9]+\\.\\d+\\.(\\d+)(?:-(\\d+))?$/i.exec(String(slug || ""));
    if (!m) return null;
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : start;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return { start, end };
  }
  function trayIsShown(tray) {
    return Boolean(tray) && !tray.hidden && !tray.classList.contains("is-tray-closing");
  }
  function verseNoteShown(verse) {
    return [...verse.querySelectorAll(".note-tray")].some(trayIsShown);
  }
  /** Spotlight is the open note. A closed note drops is-open, and the range rail follows only a visible range tray. */
  function syncOpenChrome() {
    document.querySelectorAll(".verse").forEach((row) => {
      if (!verseNoteShown(row)) row.classList.remove("is-open");
    });
    syncSpanChrome();
  }
  /** Rails-like contiguous selection rail for a visible range note. The address alone does not keep the spotlight on. */
  function syncSpanChrome() {
    const covered = new Set();
    document.querySelectorAll(".note-tray:not([hidden])").forEach((tray) => {
      if (tray.classList.contains("is-tray-closing")) return;
      const span = spanFromNoteSlug(tray.dataset.slug);
      if (!span || span.start === span.end) return;
      for (let v = span.start; v <= span.end; v += 1) covered.add(v);
    });
    document.querySelectorAll(".verse").forEach((row) => {
      row.classList.toggle("is-span", covered.has(Number(row.dataset.verse)));
    });
  }
  function trayHasContent(tray) {
    if (isBookmarked(tray)) return true;
    if (tray.querySelector(".att-chip")) return true;
    const outliner = tray.querySelector(".outliner");
    if (!outliner) return false;
    return !isEmpty(readBlocks(outliner));
  }
  function syncExpandBtn() {
    const btn = document.querySelector("#expand-all-btn");
    if (!btn) return;
    const has = [...document.querySelectorAll(".note-tray")].some((tray) => trayHasContent(tray));
    btn.disabled = !has;
    if (!has) {
      expanding = false;
      collapsedNotes.clear();
      btn.classList.remove("is-on");
      btn.setAttribute("aria-pressed", "false");
    }
    const label = expanding ? "Collapse notes" : "Expand notes";
    const labelEl = btn.querySelector(".expand-label");
    if (labelEl) labelEl.textContent = label;
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
    btn.classList.toggle("is-on", expanding);
    btn.setAttribute("aria-pressed", expanding ? "true" : "false");
  }
  function refreshExpand() {
    document.querySelectorAll(".note-tray").forEach((tray) => {
      const parent = tray.closest(".verse");
      if (!parent) return;
      const n = Number(parent.dataset.verse);
      const selected = openVerses.has(n) && parent.classList.contains("is-open");
      const collapsed = collapsedNotes.has(n);
      const hasContent = trayHasContent(tray);
      // While expanded, show only authored trays. Manually opened verses keep
      // their trays even when collapsed/blank — openVerse owns that visibility.
      if (selected && !expanding) return;
      if (selected && expanding) {
        setNoteTray(tray, !collapsed);
        return;
      }
      setNoteTray(tray, !(collapsed || !hasContent || !expanding));
    });
    syncSpanChrome();
  }
  function openVerse(verseNum, { push = true, autofocus = true, preferRange = false, scroll = true } = {}) {
    // Multi-open: show this verse's tray; leave other open trays alone (Rails parity).
    selectedVerse = verseNum;
    openVerses.add(verseNum);
    collapsedNotes.delete(verseNum);
    const verse = document.querySelector('.verse[data-verse="' + verseNum + '"]');
    if (!verse) return;
    verse.classList.add("is-open");
    verse.querySelectorAll(".note-tray").forEach((tray) => {
      if (tray.dataset.rangeComposer === "1") {
        setNoteTray(tray, !!preferRange, { animate: false });
      } else if (tray.dataset.verseComposer === "1") {
        setNoteTray(tray, !preferRange, { animate: false });
      } else {
        setNoteTray(tray, true, { animate: false });
      }
    });
    // If preferRange but no range tray, fall back to verse composer.
    if (preferRange) {
      const rangeTray = verse.querySelector('.note-tray[data-range-composer]');
      if (!rangeTray) {
        const vc = verse.querySelector('.note-tray[data-verse-composer]');
        if (vc) setNoteTray(vc, true, { animate: false });
      }
    }
    syncSpanChrome();
    const slug = preferRange
      ? (verse.querySelector('.note-tray[data-range-composer]:not([hidden])')?.dataset.slug || verse.dataset.slug)
      : verse.dataset.slug;
    if (push) history.replaceState({}, "", "/" + slug);
    const outliner = verse.querySelector('.note-tray:not([hidden]) .outliner');
    const spotlight = document.documentElement.classList.contains("spotlight-on");
    if (scroll && spotlight && autofocus && outliner) placeInstant = true;
    if (autofocus && outliner) {
      const first = outliner.querySelector(".otext");
      first?.focus({ preventScroll: true });
    }
    if (scroll && spotlight) {
      // Already-placed verse URLs have nothing to move. A new selection glides to center.
      centerElement(verse.querySelector(".verse-press") || verse, false);
    } else if (scroll) {
      // After open anim, scroll tray fully into view (block nearest + safe-area under tray-head).
      // Mid-anim height is clipped, so waiting avoids hard-cutting the footer near the viewport bottom.
      const scrollTarget = verse.querySelector('.note-tray:not([hidden])') || verse;
      const runScroll = () => {
        snappyScrollIntoView(scrollTarget, { block: "nearest" });
        const focused = verse.querySelector('.note-tray:not([hidden]) .otext');
        if (focused && document.activeElement === focused) keepEditingVisible(focused);
      };
      if (prefersReduceMotion()) {
        requestAnimationFrame(runScroll);
      } else {
        setTimeout(() => requestAnimationFrame(runScroll), TRAY_MS + 16);
      }
    }
  }
  /** The left border of a range opens that range's one note under its last verse. */
  function openRangeNote(slug, { push = true, scroll = true } = {}) {
    const span = spanFromNoteSlug(slug);
    if (!span || span.start === span.end) return;
    const endVerse = document.querySelector('.verse[data-verse="' + span.end + '"]');
    if (!endVerse) return;
    const note = noteMap.get(slug) || {
      slug,
      kind: "range",
      verseStart: span.start,
      verseEnd: span.end,
      blocks: [],
      bookmarked: false,
      attachments: [],
      label: slugLabel(slug),
    };
    const tray = ensureNoteTray(note);
    if (!tray) return;
    const already = !tray.hidden && !tray.classList.contains("is-tray-closing");
    if (already) {
      setNoteTray(tray, false);
      openVerses.delete(span.end);
      if (selectedVerse === span.end) selectedVerse = openVerses.size ? [...openVerses].at(-1) : null;
      syncOpenChrome();
      if (verseNoteShown(endVerse)) {
        selectedVerse = span.end;
        openVerses.add(span.end);
      }
      if (push) history.replaceState({}, "", "/" + (selectedVerse ? (document.querySelector('.verse[data-verse="' + selectedVerse + '"]')?.dataset.slug || chapterSlug) : chapterSlug));
      return;
    }
    endVerse.querySelectorAll(".note-tray").forEach((other) => {
      if (other !== tray) setNoteTray(other, false, { animate: false });
    });
    setNoteTray(tray, true, { animate: false });
    selectedVerse = span.end;
    openVerses.add(span.end);
    collapsedNotes.delete(span.end);
    endVerse.classList.add("is-open");
    syncSpanChrome();
    if (push) history.replaceState({}, "", "/" + slug);
    const outliner = tray.querySelector(".outliner");
    const spotlight = document.documentElement.classList.contains("spotlight-on");
    if (scroll && spotlight && outliner) placeInstant = true;
    if (outliner) outliner.querySelector(".otext")?.focus({ preventScroll: true });
    if (scroll && spotlight) {
      centerElement(endVerse.querySelector(".verse-press") || endVerse, false);
    } else if (scroll) {
      const runScroll = () => snappyScrollIntoView(tray, { block: "nearest" });
      if (prefersReduceMotion()) requestAnimationFrame(runScroll);
      else setTimeout(() => requestAnimationFrame(runScroll), TRAY_MS + 16);
    }
  }
  function collapseVerseNotes(verseNum, { push = true } = {}) {
    closeOneVerse(verseNum, { push, collapse: true });
  }

  function closeOneVerse(verseNum, { push = true, collapse = false } = {}) {
    if (collapse) collapsedNotes.add(verseNum);
    openVerses.delete(verseNum);
    const verse = document.querySelector('.verse[data-verse="' + verseNum + '"]');
    verse?.classList.remove("is-open");
    verse?.querySelectorAll(".note-tray").forEach((tray) => { setNoteTray(tray, false); });
    syncOpenChrome();
    if (selectedVerse === verseNum) {
      selectedVerse = openVerses.size ? [...openVerses].at(-1) : null;
      if (push) {
        if (selectedVerse) {
          const keep = document.querySelector('.verse[data-verse="' + selectedVerse + '"]');
          history.replaceState({}, "", "/" + (keep?.dataset.slug || chapterSlug));
        } else {
          history.replaceState({}, "", "/" + chapterSlug);
        }
      }
    }
    refreshExpand();
  }

  // Seed lastSaved so we don't re-PUT identical SSR blocks on first keystroke churn.
  document.querySelectorAll(".outliner").forEach((outliner) => {
    const payload = trayPayload(outliner);
    lastSaved.set(payload.slug, JSON.stringify({ blocks: payload.blocks, bookmarked: payload.bookmarked, attachments: payload.attachments }));
  });

  function closeVerse({ push = true } = {}) {
    // Close every manually opened verse tray (expand-all collapse / hard reset).
    selectedVerse = null;
    openVerses.clear();
    document.querySelectorAll(".verse").forEach((v) => {
      v.classList.remove("is-open");
      v.classList.remove("is-span");
    });
    document.querySelectorAll(".note-tray").forEach((tray) => { setNoteTray(tray, false); });
    refreshExpand();
    syncSpanChrome();
    if (push) history.replaceState({}, "", "/" + chapterSlug);
  }

  function rangeRailForEvent(event) {
    const direct = event.target?.closest?.(".verse-range-rail");
    if (direct && root.contains(direct)) return direct;
    const verse = event.target?.closest?.(".verse");
    if (!verse || !root.contains(verse)) return null;
    if (event.target.closest(".verse-press, .note-tray, .outliner")) return null;
    const rail = verse.querySelector(":scope > .verse-range-rail");
    if (!rail) return null;
    const edge = verse.getBoundingClientRect().left;
    const reach = rail.getBoundingClientRect().right;
    if (event.clientX >= edge - 12 && event.clientX <= reach) return rail;
    return null;
  }
  root.addEventListener("click", (event) => {
    const rail = rangeRailForEvent(event);
    if (rail && root.contains(rail)) {
      event.preventDefault();
      dismissReaderHint();
      const slug = rail.dataset.rangeSlug;
      if (slug) openRangeNote(slug);
      return;
    }
    const press = event.target.closest(".verse-press");
    if (press && root.contains(press)) {
      event.preventDefault();
      dismissReaderHint();
      const verseNum = Number(press.dataset.verse);
      const verseEl = document.querySelector('.verse[data-verse="' + verseNum + '"]');
      const visibleTrays = verseEl ? [...verseEl.querySelectorAll(".note-tray")].filter((t) => !t.hidden && !t.classList.contains("is-tray-closing")) : [];
      const notesOpen = visibleTrays.length > 0;
      // Rails: while expanded, tap a verse with open note trays collapses them (don't fight tap-to-close).
      if (expanding && notesOpen) {
        collapseVerseNotes(verseNum);
        return;
      }
      collapsedNotes.delete(verseNum);
      const onlyRange = notesOpen && visibleTrays.every((t) => t.dataset.rangeComposer === "1");
      const alreadyOpen = verseEl?.classList.contains("is-open") && notesOpen;
      // The range border owns the range note. Tapping the verse text still opens that verse.
      if (alreadyOpen && !onlyRange) {
        closeOneVerse(verseNum);
        return;
      }
      openVerse(verseNum, { preferRange: false });
      return;
    }
    const bullet = event.target.closest(".obullet");
    if (bullet && root.contains(bullet)) {
      event.preventDefault();
      const row = bullet.closest(".oblock");
      const outliner = bullet.closest(".outliner");
      if (!row || !outliner) return;
      const blocks = clampIndent(readBlocks(outliner));
      const index = blocks.findIndex((b) => b.id === row.dataset.blockId);
      if (index < 0) return;
      blocks[index].bullet = !blocks[index].bullet;
      renderOutliner(outliner, blocks, blocks[index].id, caretOffset(row.querySelector(".otext")));
      scheduleSave(outliner);
      return;
    }
    const clear = event.target.closest("[data-clear]");
    if (clear && root.contains(clear)) {
      event.preventDefault();
      const slug = clear.getAttribute("data-clear");
      const outliner = document.querySelector('.outliner[data-slug="' + CSS.escape(slug) + '"]');
      if (!outliner) return;
      const empty = [{ id: newId(), indent: 0, text: "", bullet: true }];
      const tray = outliner.closest(".note-tray, .chapter-tray");
      renderOutliner(outliner, empty, empty[0].id, 0);
      syncBookmarkButton(tray, false);
      paintAttBoard(tray, []);
      window.clearTimeout(timers.get(slug));
      timers.delete(slug);
      saveSlug(slug, empty, { bookmarked: false, attachments: [], tray }).then(() => {
        if (tray && tray.classList.contains("note-tray")) {
          const parentVerse = Number(tray.closest(".verse")?.dataset.verse);
          // Hide emptied trays unless that verse is the active selection (Rails shouldHideClearedTray).
          if (!openVerses.has(parentVerse)) setNoteTray(tray, false);
        }
        syncVerseMarks();
        syncExpandBtn();
        refreshExpand();
        if (openVerses.has(parentVerse)) {
          openVerse(parentVerse, { push: false, autofocus: false, scroll: false });
        }
      });
      return;
    }

    const bookmarkBtn = event.target.closest("[data-bookmark]");
    if (bookmarkBtn && root.contains(bookmarkBtn)) {
      event.preventDefault();
      event.stopPropagation();
      const tray = trayHost(bookmarkBtn);
      const outliner = tray?.querySelector(".outliner");
      if (!outliner) return;
      const next = !bookmarkBtn.classList.contains("is-on");
      syncBookmarkButton(tray, next);
      const payload = trayPayload(outliner);
      payload.bookmarked = next;
      window.clearTimeout(timers.get(payload.slug));
      saveSlug(payload.slug, payload.blocks, {
        bookmarked: next,
        attachments: payload.attachments,
        tray,
      });
      syncVerseMarks();
      syncExpandBtn();
      refreshExpand();
      return;
    }
    const attachBtn = event.target.closest("[data-attach]");
    if (attachBtn && root.contains(attachBtn)) {
      event.preventDefault();
      event.stopPropagation();
      attTray = trayHost(attachBtn);
      const dialog = document.querySelector("#att-drop");
      const input = document.querySelector("#att-drop-input");
      const status = document.querySelector("#att-drop-status");
      if (status) { status.textContent = ""; status.classList.remove("is-error"); }
      if (input) input.value = "";
      document.querySelector("#att-drop-zone")?.classList.remove("is-over", "is-ok", "is-bad");
      document.querySelector("#att-drop-check")?.setAttribute("hidden", "");
      closeAttSuggest();
      dialog?.showModal();
      input?.focus();
      return;
    }
    const removeAtt = event.target.closest(".att-remove");
    if (removeAtt && root.contains(removeAtt)) {
      event.preventDefault();
      event.stopPropagation();
      const tray = trayHost(removeAtt);
      const outliner = tray?.querySelector(".outliner");
      if (!tray || !outliner) return;
      const removeId = removeAtt.dataset.attId;
      const chip = removeId ? tray.querySelector('.att-chip[data-att-id="' + CSS.escape(removeId) + '"]') : null;
      const removeKey = chip?.dataset.attKind === "xref"
        ? "xref:" + (chip.dataset.attSlug || "")
        : chip?.dataset.attKind === "url"
          ? "url:" + (chip.dataset.attUrl || "")
          : null;
      const next = readAttachments(tray).filter((row) => {
        if (removeId && row.id === removeId) return false;
        if (!removeKey) return true;
        const key = row.kind === "xref" ? "xref:" + row.slug : "url:" + row.url;
        return key !== removeKey;
      });
      paintAttBoard(tray, next);
      const blocks = clampIndent(readBlocks(outliner));
      const bookmarked = isBookmarked(tray);
      const slug = outliner.dataset.slug;
      if (chip?.dataset.attKind === "xref" && chip.dataset.attSlug) {
        let set = dismissedXrefs.get(slug);
        if (!set) { set = new Set(); dismissedXrefs.set(slug, set); }
        set.add(chip.dataset.attSlug);
      }
      window.clearTimeout(timers.get(slug));
      timers.delete(slug);
      // Skip trayPayload/mergeParsedXrefs so a chip the user just dismissed is not
      // immediately re-injected before save. Server may still re-scan from text.
      saveSlug(slug, blocks, {
        bookmarked,
        attachments: next,
        tray,
      });
      syncVerseMarks();
      syncExpandBtn();
      refreshExpand();
      return;
    }
    const wikiLink = event.target.closest("a.wiki, a.att-chip.wiki");
    if (wikiLink && root.contains(wikiLink)) {
      const parsed = parseXrefHref(wikiLink.getAttribute("href"));
      if (parsed && parsed.kind !== "chapter" && parsed.verseStart != null) {
        const sameChapter = parsed.book + "." + parsed.chapter === chapterSlug;
        if (sameChapter) {
          event.preventDefault();
          event.stopPropagation();
          applyXref({ start: parsed.verseStart, end: parsed.verseEnd || parsed.verseStart });
          return;
        }
      }
    }

    const closeBtn = event.target.closest("[data-close-tray]");
    if (closeBtn && root.contains(closeBtn)) {
      event.preventDefault();
      const chapterTray = closeBtn.closest("#chapter-tray");
      if (chapterTray) {
        setChapterNoteOpen(false, { push: true });
        return;
      }
      const parentVerse = closeBtn.closest(".verse");
      if (parentVerse) {
        const n = Number(parentVerse.dataset.verse);
        // Close only this verse tray (same-verse toggle / legacy data-close-tray). Leave others open.
        if (expanding) collapseVerseNotes(n);
        else closeOneVerse(n);
      }
    }
  });

  root.addEventListener("focusin", (event) => {
    const textEl = event.target.closest(".otext");
    if (!textEl || !root.contains(textEl)) return;
    if (!userScrolling && focusHold && Date.now() < focusHold.until && focusHold.el.isConnected && textEl !== focusHold.el) {
      const holdOutliner = focusHold.el.closest(".outliner");
      if (holdOutliner && holdOutliner.contains(textEl)) {
        focusHold.el.focus({ preventScroll: true });
        placeCaret(focusHold.el, focusHold.offset);
        return;
      }
    }
    if (textEl.dataset.editing !== "1") {
      const offset = caretOffset(textEl);
      textEl.dataset.editing = "1";
      fillEditable(textEl, readEditableText(textEl), { decorate: false });
      placeCaret(textEl, offset);
    }
    requestAnimationFrame(() => {
      if (document.documentElement.classList.contains("spotlight-on")) return;
      keepEditingVisible(textEl);
    });
  });
  // Seed the full height so the first keyboard shrink is a drop, not a new baseline.
  let kbBaseline = (window.visualViewport && window.visualViewport.height) || window.innerHeight || null;
  let kbLowest = null;
  let kbFollowed = false;
  let kbOpenedAt = null;
  function onViewportChange(event) {
    const vv = window.visualViewport;
    const height = vv ? vv.height : (window.innerHeight || 0);
    const frame = spotlightKeyboardFrame(kbBaseline, kbLowest, height, kbFollowed, kbOpenedAt, Date.now());
    kbBaseline = frame.baseline;
    kbLowest = frame.lowest;
    kbFollowed = frame.followed;
    kbOpenedAt = frame.openedAt;
    // The keyboard-open resize may lift the tray once. A later resize, including
    // one fired while the finger drags with the keyboard up, must not yank the chapter.
    const follow = spotlightViewportFollow(
      document.documentElement.classList.contains("spotlight-on"),
      coarsePointer(),
      event.type,
      userScrolling,
      !!touchPan,
      frame.opening,
    );
    if (follow === "ignore") return;
    const active = document.activeElement?.closest?.(".otext");
    if (!active || !root.contains(active)) return;
    keepEditingVisible(active);
  }
  window.visualViewport?.addEventListener("resize", onViewportChange);
  window.visualViewport?.addEventListener("scroll", onViewportChange);
  root.addEventListener("focusout", (event) => {
    const textEl = event.target.closest(".otext");
    if (!textEl || !root.contains(textEl)) return;
    if (event.relatedTarget && textEl.contains(event.relatedTarget)) return;
    const outliner = textEl.closest(".outliner");
    delete textEl.dataset.editing;
    const text = readEditableText(textEl);
    fillEditable(textEl, text, { decorate: true });
    if (outliner) scheduleSave(outliner);
  });

  root.addEventListener("keydown", (event) => {
    const textEl = event.target.closest(".otext");
    if (!textEl || !root.contains(textEl) || event.isComposing || event.keyCode === 229) return;
    const outliner = textEl.closest(".outliner");
    const blocks = clampIndent(readBlocks(outliner));
    const row = textEl.closest(".oblock");
    const index = blocks.findIndex((b) => b.id === row?.dataset.blockId);
    if (index < 0) return;
    const caret = caretOffset(textEl);

    // Enter = split / go to next node (NOT newline). Shift+Enter = newline inside block.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      armEnterInputSuppression();
      splitAtCaret(outliner, blocks, index, caret);
      return;
    }
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      armEnterInputSuppression();
      insertNewlineAt(outliner, blocks, index, caret);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      if (indentSubtree(blocks, index, event.shiftKey ? -1 : 1)) {
        renderOutliner(outliner, blocks, blocks[index].id, caret);
        scheduleSave(outliner);
      }
      return;
    }
    if (event.key === "Backspace" && caret === 0) {
      const current = blocks[index];
      if (current.indent > 0) {
        event.preventDefault();
        indentSubtree(blocks, index, -1);
        renderOutliner(outliner, blocks, current.id, 0);
        scheduleSave(outliner);
        return;
      }
      if (current.bullet !== false) {
        event.preventDefault();
        current.bullet = false;
        renderOutliner(outliner, blocks, current.id, 0);
        scheduleSave(outliner);
        return;
      }
      if (index > 0) {
        event.preventDefault();
        const prev = blocks[index - 1];
        const at = prev.text.length;
        prev.text += current.text;
        blocks.splice(index, 1);
        if (!blocks.length) blocks.push({ id: newId(), indent: 0, text: "", bullet: true });
        clampIndent(blocks);
        renderOutliner(outliner, blocks, prev.id, at);
        scheduleSave(outliner);
      }
      return;
    }
    if (event.key === "ArrowLeft" && !event.shiftKey && atBlockStart(textEl) && index > 0) {
      event.preventDefault();
      const prev = blocks[index - 1];
      renderOutliner(outliner, blocks, prev.id, prev.text.length);
      return;
    }
    if (event.key === "ArrowRight" && !event.shiftKey && atBlockEnd(textEl) && index < blocks.length - 1) {
      event.preventDefault();
      renderOutliner(outliner, blocks, blocks[index + 1].id, 0);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const nav = arrowBlockNav({
        key: event.key,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        index,
        length: blocks.length,
        atFirstVisualLine: atFirstVisualLine(textEl),
        atLastVisualLine: atLastVisualLine(textEl),
        singleVisualLine: singleVisualLine(textEl),
      });
      if (nav && nav.action === "leave") {
        event.preventDefault();
        event.stopPropagation();
        const neighbor = blocks[nav.index];
        const at = caretForNeighbor(nav.direction, neighbor.text.length);
        renderOutliner(outliner, blocks, neighbor.id, at);
      }
      return;
    }
    // Space indent is handled in beforeinput (Rails) + input fallback for paste/IME.
    // First space inserts; second leading space consumes via consumeLeadingSpace.
  });

  root.addEventListener("beforeinput", (event) => {
    const textEl = event.target.closest(".otext");
    if (!textEl || !root.contains(textEl)) return;
    const outliner = textEl.closest(".outliner");
    const blocks = clampIndent(readBlocks(outliner));
    const row = textEl.closest(".oblock");
    const index = blocks.findIndex((b) => b.id === row?.dataset.blockId);
    if (index < 0) return;
    const caret = caretOffset(textEl);

    // ContentEditable Enter often arrives as insertParagraph / insertLineBreak.
    // On mobile that echo follows keydown and would split again, leaving the caret on row 1.
    if (event.inputType === "insertParagraph") {
      event.preventDefault();
      if (enterInputSuppressed(suppressEnterUntil, Date.now())) return;
      armEnterInputSuppression();
      splitAtCaret(outliner, blocks, index, caret);
      return;
    }
    if (event.inputType === "insertLineBreak") {
      event.preventDefault();
      if (enterInputSuppressed(suppressEnterUntil, Date.now())) return;
      armEnterInputSuppression();
      insertNewlineAt(outliner, blocks, index, caret);
      return;
    }

    if (event.data !== " ") return;
    const value = blocks[index].text || "";
    if (shouldBulletOnSpace(value, caret)) {
      event.preventDefault();
      blocks[index].bullet = true;
      blocks[index].text = "";
      renderOutliner(outliner, blocks, blocks[index].id, 0);
      scheduleSave(outliner);
      return;
    }
    if (!shouldIndentOnSpace(value, caret)) return;
    event.preventDefault();
    if (consumeLeadingSpace(blocks, index)) {
      renderOutliner(outliner, blocks, blocks[index].id, 0);
      scheduleSave(outliner);
    }
  });

  root.addEventListener("input", (event) => {
    const textEl = event.target.closest(".otext");
    if (!textEl || !root.contains(textEl)) return;
    const outliner = textEl.closest(".outliner");
    const blocks = clampIndent(readBlocks(outliner));
    const row = textEl.closest(".oblock");
    const index = blocks.findIndex((b) => b.id === row?.dataset.blockId);
    if (index >= 0 && /^ {2}/.test(blocks[index].text || "") && consumeLeadingSpace(blocks, index)) {
      renderOutliner(outliner, blocks, blocks[index].id, 0);
    }
    scheduleSave(outliner);
    syncExpandBtn();
  });

  document.querySelector("#expand-all-btn")?.addEventListener("click", () => {
    const btn = document.querySelector("#expand-all-btn");
    if (!btn || btn.disabled) return;
    if (expanding) {
      // Collapse every verse tray, including the currently selected verse. Keep
      // chapter notes independent: they live in #chapter-tray, not .note-tray.
      expanding = false;
      collapsedNotes.clear();
      selectedVerse = null;
      openVerses.clear();
      document.querySelectorAll(".verse").forEach((verse) => verse.classList.remove("is-open"));
      document.querySelectorAll(".note-tray").forEach((tray) => { setNoteTray(tray, false); });
      history.replaceState({}, "", "/" + chapterSlug);
      syncExpandBtn();
      return;
    }
    expanding = true;
    collapsedNotes.clear();
    refreshExpand();
    syncExpandBtn();
    // After trays open/anim, snappy-scroll so the first opened note tray is in view
    // (do not leave the reader parked at the top of the chapter).
    const firstTray = document.querySelector(".note-tray:not([hidden])");
    if (firstTray) {
      const runScroll = () => snappyScrollIntoView(firstTray, { block: "nearest" });
      if (prefersReduceMotion()) {
        requestAnimationFrame(runScroll);
      } else {
        setTimeout(() => requestAnimationFrame(runScroll), TRAY_MS + 16);
      }
    }
  });

  document.querySelector("#chapter-note-peek")?.addEventListener("click", () => {
    const tray = document.querySelector("#chapter-tray");
    if (!tray) return;
    dismissReaderHint();
    setChapterNoteOpen(Boolean(tray.hidden), { push: true, focus: true });
  });

  document.querySelector("#chapter-bookmark-btn")?.addEventListener("click", () => {
    const tray = document.querySelector("#chapter-tray");
    const outliner = tray?.querySelector(".outliner");
    if (!tray || !outliner) return;
    const next = !isBookmarked(tray);
    syncBookmarkButton(tray, next);
    const payload = trayPayload(outliner);
    payload.bookmarked = next;
    window.clearTimeout(timers.get(payload.slug));
    timers.delete(payload.slug);
    saveSlug(payload.slug, payload.blocks, {
      bookmarked: next,
      attachments: payload.attachments,
      tray,
    });
    syncVerseMarks();
    syncExpandBtn();
    refreshExpand();
  });


  window.addEventListener("pagehide", flushAll);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });


  async function attachFromInput(raw) {
    if (!attTray) return;
    const parsed = parseAttachmentInput(raw);
    if (!parsed) {
      const status = document.querySelector("#att-drop-status");
      if (status) {
        status.textContent = "Need a passage or an http(s) link.";
        status.classList.add("is-error");
      }
      document.querySelector("#att-drop-zone")?.classList.add("is-bad");
      return;
    }
    const current = readAttachments(attTray);
    const key = parsed.kind === "xref" ? "xref:" + parsed.slug : "url:" + parsed.url;
    if (current.some((row) => (row.kind === "xref" ? "xref:" + row.slug : "url:" + row.url) === key)) {
      const status = document.querySelector("#att-drop-status");
      if (status) { status.textContent = "Already attached."; status.classList.remove("is-error"); }
      return;
    }
    const next = normalizeAttachments([...current, parsed]);
    paintAttBoard(attTray, next, { freshIds: [parsed.id] });
    flashAttachButton(attTray);
    const outliner = attTray.querySelector(".outliner");
    if (outliner) {
      const slug = outliner.dataset.slug;
      if (parsed.kind === "xref") dismissedXrefs.get(slug)?.delete(parsed.slug);
      const blocks = clampIndent(readBlocks(outliner));
      const bookmarked = isBookmarked(attTray);
      window.clearTimeout(timers.get(slug));
      timers.delete(slug);
      // Optimistic local + session cache so a soft-nav hop cannot drop the chip.
      const prev = noteMap.get(slug) || { slug, kind: slug === chapterSlug ? "chapter" : "verse" };
      noteMap.set(slug, { ...prev, blocks, bookmarked, attachments: next });
      notesPrefetch.delete(chapterSlug);
      writeChapterNotesCache(chapterSlug, [...noteMap.values()]);
      // Flush-on-attach: await PUT so leave/visibility cannot race the write.
      const titleWait = parsed.kind === "url" ? requestLinkTitle(parsed.url) : null;
      await saveSlug(slug, blocks, {
        bookmarked,
        attachments: next,
        tray: attTray,
      });
      if (titleWait) {
        titleWait.then((pageTitle) => {
          if (pageTitle) applySavedUrlTitle(attTray, parsed.url, parsed.title, pageTitle);
        });
      }
    }
    const zone = document.querySelector("#att-drop-zone");
    zone?.classList.remove("is-bad");
    zone?.classList.add("is-ok");
    document.querySelector("#att-drop-check")?.removeAttribute("hidden");
    const status = document.querySelector("#att-drop-status");
    if (status) {
      status.textContent = "Attached " + (parsed.title || parsed.slug || parsed.url) + ".";
      status.classList.remove("is-error");
    }
    const input = document.querySelector("#att-drop-input");
    if (input) input.value = "";
    closeAttSuggest();
    syncVerseMarks();
    syncExpandBtn();
    refreshExpand();
    setTimeout(() => {
      zone?.classList.remove("is-ok");
      document.querySelector("#att-drop-check")?.setAttribute("hidden", "");
    }, 1200);
  }
  const attInput = document.querySelector("#att-drop-input");
  const attSuggest = document.querySelector("#att-drop-suggest");
  const attField = document.querySelector(".att-drop-field");
  let attHits = [];
  let attSelected = -1;
  let attSuggestTimer = null;
  let attSuggestSeq = 0;

  function looksLikeUrl(raw) {
    const q = String(raw || "").trim().toLowerCase();
    return q.startsWith("http://") || q.startsWith("https://") || q.startsWith("www.");
  }
  function attOptionItems() {
    return attSuggest ? [...attSuggest.querySelectorAll("li[role='option']")] : [];
  }
  function syncAttActive() {
    if (!attInput) return;
    const items = attOptionItems();
    const active = items[attSelected];
    if (active) attInput.setAttribute("aria-activedescendant", active.id);
    else attInput.removeAttribute("aria-activedescendant");
  }
  function closeAttSuggest() {
    if (!attSuggest || !attInput) return;
    attSuggest.hidden = true;
    attSuggest.innerHTML = "";
    attField?.classList.remove("is-open");
    attInput.setAttribute("aria-expanded", "false");
    attInput.removeAttribute("aria-activedescendant");
    attSelected = -1;
    attHits = [];
  }
  function renderAttSuggest(state) {
    if (!attSuggest || !attInput) return;
    attHits = state.hits || [];
    const open = attHits.length > 0 || Boolean(state.hint);
    attSelected = open && attHits.length ? 0 : -1;
    attSuggest.hidden = !open;
    attField?.classList.toggle("is-open", open);
    attInput.setAttribute("aria-expanded", open ? "true" : "false");
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const hint = state.hint
      ? '<li class="suggest-hint" role="note">' + esc(state.hint) + "</li>"
      : "";
    const options = attHits.map((hit, index) => {
      const id = "att-opt-" + index;
      const sel = index === attSelected;
      return (
        '<li id="' + id + '" role="option" aria-selected="' + (sel ? "true" : "false") +
        '"><button type="button" data-index="' + index + '">' + esc(hit.label) + "</button></li>"
      );
    }).join("");
    attSuggest.innerHTML = options + hint;
    syncAttActive();
  }
  function attInsertTextFor(hit) {
    const text = String(hit?.insertText || hit?.label || "");
    if (hit?.kind === "book" && text && !text.endsWith(" ")) return text + " ";
    return text;
  }
  function sameAttEntry(current, next) {
    return String(current || "").trim().toLowerCase() === String(next || "").trim().toLowerCase();
  }
  async function attSuggestNow() {
    if (!attInput) return;
    const q = attInput.value;
    const my = ++attSuggestSeq;
    if (!String(q).trim() || looksLikeUrl(q)) {
      closeAttSuggest();
      return;
    }
    try {
      const res = await fetch("/api/jump-suggest?q=" + encodeURIComponent(q), {
        headers: { accept: "application/json" },
      });
      if (!res.ok || my !== attSuggestSeq) return;
      const data = await res.json();
      if (my !== attSuggestSeq) return;
      renderAttSuggest(data);
    } catch (_) {
      /* ignore transient network blips */
    }
  }
  function scheduleAttSuggest() {
    if (attSuggestTimer) clearTimeout(attSuggestTimer);
    attSuggestTimer = setTimeout(attSuggestNow, 40);
  }
  function moveAttHighlight(delta) {
    const items = attOptionItems();
    if (!items.length) return;
    attSelected = (attSelected + delta + items.length) % items.length;
    items.forEach((item, i) => item.setAttribute("aria-selected", i === attSelected ? "true" : "false"));
    syncAttActive();
  }
  async function attCanGo(value) {
    try {
      const res = await fetch("/api/jump-suggest?q=" + encodeURIComponent(value), {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.canGo);
    } catch (_) {
      return false;
    }
  }
  async function applyAttHit(hit) {
    if (!hit || !attInput) return;
    const next = attInsertTextFor(hit);
    attInput.value = next;
    // Attach modal: once the hit resolves to a passage/url, attach immediately
    // (unlike jump, which may still be refining book → chapter → verse).
    if (parseAttachmentInput(next)) {
      await attachFromInput(next);
      return;
    }
    attInput.focus();
    attInput.setSelectionRange(next.length, next.length);
    attSuggestNow();
  }

  document.querySelector("#att-drop-add")?.addEventListener("click", (event) => {
    event.preventDefault();
    attachFromInput(document.querySelector("#att-drop-input")?.value || "");
  });
  attInput?.addEventListener("input", scheduleAttSuggest);
  attInput?.addEventListener("keydown", (event) => {
    const items = attOptionItems();
    if (event.key === "ArrowDown") {
      if (!attSuggest || attSuggest.hidden || !items.length) return;
      event.preventDefault();
      moveAttHighlight(1);
      return;
    }
    if (event.key === "ArrowUp") {
      if (!attSuggest || attSuggest.hidden || !items.length) return;
      event.preventDefault();
      moveAttHighlight(-1);
      return;
    }
    if (event.key === "Tab" && attSelected >= 0 && items.length) {
      event.preventDefault();
      applyAttHit(attHits[attSelected]);
      return;
    }
    if (event.key === "Escape") {
      if (attSuggest && !attSuggest.hidden) {
        event.preventDefault();
        event.stopPropagation();
        closeAttSuggest();
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (attSelected >= 0 && items.length) {
        applyAttHit(attHits[attSelected]);
        return;
      }
      attachFromInput(event.currentTarget.value || "");
    }
  });
  attSuggest?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-index]");
    if (!btn) return;
    event.preventDefault();
    const index = Number(btn.dataset.index);
    if (!Number.isFinite(index) || !attHits[index]) return;
    applyAttHit(attHits[index]);
  });
  document.querySelector("#att-drop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.querySelector("#att-drop")?.addEventListener("close", () => {
    attTray = null;
    closeAttSuggest();
  });
  document.querySelector("#att-drop-form")?.addEventListener("submit", (event) => {
    // Never let Enter / implicit submit dismiss via method=dialog cancel.
    event.preventDefault();
  });
  document.querySelector("#att-drop-close")?.addEventListener("click", (event) => {
    event.preventDefault();
    document.querySelector("#att-drop")?.close();
  });
  const zone = document.querySelector("#att-drop-zone");
  zone?.addEventListener("dragover", (event) => { event.preventDefault(); zone.classList.add("is-over"); });
  zone?.addEventListener("dragleave", (event) => {
    if (!zone.contains(event.relatedTarget)) zone.classList.remove("is-over");
  });
  zone?.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("is-over");
    const text = event.dataTransfer?.getData("text/uri-list") || event.dataTransfer?.getData("text/plain") || "";
    attachFromInput(text);
  });
  zone?.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text/plain") || "";
    if (!text.trim()) return;
    event.preventDefault();
    attachFromInput(text);
  });

  window.addEventListener("pointerdown", (event) => {
    if (!xrefSpan) return;
    const el = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    if (el?.closest?.(".verse-press, a.wiki, a.att-chip, .att-remove, .note-tray, .chapter-tray, .chapter-note-rail, .att-drop, .topbar, .jump")) return;
    clearXref({ replaceUrl: true });
  });

  // --- Chapter notes cache + lazy hydrate (VBV-first) ---
  const CHAPTER_NOTES_KEY = "margin_chapter_notes_v1";
  const htmlCache = new Map();
  // Paint a prefetched /notes document only while it is still young. Refresh in the
  // background after TTL so a later tap stays instant. Refuse a snapshot older than MAX
  // (another device, or a background tab whose refresh did not run). A save on this page
  // drops the snapshot immediately. The list is the SSR document, not a client re-render.
  const INBOX_HTML_TTL = 20000;
  const INBOX_HTML_MAX = 120000;
  let inboxHtml = null;
  let inboxHtmlFlight = null;
  let inboxHtmlGen = 0;
  let inboxHtmlTimer = 0;
  const notesCache = new Map();
  function readChapterNotesCache() {
    try {
      const raw = sessionStorage.getItem(CHAPTER_NOTES_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch { return {}; }
  }
  function writeChapterNotesCache(slug, list) {
    try {
      const all = readChapterNotesCache();
      all[slug] = { notes: list, savedAt: Date.now() };
      const keys = Object.keys(all).sort((a, b) => (all[b].savedAt || 0) - (all[a].savedAt || 0));
      const trimmed = {};
      for (const key of keys.slice(0, 24)) trimmed[key] = all[key];
      sessionStorage.setItem(CHAPTER_NOTES_KEY, JSON.stringify(trimmed));
      notesCache.set(slug, list);
    } catch {}
  }
  function cachedChapterNotes(slug) {
    if (notesCache.has(slug)) return notesCache.get(slug);
    const row = readChapterNotesCache()[slug];
    if (row && Array.isArray(row.notes)) {
      notesCache.set(slug, row.notes);
      return row.notes;
    }
    return null;
  }
  function bumpChapterNotesGen(slug) {
    const next = (chapterNotesGen.get(slug) || 0) + 1;
    chapterNotesGen.set(slug, next);
    notesPrefetch.delete(slug);
    return next;
  }
  function dropChapterNotesCache(slug) {
    if (!slug) return;
    bumpChapterNotesGen(slug);
    notesCache.delete(slug);
    try {
      const all = readChapterNotesCache();
      if (!all[slug]) return;
      delete all[slug];
      sessionStorage.setItem(CHAPTER_NOTES_KEY, JSON.stringify(all));
    } catch {}
  }
  function dropLinkedChapterCaches(slugs) {
    if (!Array.isArray(slugs)) return;
    const seen = new Set();
    for (const slug of slugs) {
      const key = inboxChapterSlugOf(slug);
      if (!key || key === chapterSlug || seen.has(key)) continue;
      seen.add(key);
      dropChapterNotesCache(key);
    }
  }
  function reconcileChapterNotes(list) {
    bumpChapterNotesGen(chapterSlug);
    const incoming = (list || []).map(normalizeHydrateNote).filter((n) => n.slug);
    const keep = new Set(incoming.map((n) => n.slug));
    for (const slug of [...noteMap.keys()]) {
      if (keep.has(slug) || noteIsDirty(slug)) continue;
      noteMap.delete(slug);
      lastSaved.delete(slug);
      const tray = slug === chapterSlug
        ? document.querySelector("#chapter-tray")
        : document.querySelector('.note-tray[data-slug="' + CSS.escape(slug) + '"]');
      if (!tray) continue;
      if (tray.dataset.covering === "1") tray.remove();
      else {
        paintNoteIntoTray(tray, {
          slug,
          blocks: [{ id: "b_empty", indent: 0, text: "", bullet: true }],
          bookmarked: false,
          attachments: [],
        });
      }
    }
    applyHydratedNotes(incoming);
  }
  function normalizeHydrateNote(n) {
    const slug = String(n?.slug || "");
    const verseStart = n?.verseStart == null ? null : Number(n.verseStart);
    const verseEnd = n?.verseEnd == null ? null : Number(n.verseEnd);
    let kind = n?.kind;
    if (!kind) {
      if (slug === chapterSlug) kind = "chapter";
      else if (verseEnd != null && verseStart != null && verseEnd !== verseStart) kind = "range";
      else kind = "verse";
    }
    return {
      slug,
      kind,
      verseStart,
      verseEnd,
      blocks: Array.isArray(n?.blocks) ? n.blocks : [],
      bookmarked: Boolean(n?.bookmarked),
      attachments: Array.isArray(n?.attachments) ? n.attachments : [],
      label: n?.label || slugLabel(slug),
      updatedAt: n?.updatedAt || "",
      createdAt: n?.createdAt || "",
    };
  }
  function noteIsDirty(slug) {
    if (timers.has(slug)) return true;
    const active = document.activeElement?.closest?.(".outliner");
    if (!active || active.dataset.slug !== slug) return false;
    // Autofocus on a direct verse link is not an edit. Compare the tray to the
    // last snapshot so /api/notes can still fill an untouched composer.
    const payload = trayPayload(active);
    const key = JSON.stringify({
      blocks: payload.blocks,
      bookmarked: payload.bookmarked,
      attachments: payload.attachments,
    });
    return lastSaved.get(slug) !== key;
  }
  function ensureNoteTray(note) {
    if (!note?.slug) return null;
    if (note.kind === "chapter" || note.slug === chapterSlug) {
      return document.querySelector("#chapter-tray");
    }
    let tray = document.querySelector('.note-tray[data-slug="' + CSS.escape(note.slug) + '"]');
    if (tray) return mountRangeTray(tray, note);
    const anchor = trayAnchorVerse(note);
    if (anchor == null) return null;
    const verse = document.querySelector('.verse[data-verse="' + anchor + '"]');
    if (!verse) return null;
    const composer = verse.querySelector('.note-tray[data-verse-composer]');
    const template = composer || verse.querySelector(".note-tray");
    if (!template) return null;
    tray = template.cloneNode(true);
    tray.hidden = true;
    tray.classList.remove("is-tray-anim", "is-tray-closing");
    tray.style.gridTemplateRows = "";
    tray.style.opacity = "";
    tray.style.transition = "";
    tray.dataset.slug = note.slug;
    tray.dataset.covering = "1";
    delete tray.dataset.verseComposer;
    tray.removeAttribute("data-verse-composer");
    if (isRangeSlug(note.slug)) {
      tray.dataset.rangeComposer = "1";
    } else {
      delete tray.dataset.rangeComposer;
      tray.removeAttribute("data-range-composer");
    }
    const outliner = tray.querySelector(".outliner");
    if (outliner) outliner.dataset.slug = note.slug;
    tray.querySelectorAll("[data-clear]").forEach((el) => { el.dataset.clear = note.slug; });
    tray.querySelectorAll("[data-status-for]").forEach((el) => {
      el.dataset.statusFor = note.slug;
      el.textContent = "";
    });
    const label = tray.querySelector(".tray-label");
    if (label) {
      label.textContent = note.label || slugLabel(note.slug);
      label.href = "https://route.bible/" + note.slug;
    }
    if (isRangeSlug(note.slug)) return mountRangeTray(tray, note);
    if (composer) composer.before(tray);
    else verse.append(tray);
    return tray;
  }
  function paintNoteIntoTray(tray, note) {
    if (!tray || !note) return;
    if (noteIsDirty(note.slug)) return;
    const outliner = tray.querySelector(".outliner");
    const activeText = outliner && document.activeElement && outliner.contains(document.activeElement)
      ? document.activeElement.closest(".otext")
      : null;
    const wasFocused = !!activeText;
    const blocks = (note.blocks && note.blocks.length)
      ? note.blocks
      : [{ id: outliner?.dataset.emptyId || "b_empty", indent: 0, text: "", bullet: true }];
    if (outliner) {
      const row = activeText ? activeText.closest(".oblock") : null;
      const domRows = [...outliner.querySelectorAll(".oblock")];
      const target = repaintFocus({
        wasFocused,
        activeId: row ? row.dataset.blockId : "",
        activeIndex: row ? domRows.indexOf(row) : -1,
        caret: activeText ? caretOffset(activeText) : 0,
        blocks,
      });
      // Missing row: keep the local outline. Repainting would pin the caret on row 1.
      if (!(wasFocused && !target)) {
        renderOutliner(outliner, blocks, target ? target.id : undefined, target ? target.caret : undefined);
      }
    }
    syncBookmarkButton(tray, note.bookmarked);
    paintAttBoard(tray, note.attachments || []);
    lastSaved.set(note.slug, JSON.stringify({
      blocks: note.blocks || [],
      bookmarked: Boolean(note.bookmarked),
      attachments: note.attachments || [],
    }));
  }
  function mergeIncomingBacklinks(note) {
    const local = noteMap.get(note.slug);
    if (!local) return;
    const dismissed = dismissedXrefs.get(note.slug) || new Set();
    const have = new Set();
    for (const row of local.attachments || []) {
      if (row && row.kind === "xref" && row.slug) have.add(row.slug);
    }
    const extra = [];
    for (const row of note.attachments || []) {
      if (!row || row.kind !== "xref" || row.source !== "backlink" || !row.slug) continue;
      if (have.has(row.slug) || dismissed.has(row.slug)) continue;
      extra.push(row);
      have.add(row.slug);
    }
    if (!extra.length) return;
    const attachments = (local.attachments || []).concat(extra);
    noteMap.set(note.slug, { ...local, attachments });
    const tray = note.slug === chapterSlug
      ? document.querySelector("#chapter-tray")
      : document.querySelector('.note-tray[data-slug="' + CSS.escape(note.slug) + '"]');
    if (tray) paintAttBoard(tray, attachments);
  }
  function applyHydratedNotes(list) {
    const incoming = (list || []).map(normalizeHydrateNote).filter((n) => n.slug);
    for (const note of incoming) {
      if (noteIsDirty(note.slug) && noteMap.has(note.slug)) {
        mergeIncomingBacklinks(note);
        continue;
      }
      noteMap.set(note.slug, note);
      const tray = ensureNoteTray(note);
      paintNoteIntoTray(tray, note);
    }
    writeChapterNotesCache(chapterSlug, [...noteMap.values()]);
    syncVerseMarks();
    syncExpandBtn();
    syncChapterBookmarkBtn(Boolean(noteMap.get(chapterSlug)?.bookmarked));
    syncChapterNoteChrome();
    if (expanding) refreshExpand();
    notesHydrated = true;
    root.dataset.notesPending = "0";
  }
  function showNotesSlowDown() {
    setStatus(chapterSlug, "Slow down");
    let banner = document.getElementById("notes-rate-limit");
    if (!banner) {
      banner = document.createElement("p");
      banner.id = "notes-rate-limit";
      banner.className = "hint";
      banner.setAttribute("role", "status");
      const main = document.querySelector("main.reader");
      if (main) main.prepend(banner);
      else root.prepend(banner);
    }
    banner.textContent = "Slow down. Notes will show again in a minute.";
  }
  function prefetchChapterNotes(slug) {
    if (!slug) return Promise.resolve(null);
    if (notesPrefetch.has(slug)) return notesPrefetch.get(slug);
    const gen = chapterNotesGen.get(slug) || 0;
    const req = fetch("/api/notes?chapter=" + encodeURIComponent(slug), {
      credentials: "include",
      headers: { accept: "application/json" },
      priority: "low",
    })
      .then((r) => {
        if (r.status === 429) return { rateLimited: true };
        return r.ok ? r.json() : Promise.reject();
      })
      .then((data) => {
        if (data && data.rateLimited) return data;
        if ((chapterNotesGen.get(slug) || 0) !== gen) return null;
        if (data?.ok && Array.isArray(data.notes)) {
          const normalized = data.notes.map(normalizeHydrateNote);
          writeChapterNotesCache(slug, normalized);
          return normalized;
        }
        return null;
      })
      .catch(() => { notesPrefetch.delete(slug); return null; });
    notesPrefetch.set(slug, req);
    return req;
  }
  async function hydrateChapterNotes() {
    const cached = cachedChapterNotes(chapterSlug);
    if (cached?.length) applyHydratedNotes(cached);
    const fresh = await prefetchChapterNotes(chapterSlug);
    if (fresh && fresh.rateLimited) {
      showNotesSlowDown();
      notesHydrated = true;
      root.dataset.notesPending = "0";
      syncExpandBtn();
      return;
    }
    if (Array.isArray(fresh)) applyHydratedNotes(fresh);
    else {
      notesHydrated = true;
      root.dataset.notesPending = "0";
      syncExpandBtn();
    }
  }
  if (notesPending) {
    // Cache paints markers/trays sync when available; API refresh follows.
    hydrateChapterNotes().catch(() => {
      notesHydrated = true;
      root.dataset.notesPending = "0";
      syncExpandBtn();
    });
  } else if (noteMap.size) {
    writeChapterNotesCache(chapterSlug, [...noteMap.values()]);
  }
  syncRangeRails();
  const READER_HINT_KEY = "margin_reader_hint_v1";
  function dismissReaderHint() {
    const hint = document.querySelector("#reader-hint");
    if (hint) hint.hidden = true;
    document.documentElement.setAttribute("data-reader-hint", "off");
    try { localStorage.setItem(READER_HINT_KEY, "1"); } catch {}
  }
  function bootReaderHint() {
    const hint = document.querySelector("#reader-hint");
    if (!hint) return;
    try {
      if (localStorage.getItem(READER_HINT_KEY) === "1") hint.hidden = true;
    } catch {}
    hint.addEventListener("click", () => dismissReaderHint());
  }
  bootReaderHint();

  document.documentElement.classList.add("spotlight-on");
  // Opening a verse owns the glide. The caret follow waits until the next focus.
  let placeInstant = false;
  function slideBy(delta) {
    if (Math.abs(delta) < 1) return;
    const from = window.scrollY || window.pageYOffset || 0;
    smoothScrollTo(from + delta);
  }
  function isMobileSpotlight() {
    return window.matchMedia("(max-width: 767px)").matches;
  }
  function stickyHeaderHeight() {
    const header = document.querySelector(".topbar");
    return header ? header.getBoundingClientRect().height : 0;
  }
  function centerScrollDelta(rowTop, rowHeight, viewTop, viewHeight, stickyHeaderPx, topAlign) {
    if (topAlign) return rowTop - viewTop - stickyHeaderPx;
    return rowTop + rowHeight / 2 - (viewTop + viewHeight / 2);
  }
  function spotlightLine(target) {
    if (!target || !target.closest) return null;
    const text = target.classList && target.classList.contains("otext") ? target : target.closest(".otext");
    if (!text) return null;
    const block = text.closest(".oblock") || text.closest(".verse") || text.closest(".chapter-note-rail");
    if (!block) return null;
    // Desktop centers the caret line. Mobile top-aligns the verse, so the
    // scripture stays under the header instead of scrolling off above the note.
    if (isMobileSpotlight()) return text.closest(".verse") || text.closest(".chapter-note-rail") || block;
    return block;
  }
  function centerElement(el, topAlign) {
    if (!el || !el.isConnected) return;
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) return;
    const vv = window.visualViewport;
    const viewTop = vv ? vv.offsetTop : 0;
    const viewHeight = vv ? vv.height : window.innerHeight;
    const alignTop = topAlign == null ? isMobileSpotlight() : topAlign;
    slideBy(centerScrollDelta(rect.top, rect.height, viewTop, viewHeight, stickyHeaderHeight(), alignTop));
  }
  window.addEventListener("pointerdown", () => {
    document.documentElement.classList.add("spotlight-fade");
  }, true);
  window.addEventListener("keydown", () => {
    document.documentElement.classList.remove("spotlight-fade");
  }, true);
  window.addEventListener("focusin", (event) => {
    const line = spotlightLine(event.target);
    if (!line) return;
    requestAnimationFrame(() => {
      if (!line.isConnected) return;
      const sel = document.getSelection();
      if (sel && !sel.isCollapsed && sel.anchorNode && line.contains(sel.anchorNode)) return;
      // Opening centers once from openVerse. On a phone, later focus must not
      // pull that verse back to mid-screen while the reader scrolls.
      const follow = spotlightFocusFollow(placeInstant, coarsePointer(), userScrolling);
      if (follow === "consume-instant") { placeInstant = false; return; }
      if (follow === "hold") return;
      centerElement(line);
    });
  }, true);

  // Verse rail. Dragging or keying it scrolls the window. The rail scrolls. It does not open a note or change the passage.
  // A finger drag stays with the chapter: no preventDefault and no pointer capture. A tap on the rail still jumps.
  const verseRail = root.querySelector("[data-reader-rail]");
  const verseRailPreview = root.querySelector("[data-reader-rail-preview]");
  const VERSE_RAIL_DOTS = 28;
  if (verseRail && verseRailPreview) {
    const verseRows = () => [...document.querySelectorAll("#chapter .verse[data-verse]")];
    let railActive = false;
    let railIndex = -1;
    let railPointerId = null;
    let railTouchActive = false;
    let railTargets = [];
    let railHideTimer = 0;
    function railMaxScroll() {
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      const height = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
      return Math.max(0, height - vh);
    }
    function railScrollY() {
      return window.scrollY || window.pageYOffset || 0;
    }
    function railRatio(clientY) {
      const rect = verseRail.getBoundingClientRect();
      if (rect.height <= 0) return 0;
      return Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    }
    function railDotIndex(verseIndex, count) {
      if (count <= 1) return 0;
      const ratio = verseIndex / (count - 1);
      return Math.min(VERSE_RAIL_DOTS - 1, Math.max(0, Math.round(ratio * (VERSE_RAIL_DOTS - 1))));
    }
    function clearRailActiveVerse() {
      document.querySelectorAll(".reader-rail-active-verse").forEach((row) => row.classList.remove("reader-rail-active-verse"));
    }
    function setRailPreview(index) {
      const rows = verseRows();
      const row = rows[index];
      if (!row) return;
      const dotIndex = railDotIndex(index, rows.length);
      railIndex = index;
      const verseNo = row.dataset.verse || String(index + 1);
      verseRail.setAttribute("aria-valuenow", String(index + 1));
      verseRail.setAttribute("aria-valuetext", "Verse " + verseNo);
      verseRail.classList.add("visible");
      verseRail.querySelectorAll("[data-reader-rail-dot-index]").forEach((dot, i) => {
        const distance = Math.abs(i - dotIndex);
        dot.classList.toggle("current", distance === 0);
        dot.classList.toggle("wave-1", distance === 1);
        dot.classList.toggle("wave-2", distance === 2);
        dot.classList.toggle("wave-3", distance === 3);
      });
      verseRailPreview.textContent = verseNo;
      verseRailPreview.hidden = false;
      clearRailActiveVerse();
      row.classList.add("reader-rail-active-verse");
    }
    function clearRailPreview() {
      railHideTimer = 0;
      clearRailActiveVerse();
      verseRailPreview.hidden = true;
      verseRailPreview.textContent = "";
      verseRail.classList.remove("visible");
      railIndex = -1;
      verseRail.querySelectorAll("[data-reader-rail-dot-index]").forEach((dot) => {
        dot.classList.remove("current", "wave-1", "wave-2", "wave-3");
      });
    }
    function setRailScrollTarget(top) {
      smoothScrollTo(top);
    }
    function buildRailTargets() {
      const rows = verseRows();
      const maxTop = railMaxScroll();
      if (!rows.length || maxTop <= 0) { railTargets = []; return; }
      const y = railScrollY();
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      railTargets = rows.map((row, index) => {
        if (index === 0) return 0;
        if (index === rows.length - 1) return maxTop;
        const rect = row.getBoundingClientRect();
        const center = y + rect.top + rect.height / 2;
        return Math.max(0, Math.min(maxTop, center - vh / 2));
      });
    }
    function scrollRailToExact(exactIndex, ratio) {
      const rows = verseRows();
      if (!rows.length) return;
      const maxTop = railMaxScroll();
      const denom = Math.max(1, rows.length - 1);
      const lower = Math.max(0, Math.min(rows.length - 1, Math.floor(exactIndex)));
      const upper = Math.max(0, Math.min(rows.length - 1, Math.ceil(exactIndex)));
      const t = Math.max(0, Math.min(1, exactIndex - lower));
      const lowerFallback = (lower / denom) * maxTop;
      const upperFallback = (upper / denom) * maxTop;
      const lowerTarget = railTargets[lower] != null ? railTargets[lower] : lowerFallback;
      const upperTarget = railTargets[upper] != null ? railTargets[upper] : upperFallback;
      const interpolated = lowerTarget + (upperTarget - lowerTarget) * t;
      setRailScrollTarget(Number.isFinite(interpolated) ? interpolated : ratio * maxTop);
    }
    function moveRail(clientY) {
      const rows = verseRows();
      if (!rows.length) return;
      const ratio = railRatio(clientY);
      const exact = rows.length <= 1 ? 0 : ratio * (rows.length - 1);
      const preview = rows.length <= 1 ? 0 : Math.min(rows.length - 1, Math.max(0, Math.round(exact)));
      setRailPreview(preview);
      scrollRailToExact(exact, ratio);
    }
    function endRailDrag() {
      if (!railActive) return;
      railActive = false;
      railTouchActive = false;
      verseRail.classList.remove("dragging");
      clearRailActiveVerse();
      railTargets = [];
      if (railPointerId != null && verseRail.releasePointerCapture && verseRail.hasPointerCapture && verseRail.hasPointerCapture(railPointerId)) {
        verseRail.releasePointerCapture(railPointerId);
      }
      railPointerId = null;
      window.removeEventListener("pointermove", onRailPointerMove);
      window.removeEventListener("pointerup", endRailDrag);
      window.removeEventListener("pointercancel", endRailDrag);
      window.removeEventListener("touchmove", onRailTouchMove);
      window.removeEventListener("touchend", endRailDrag);
      window.removeEventListener("touchcancel", endRailDrag);
      if (railHideTimer) window.clearTimeout(railHideTimer);
      railHideTimer = window.setTimeout(clearRailPreview, 350);
    }
    function startRailDrag(clientY, pointerId) {
      if (window.getSelection) {
        const sel = window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      }
      clearRailActiveVerse();
      if (railHideTimer) { window.clearTimeout(railHideTimer); railHideTimer = 0; }
      buildRailTargets();
      railActive = true;
      verseRail.classList.add("dragging", "visible");
      railPointerId = pointerId == null || !Number.isFinite(pointerId) ? null : pointerId;
      if (railPointerId != null && verseRail.setPointerCapture) {
        try { verseRail.setPointerCapture(railPointerId); } catch { /* Some WebViews reject touch pointers. */ }
      }
      moveRail(clientY);
    }
    const RAIL_TOUCH_SLOP = 10;
    let railWatch = null;
    function railDownAction(pointerType) {
      return pointerType === "touch" ? "watch" : "scrub";
    }
    function railWatchMove(dx, dy) {
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return "pending";
      if (Math.abs(dx) < RAIL_TOUCH_SLOP && Math.abs(dy) < RAIL_TOUCH_SLOP) return "pending";
      return "chapter";
    }
    function railPanScrollDelta(previousY, clientY) {
      if (!Number.isFinite(previousY) || !Number.isFinite(clientY)) return 0;
      return previousY - clientY;
    }
    function railWatchEnd(input) {
      if (input.decided || input.scrolled) return "ignore";
      if (input.type !== "pointerup") return "ignore";
      if (!Number.isFinite(input.dx) || !Number.isFinite(input.dy)) return "ignore";
      if (Math.abs(input.dx) < RAIL_TOUCH_SLOP && Math.abs(input.dy) < RAIL_TOUCH_SLOP) return "jump";
      return "ignore";
    }
    function clearRailWatch() {
      railWatch = null;
      window.removeEventListener("pointermove", onRailWatchMove);
      window.removeEventListener("pointerup", onRailWatchEnd);
      window.removeEventListener("pointercancel", onRailWatchEnd);
    }
    function jumpRailAt(clientY) {
      if (railHideTimer) { window.clearTimeout(railHideTimer); railHideTimer = 0; }
      buildRailTargets();
      moveRail(clientY);
      railTargets = [];
      railHideTimer = window.setTimeout(clearRailPreview, 350);
    }
    function onRailWatchMove(event) {
      if (!railWatch || event.pointerId !== railWatch.id) return;
      if (!railWatch.decided) {
        const decision = railWatchMove(event.clientX - railWatch.x, event.clientY - railWatch.y);
        if (decision === "pending") return;
        // Chapter drag. Scroll with the finger. Do not preventDefault and do not capture.
        railWatch.decided = true;
      }
      const delta = railPanScrollDelta(railWatch.lastY, event.clientY);
      railWatch.lastY = event.clientY;
      if (delta) window.scrollBy(0, delta);
    }
    function onRailWatchEnd(event) {
      if (!railWatch || event.pointerId !== railWatch.id) return;
      const action = railWatchEnd({
        type: event.type,
        dx: event.clientX - railWatch.x,
        dy: event.clientY - railWatch.y,
        decided: railWatch.decided,
        scrolled: Math.abs((window.scrollY || window.pageYOffset || 0) - railWatch.scrollY) > 2,
      });
      const y = event.clientY;
      clearRailWatch();
      if (action === "jump") jumpRailAt(y);
    }
    function onRailPointerMove(event) {
      if (!railActive || event.pointerId !== railPointerId) return;
      event.preventDefault();
      moveRail(event.clientY);
    }
    function onRailPointerDown(event) {
      if (event.button !== 0 || !event.isPrimary) return;
      if (railDownAction(event.pointerType) === "watch") {
        if (railWatch) clearRailWatch();
        railWatch = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          lastY: event.clientY,
          scrollY: window.scrollY || window.pageYOffset || 0,
          decided: false,
        };
        window.addEventListener("pointermove", onRailWatchMove, { passive: true });
        window.addEventListener("pointerup", onRailWatchEnd);
        window.addEventListener("pointercancel", onRailWatchEnd);
        return;
      }
      event.preventDefault();
      window.addEventListener("pointermove", onRailPointerMove, { passive: false });
      window.addEventListener("pointerup", endRailDrag, { once: true });
      window.addEventListener("pointercancel", endRailDrag, { once: true });
      startRailDrag(event.clientY, event.pointerId);
    }
    function onRailTouchMove(event) {
      if (!railActive || !railTouchActive) return;
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      event.preventDefault();
      moveRail(touch.clientY);
    }
    function onRailTouchStart() {
      // Pointer Events owns the rail. This listener must not cancel a finger pan.
    }
    function onRailKeyDown(event) {
      const rows = verseRows();
      if (!rows.length) return;
      let current = railIndex;
      if (current < 0) {
        const open = document.querySelector("#chapter .verse.is-open");
        current = open ? rows.indexOf(open) : 0;
        if (current < 0) current = 0;
      }
      let next = current;
      if (event.key === "ArrowDown" || event.key === "PageDown") next = Math.min(rows.length - 1, current + 1);
      else if (event.key === "ArrowUp" || event.key === "PageUp") next = Math.max(0, current - 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = rows.length - 1;
      else return;
      event.preventDefault();
      if (railHideTimer) { window.clearTimeout(railHideTimer); railHideTimer = 0; }
      buildRailTargets();
      setRailPreview(next);
      scrollRailToExact(next, rows.length <= 1 ? 0 : next / (rows.length - 1));
      railHideTimer = window.setTimeout(clearRailPreview, 350);
    }
    function armNativeScroll() {
      if (railActive) return;
      verseRail.classList.add("is-native-scroll");
      const clearNative = () => verseRail.classList.remove("is-native-scroll");
      window.addEventListener("touchend", clearNative, { once: true });
      window.addEventListener("touchcancel", clearNative, { once: true });
    }
    const chapterEl = document.querySelector("#chapter");
    if (chapterEl) {
      chapterEl.addEventListener("touchstart", (event) => {
        if (verseRail.contains(event.target)) return;
        armNativeScroll();
      }, { passive: true });
    }
    document.addEventListener("selectionchange", () => {
      if (railActive) return;
      const sel = document.getSelection();
      const node = sel && sel.anchorNode;
      const inChapter = Boolean(chapterEl && node && chapterEl.contains(node));
      verseRail.classList.toggle("is-selection-hidden", Boolean(sel && !sel.isCollapsed && inChapter));
    });
    verseRail.addEventListener("pointerdown", onRailPointerDown);
    verseRail.addEventListener("touchstart", onRailTouchStart, { passive: true });
    verseRail.addEventListener("keydown", onRailKeyDown);
  }

  syncChapterBookmarkBtn(Boolean(noteMap.get(chapterSlug)?.bookmarked));
  syncChapterNoteChrome();

  function verseTargetFromLocation() {
    const path = location.pathname.replace(/^\\/+/, "");
    const match = /^[a-z0-9]+\\.\\d+\\.(\\d+)(?:-(\\d+))?$/i.exec(path);
    if (!match) return null;
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (!start || !end) return null;
    return { boot: end, start, end, range: Boolean(match[2]) && end !== start };
  }
  const located = verseTargetFromLocation();
  const boot = root.dataset.bootVerse || (located ? String(located.boot) : "");
  const passageSlug = root.dataset.passageSlug || "";
  const bootPreferRange = passageSlug.includes("-") || Boolean(located && located.range);
  const xrefParam = new URLSearchParams(location.search).get("xref") === "1";
  if (boot && xrefParam) {
    // Chapter HTML (search-style cache) has a chapter passage slug. The URL still names the verse.
    if (located && located.start) {
      applyXref({ start: located.start, end: located.end });
    } else {
      const endMatch = /-(\\d+)$/.exec(passageSlug);
      const start = Number(boot);
      const startFromSlug = (() => {
        const m = /\\.(\\d+)(?:-(\\d+))?$/.exec(passageSlug);
        return m ? Number(m[1]) : start;
      })();
      const end = endMatch ? Number(endMatch[1]) : startFromSlug;
      applyXref({ start: startFromSlug, end });
    }
  } else if (boot) {
    // Place the verse immediately. Spotlight follows the caret later, without a second glide on arrival.
    openVerse(Number(boot), { push: false, autofocus: true, preferRange: bootPreferRange, scroll: true });
  }
  if (new URLSearchParams(location.search).get("chapter_note") === "1") {
    setChapterNoteOpen(true, { push: false, focus: false });
  }

  function chapterSlugFromHref(href) {
    try {
      const path = new URL(href, location.origin).pathname.replace(/^\\/+/, "");
      if (!path || path === "notes" || path.startsWith("api/") || path.startsWith("login")) return null;
      if (!/^[a-z0-9]+\\.\\d+/i.test(path)) return null;
      const m = /^([a-z0-9]+)\\.(\\d+)/i.exec(path);
      return m ? (m[1].toLowerCase() + "." + m[2]) : null;
    } catch { return null; }
  }
  function extractNotesFromHtml(html) {
    const m = /<script id="notes-data" type="application\\/json">([\\s\\S]*?)<\\/script>/.exec(html || "");
    if (!m) return null;
    try {
      const parsed = JSON.parse(m[1]);
      return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  }
  function seedNotesFromHtml(slug, html) {
    if (!slug || !html) return null;
    // SSR may embed [] when notesPending — only seed non-empty payloads.
    const embedded = extractNotesFromHtml(html);
    if (embedded && embedded.length) writeChapterNotesCache(slug, embedded.map(normalizeHydrateNote));
    return embedded;
  }
  function documentHref(href) {
    try {
      const url = new URL(href, location.origin);
      if (url.origin !== location.origin) return "";
      url.hash = "";
      return url.href;
    } catch { return ""; }
  }
  function inboxPageHref() {
    return documentHref("/notes");
  }
  function inboxHtmlFresh() {
    const href = inboxPageHref();
    if (!href || !htmlCache.has(href)) return false;
    if (!inboxHtml) return true;
    return Date.now() - inboxHtml.at < INBOX_HTML_MAX;
  }
  function dropInboxHtml() {
    inboxHtmlGen += 1;
    inboxHtml = null;
    inboxHtmlFlight = null;
    if (inboxHtmlTimer) {
      window.clearTimeout(inboxHtmlTimer);
      inboxHtmlTimer = 0;
    }
    const href = inboxPageHref();
    if (!href) return;
    htmlCache.delete(href);
  }
  function scheduleInboxHtml(delay) {
    if (inboxHtmlTimer) return;
    inboxHtmlTimer = window.setTimeout(() => {
      inboxHtmlTimer = 0;
      prefetchInboxHtml();
    }, delay);
  }
  function prefetchInboxHtml() {
    const href = inboxPageHref();
    if (!href) return;
    const age = inboxHtml ? Date.now() - inboxHtml.at : Infinity;
    if (inboxHtmlFlight) return;
    if (age < INBOX_HTML_TTL) {
      scheduleInboxHtml(INBOX_HTML_TTL - age);
      return;
    }
    const gen = ++inboxHtmlGen;
    const promise = fetch(href, {
      credentials: "same-origin",
      headers: { accept: "text/html", purpose: "prefetch" },
      priority: "low",
    })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((html) => {
        if (gen !== inboxHtmlGen) return html;
        inboxHtml = { html, at: Date.now() };
        htmlCache.set(href, Promise.resolve(html));
        return html;
      })
      .catch(() => {
        if (gen !== inboxHtmlGen) return null;
        if (!inboxHtml) htmlCache.delete(href);
        return null;
      })
      .finally(() => {
        if (gen !== inboxHtmlGen) return;
        inboxHtmlFlight = null;
        scheduleInboxHtml(INBOX_HTML_TTL);
      });
    inboxHtmlFlight = promise;
    if (!inboxHtml) htmlCache.set(href, promise);
  }
  let searchPrefetch = null;
  function prefetchSearchChapter(href) {
    if (!href) {
      if (searchPrefetch) searchPrefetch.controller.abort();
      searchPrefetch = null;
      return;
    }
    const key = documentHref(href);
    const slug = chapterSlugFromHref(key);
    if (!slug) return;
    const chapterKey = documentHref("/" + slug);
    if (searchPrefetch && searchPrefetch.key === chapterKey) return;
    if (searchPrefetch) searchPrefetch.controller.abort();
    const controller = new AbortController();
    searchPrefetch = { key: chapterKey, controller };
    prefetchChapter(chapterKey, { priority: "low", signal: controller.signal });
  }
  async function prefetchChapter(href, opts) {
    href = documentHref(href);
    const slug = chapterSlugFromHref(href);
    if (!slug) return;
    if (!htmlCache.has(href)) {
      const init = { credentials: "same-origin", headers: { accept: "text/html", purpose: "prefetch", "x-margin-prefetch": "1" } };
      if (opts && opts.priority) init.priority = opts.priority;
      if (opts && opts.signal) init.signal = opts.signal;
      const promise = fetch(href, init)
        .then((r) => r.ok ? r.text() : Promise.reject())
        .then((html) => { seedNotesFromHtml(slug, html); return html; })
        .catch(() => {
          if (htmlCache.get(href) === promise) htmlCache.delete(href);
          return null;
        });
      htmlCache.set(href, promise);
    } else {
      Promise.resolve(htmlCache.get(href)).then((html) => seedNotesFromHtml(slug, html)).catch(() => {});
    }
    // Chapter HTML stays scripture-first. A verse or range already carries its notes.
    if (!hrefIsExactNote(href)) prefetchChapterNotes(slug);
  }
  function hrefIsExactNote(href) {
    try {
      const path = new URL(href, location.origin).pathname.replace(/^\\/+/, "");
      return /^[a-z0-9]+\\.\\d+\\.\\d+/i.test(path);
    } catch { return false; }
  }
  function warmAdjacentChapters() {
    // Pager prev/next only — do NOT select every a[data-chapter-nav] (chapter grid
    // cells for the whole book). That previously stormed rom.1–16 HTML+notes after paint.
    document.querySelectorAll(".pager a[href]").forEach((a) => prefetchChapter(a.href));
  }
  const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 120));
  // Eager adjacent chapter HTML + notes API — don't wait for idle on pager links.
  warmAdjacentChapters();
  scheduleIdle(() => warmAdjacentChapters());
  document.addEventListener("pointerenter", (event) => {
    const a = event.target?.closest?.(".pager a[href], a[data-chapter-nav][href], .chapter-grid-cell[href]");
    if (a?.href) prefetchChapter(a.href);
  }, true);

  async function softNavTo(href, { push = true, useChapterCache = false } = {}) {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin) { location.href = href; return; }
    // Persist unsaved attach/xref/body before document.write tears the page down.
    await flushAll({ keepalive: false });
    const exactKey = documentHref(url.href);
    const slug = chapterSlugFromHref(exactKey);
    // Chapters hydrate notes beside the HTML. An exact verse or range does not.
    if (slug && !hrefIsExactNote(url.href)) prefetchChapterNotes(slug);
    const chapterKey = slug ? documentHref("/" + slug) : "";
    try {
      let html = null;
      const exactPromise = htmlCache.get(exactKey);
      if (exactPromise) html = await exactPromise;
      if (!html && useChapterCache && chapterKey && chapterKey !== exactKey) {
        const chapterPromise = htmlCache.get(chapterKey);
        if (chapterPromise) html = await chapterPromise;
      }
      if (!html) {
        const htmlPromise = fetch(exactKey, { credentials: "same-origin", headers: { accept: "text/html" } }).then((r) => {
          if (!r.ok) throw new Error("nav");
          return r.text();
        }).then((html) => { seedNotesFromHtml(slug, html); return html; });
        htmlCache.set(exactKey, htmlPromise);
        html = await htmlPromise;
      }
      // VBV HTML first; destination page hydrates notes via /api/notes?chapter= (and session cache).
      if (!html) { location.href = href; return; }
      seedNotesFromHtml(slug, html);
      if (push) history.pushState({ soft: 1 }, "", url.pathname + url.search + url.hash);
      else history.replaceState({ soft: 1 }, "", url.pathname + url.search + url.hash);
      if (history.scrollRestoration) history.scrollRestoration = "manual";
      // Chapter arrival starts at the top. A verse address keeps its placement.
      const navPath = url.pathname.replace(/^\\/+/, "");
      if (!/^[a-z0-9]+\\.\\d+\\.\\d+/i.test(navPath)) window.scrollTo(0, 0);
      document.open();
      document.write(html);
      document.close();
    } catch {
      location.href = href;
    }
  }
  window.__marginPrefetchChapter = prefetchSearchChapter;
  window.__marginSoftNav = softNavTo;
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
    const a = event.target?.closest?.("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    if (a.dataset.inboxLink != null || a.getAttribute("href") === "/notes") {
      // Warm SSR document: soft-nav. Cold or older than INBOX_HTML_MAX: the browser loads /notes.
      if (inboxHtmlFresh()) {
        event.preventDefault();
        softNavTo(a.href, { push: true });
      }
      return;
    }
    if (a.closest?.(".att-drop")) return;
    const slug = chapterSlugFromHref(a.href);
    if (!slug) return;
    // Soft-nav chapter hops (pager + chapter grid + inbox note-rows).
    if (a.closest?.(".pager, .chapter-grid") || a.hasAttribute("data-chapter-nav") || a.classList?.contains("note-row") || a.classList?.contains("note-bundle-name") || a.classList?.contains("note-bundle-open") || a.classList?.contains("note-bundle-verse")) {
      event.preventDefault();
      softNavTo(a.href, { push: true });
    }
  });

  // --- Chapter grid (Rails parity: title → chapters; book heading → books) ---
  const grid = document.querySelector("#chapter-grid");
  const gridTitle = document.querySelector("#chapter-grid-title");
  const gridHeading = document.querySelector("#chapter-grid-heading");
  const bookList = document.querySelector("#chapter-grid-books");
  const chapterCells = document.querySelector("#chapter-grid-chapters");
  let booksMeta = null;
  try { booksMeta = JSON.parse(document.querySelector("#books-meta")?.textContent || "null"); } catch {}
  let gridBook = (chapterSlug || "").split(".")[0]?.toUpperCase?.() || "";
  const currentBook = gridBook;
  const currentChapter = Number((chapterSlug || "").split(".")[1]) || 1;

  function chapterCellsHtml(book, count) {
    const total = Number(count) || 0;
    let html = "";
    for (let n = 1; n <= total; n += 1) {
      const current = book === currentBook && n === currentChapter;
      html += '<a href="/' + String(book).toLowerCase() + '.' + n + '" class="chapter-grid-cell' + (current ? ' is-current' : '') + '"' + (current ? ' aria-current="page"' : '') + ' data-chapter-nav>' + n + '</a>';
    }
    return html;
  }
  function setGridOpen(open) {
    if (!grid || !gridTitle) return;
    grid.hidden = !open;
    grid.classList.toggle("is-open", open);
    document.documentElement.classList.toggle("is-grid-open", open);
    gridTitle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function showBookPane() {
    if (bookList) bookList.hidden = false;
    if (chapterCells) chapterCells.hidden = true;
    if (gridHeading) {
      gridHeading.textContent = "Books";
      gridHeading.setAttribute("aria-expanded", "true");
    }
  }
  function showChapterPane(book) {
    gridBook = String(book || gridBook || currentBook).toUpperCase();
    if (bookList) bookList.hidden = true;
    if (chapterCells) {
      chapterCells.hidden = false;
      const count = booksMeta?.chapterCounts?.[gridBook] || Number(chapterCells.dataset.count) || 0;
      chapterCells.dataset.book = gridBook;
      chapterCells.innerHTML = chapterCellsHtml(gridBook, count || booksMeta?.chapterCounts?.[gridBook]);
    }
    if (gridHeading) {
      gridHeading.textContent = booksMeta?.names?.[gridBook] || gridBook;
      gridHeading.setAttribute("aria-expanded", "false");
    }
  }
  gridTitle?.addEventListener("click", () => {
    const next = Boolean(grid?.hidden);
    setGridOpen(next);
    if (next) showChapterPane(currentBook);
  });
  grid?.addEventListener("click", (event) => {
    if (event.target === grid) {
      setGridOpen(false);
      showChapterPane(currentBook);
    }
  });
  document.querySelector(".chapter-grid-sheet")?.addEventListener("click", (event) => event.stopPropagation());
  gridHeading?.addEventListener("click", () => {
    if (!bookList) return;
    if (!bookList.hidden) showChapterPane(gridBook || currentBook);
    else showBookPane();
  });
  bookList?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-book]");
    if (!btn) return;
    showChapterPane(btn.dataset.book);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && grid && !grid.hidden) {
      setGridOpen(false);
      showChapterPane(currentBook);
    }
  });

    // Prefetch inbox JSON/HTML so returning to /notes is instant.
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 120));
  idle(() => { prefetchInbox().catch(() => {}); });
  document.querySelectorAll("[data-inbox-link], a[href='/notes']").forEach((link) => {
    link.addEventListener("pointerenter", () => { prefetchInbox().catch(() => {}); }, { passive: true });
    link.addEventListener("pointerdown", () => { prefetchInbox().catch(() => {}); }, { passive: true });
    // Prefetch fills htmlCache. A warm click soft-navs that SSR document. Client list HTML stays unused.
  });
  window.addEventListener("popstate", () => {
    // Full document navigation so SSR notesListHtml paints Older chapter rows.
    if (location.pathname === "/notes") {
      location.replace("/notes");
      return;
    }
    if (inboxOpen) closeInbox();
  });
  // Seed inbox cache from chapter notes only when empty — never clobber a fuller library cache.
  // Include SSR timestamps so Older chapter bundling does not see Date(0) / client-now skew.
  if (!readInboxCache()?.notes?.length) {
    writeInboxCache(
      [...noteMap.values()]
        .filter((n) => Boolean(n.bookmarked) || (n.attachments || []).length || !isEmpty(n.blocks || []))
        .map((n) => ({
          slug: n.slug,
          label: n.label || slugLabel(n.slug),
          blocks: n.blocks,
          bookmarked: n.bookmarked,
          text: bodyText(n.blocks || []),
          updatedAt: n.updatedAt || "",
          createdAt: n.createdAt || "",
        })),
      chapterSlug,
    );
  } else {
    writeInboxCache(readInboxCache().notes, chapterSlug);
  }
  syncExpandBtn();
  syncVerseMarks();
})().catch((err) => console.error('reader client', err));`;
}
