import {
  hrefForXref,
  mergeParsedXrefs,
  normalizeAttachments,
  type Attachment,
  wikiTokens,
} from "./attachments";
import { escapeHtml, page, themeToggleHtml } from "./html";
import { bodyText, emptyBlocks, noteCoversVerse, type Block, type NoteDraft } from "./notes";
import {
  chapterSlug,
  nextChapter,
  parsePassage,
  passageLabel,
  passageSlug,
  prevChapter,
  routeBibleUrl,
  type Passage,
} from "./passage";
import { bookmarksViewHtml, notesInboxScript, phoneTabsHtml, starterChipsHtml, notesListHtml } from "./inbox-ui";
import { verseGroupsFromNotes, type VerseGroupView } from "./verse-groups";
import { verseGroupsScript, verseGroupsViewHtml, type VerseGroupTreatment } from "./verse-groups-ui";
import { jumpFormHtml, jumpScript } from "./jump-ui";
import { chapterGridHtml } from "./chapter-grid";
import { clientScript } from "./reader-client";
import type { ChapterPack } from "./usj";
export type NoteView = NoteDraft & { updatedAt?: string; createdAt?: string };

export function renderMissing(message: string, opts: { signedIn?: boolean } = {}): string {
  const signedIn = opts.signedIn ?? false;
  return page(
    "Margin",
    `<header class="topbar">
  <div class="topbar-side"><a class="icon-btn" href="/notes" aria-label="Notes" title="Notes">${iconNotes()}</a></div>
  <h1 class="topbar-title">Margin</h1>
  <div class="topbar-actions">${themeToggleHtml()}${authChip(signedIn, "/")}</div>
</header>
<main class="reader">
  ${jumpFormHtml()}
  <p class="empty">${escapeHtml(message)}</p>
</main>
<script>
${jumpScript()}
</script>`,
  );
}

export function renderChapterPage(input: {
  passage: Passage;
  pack: ChapterPack;
  notes: NoteView[];
  signedIn?: boolean;
  /** When true, SSR skips note bodies/markers; client hydrates via /api/notes?chapter=. */
  notesPending?: boolean;
  /** First paint already shows the chapter note. Used by /slug?chapter_note=1. */
  chapterNoteOpen?: boolean;
  /** ?xref=1 lands on the verse without opening it or painting selection chrome. */
  xrefArrival?: boolean;
}): string {
  const { passage, pack, notes, signedIn = false, notesPending = false, chapterNoteOpen = false, xrefArrival = false } = input;
  const chapSlug = chapterSlug(passage);

  // notesPending: embed [] so HTML/TTFB never waits on D1; client fills noteMap from /api/notes.
  const notesForRender = notesPending ? [] : notes;
  const notesPayload = notesForRender.map((note) => {
    const { list: attachments } = mergeParsedXrefs(note.attachments, note.blocks);
    return {
      slug: note.slug,
      kind: note.kind,
      verseStart: note.verseStart,
      verseEnd: note.verseEnd,
      blocks: note.blocks,
      bookmarked: Boolean(note.bookmarked),
      attachments,
      label: noteLabel(note.slug),
      updatedAt: note.updatedAt ?? "",
      createdAt: note.createdAt ?? "",
    };
  });
  const chapterNote = notesForRender.find((note) => note.slug === chapSlug);
  const chapterTitle = passageLabel({ ...passage, kind: "chapter", verseStart: null, verseEnd: null });
  // The page is the chapter. A verse address focuses a row; the header stays the chapter name.
  const title = chapterTitle;
  const focusStart = passage.verseStart;
  const bootOpen =
    passage.kind === "verse" && focusStart != null
      ? focusStart
      : passage.kind === "range" && (passage.verseEnd ?? focusStart) != null
        ? (passage.verseEnd ?? focusStart)
        : null;

  const previousChap = prevChapter(passage);
  const followingChap = nextChapter(passage);
  const adjacentUrls = [
    previousChap ? `/${passageSlug(previousChap)}` : null,
    followingChap ? `/${passageSlug(followingChap)}` : null,
  ].filter(Boolean) as string[];
  const prefetchLinks = adjacentUrls.map((href) => `<link rel="prefetch" href="${href}" as="document">`).join("\n");
  const speculateUrls = JSON.stringify(["/notes", "/api/notes", ...adjacentUrls]);
  // Only a chapter defers notes. A verse or range already embedded them, so do not preload the chapter API.
  const notesPreload = notesPending
    ? `<link rel="preload" href="/api/notes?chapter=${escapeHtml(chapSlug)}" as="fetch" crossorigin="use-credentials">\n`
    : "";
  const body = `${bootArrivalScrollScript(bootOpen)}${rememberLocationScript()}<link rel="prefetch" href="/notes" as="document">
<link rel="prefetch" href="/api/notes" as="fetch" crossorigin="use-credentials">
${notesPreload}${prefetchLinks}
<script type="speculationrules">{"prefetch":[{"urls":${speculateUrls},"eagerness":"eager"}]}</script>
<div id="reader" data-chapter-slug="${escapeHtml(chapSlug)}" data-passage-slug="${escapeHtml(passageSlug(passage))}" data-boot-verse="${bootOpen ?? ""}" data-notes-pending="${notesPending ? "1" : "0"}">
<header class="topbar">
  <div class="topbar-side">
    <a class="icon-btn" href="/notes" data-inbox-link aria-label="Notes" title="Notes">${iconNotes()}</a>
  </div>
  <h1 class="topbar-title">
    <button type="button" class="icon-btn${chapterNote?.bookmarked ? " is-on" : ""} topbar-chapter-mark" id="chapter-bookmark-btn" data-state-icon="bookmark" data-state-on="${chapterNote?.bookmarked ? "true" : "false"}" aria-label="Bookmark chapter" title="Bookmark chapter" aria-pressed="${chapterNote?.bookmarked ? "true" : "false"}">${iconBookmark()}</button>
    <button type="button" class="topbar-title-btn" id="chapter-grid-title" aria-haspopup="dialog" aria-expanded="false" aria-controls="chapter-grid" title="Choose book or chapter">${escapeHtml(title)}</button>
  </h1>
  <div class="topbar-actions">
    ${themeToggleHtml()}
    ${authChip(signedIn, `/${passageSlug(passage)}`)}
    <button type="button" class="expand-btn icon-btn" id="expand-all-btn" aria-label="Expand notes" title="Expand notes" aria-pressed="false" ${notesForRender.some((n) => n.kind !== "chapter" && (n.bookmarked || (n.attachments?.length ?? 0) > 0 || !emptyBlocks(n.blocks))) ? "" : "disabled"}>${iconExpand()}</button>
  </div>
</header>
${chapterGridHtml(passage.book, passage.chapter)}
<main class="reader">
  ${jumpFormHtml()}
  <p class="hint" id="reader-hint">Tap a verse to open its outliner; tap again to close. Enter splits / next node · Shift+Enter newline · Tab or two spaces indent · Clear deletes. Refs like John 3:16 become wiki chips on blur. ${signedIn ? "Signed in — this browser has a session, and the passphrase opens the same notes elsewhere." : "Guest notes stay in this browser until you sign in with a passphrase."}</p>
  <div class="chapter-note-rail${chapterNoteOpen ? " is-open" : ""}" id="chapter-note-rail" data-has-note="${chapterNote ? "true" : "false"}">
    <button type="button" class="chapter-note-peek" id="chapter-note-peek" aria-expanded="${chapterNoteOpen ? "true" : "false"}" aria-controls="chapter-tray" aria-label="${chapterNoteOpen ? "Close chapter note" : "Open chapter note"}" title="${chapterNoteOpen ? "Close chapter note" : "Chapter note"}">
      <span class="chapter-note-peek-bar" aria-hidden="true"></span>
    </button>
    <section class="chapter-tray" id="chapter-tray" data-slug="${escapeHtml(chapSlug)}"${chapterNoteOpen ? "" : " hidden"}>
      ${renderTrayShell({
        slug: chapSlug,
        label: `Chapter note · ${chapterTitle}`,
        blocks: chapterNote?.blocks ?? [blankBlock()],
        bookmarked: Boolean(chapterNote?.bookmarked),
        attachments: mergeParsedXrefs(chapterNote?.attachments ?? [], chapterNote?.blocks ?? []).list,
        route: routeBibleUrl({ ...passage, kind: "chapter", verseStart: null, verseEnd: null }),
        closable: true,
      })}
    </section>
  </div>
  <article class="chapter" id="chapter">
    ${renderVerses(passage, pack, notesForRender, xrefArrival)}
  </article>
  ${pager(passage)}
  ${renderVerseRail(passage, pack)}
</main>
${phoneTabsHtml({ surface: "scripture", readerHref: `/${passageSlug(passage)}` })}
<dialog class="att-drop" id="att-drop">
  <form method="dialog" class="att-drop-sheet" id="att-drop-form">
    <button type="button" class="att-drop-close" id="att-drop-close" aria-label="Close">${iconClose()}</button>
    <div class="att-drop-zone" id="att-drop-zone">
      <p class="att-drop-check" id="att-drop-check" hidden>✓</p>
      <p class="att-drop-title" id="att-drop-title">Drop a link. Or a passage.</p>
      <p class="att-drop-sub" id="att-drop-sub">Paste a URL, or type John 3:16. It stays on this note as a chip — not mixed into the outline.</p>
      <label class="sr-only" for="att-drop-input">Link or passage</label>
      <div class="att-drop-field">
        <input
          id="att-drop-input"
          class="att-drop-input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="https://…  or  Romans 8:28"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="false"
          aria-controls="att-drop-suggest"
        >
        <ul id="att-drop-suggest" class="suggest" role="listbox" hidden></ul>
      </div>
      <button type="button" class="att-drop-add" id="att-drop-add">Attach</button>
    </div>
    <p class="att-drop-status" id="att-drop-status" role="status" aria-live="polite"></p>
  </form>
</dialog>
</div>
${bootArrivalScrollScript(bootOpen)}
<script id="notes-data" type="application/json">${JSON.stringify(notesPayload).replace(/</g, "\\u003c")}</script>
<script>
${clientScript()}
</script>
<script>
${jumpScript()}
</script>`;

  return page(`${title} · Margin`, body);
}

export function renderNotesIndex(
  notes: NoteView[],
  backSlug: string,
  opts: { signedIn?: boolean; verseGroups?: VerseGroupView[]; verseGroupTreatment?: VerseGroupTreatment; verseGroupsOpen?: boolean } = {},
): string {
  const signedIn = opts.signedIn ?? false;
  const verseGroups = opts.verseGroups ?? verseGroupsFromNotes(notes);
  const treatment = opts.verseGroupTreatment ?? "set";
  const mirror = notes.map((note) => ({
    slug: note.slug,
    label: noteLabel(note.slug),
    excerpt: bodyText(note.blocks).replace(/\s+/g, " ").trim(),
    bookmarked: Boolean(note.bookmarked),
    updatedAt: note.updatedAt ?? "",
    createdAt: note.createdAt ?? "",
  }));
  const items = notesListHtml(mirror);

  // Seed chapter grid from last-read (reader back) so Notes title opens the same picker as chapter pages.
  const seed = parsePassage(backSlug) || parsePassage("jhn.1")!;
  const gridBook = seed.book;
  const gridChapter = seed.chapter;

  // Inbox keeps the reader jump bar plus starter chapters so an empty library is not a dead end.
  // Notes title is a book/chapter picker (Rails/CF chapter-grid parity); soft-nav to the chosen chapter.
  return page(
    "Notes · Margin",
    `<header class="topbar topbar-notes">
  <div class="topbar-side"><a class="icon-btn" href="/${escapeHtml(backSlug)}" data-reader-link aria-label="Reader" title="Reader">${iconReader()}</a></div>
  <h1 class="topbar-title">
    <button type="button" class="topbar-title-btn" id="chapter-grid-title" aria-haspopup="dialog" aria-expanded="false" aria-controls="chapter-grid" title="Choose book or chapter">Notes</button>
  </h1>
  <div class="topbar-actions">${themeToggleHtml()}${authChip(signedIn, "/notes")}</div>
</header>
${chapterGridHtml(gridBook, gridChapter)}
<main class="notes-main reader">
  ${jumpFormHtml()}
  ${starterChipsHtml()}
  ${bookmarksViewHtml(mirror)}
  ${verseGroupsViewHtml(verseGroups, { treatment, open: opts.verseGroupsOpen })}
  <div id="notes-mount">${items}</div>
</main>
${phoneTabsHtml({ surface: "notes", readerHref: `/${escapeHtml(backSlug)}`, groupsHref: `/notes?vg=${treatment}#groups` })}
<script type="application/json" id="inbox-pack-mirror">${JSON.stringify(mirror).replace(/</g, "\\u003c")}</script>
${restoreReaderLinkScript()}
<script>
${jumpScript()}
</script>
<script>
${notesInboxScript()}
</script>
<script>
${verseGroupsScript()}
</script>`,
  );
}

const VERSE_RAIL_DOTS = 28;

/**
 * Chapter navigations start at the top. Soft-nav keeps the previous scroll,
 * and the browser restores a saved offset, so the new document pins the top
 * unless the address names a verse.
 * Emitted twice: once before the chapter (so a chapter hop does not paint
 * mid-page) and once after the verses exist (so a verse address can measure).
 */
/** Record the open passage, including verse replaces that never reload the document. */
function rememberLocationScript(): string {
  return `<script>
(function () {
  function remember() {
    try {
      var path = location.pathname.replace(/^\\/+/, "");
      if (!/^[a-z0-9]+\\.\\d+/i.test(path)) return;
      sessionStorage.setItem("margin_last_read", path.toLowerCase());
    } catch (err) {}
  }
  remember();
  if (history.__marginRemember) return;
  history.__marginRemember = 1;
  var push = history.pushState;
  var replace = history.replaceState;
  history.pushState = function () {
    var result = push.apply(this, arguments);
    remember();
    return result;
  };
  history.replaceState = function () {
    var result = replace.apply(this, arguments);
    remember();
    return result;
  };
})();
</script>`;
}

/** Notes → reader uses the passage this tab last opened, ahead of a prefetched inbox document. */
function restoreReaderLinkScript(): string {
  return `<script>
(function () {
  try {
    var slug = sessionStorage.getItem("margin_last_read") || "";
    if (!/^[a-z0-9]+\\.\\d+/i.test(slug)) return;
    var links = document.querySelectorAll("[data-reader-link]");
    for (var i = 0; i < links.length; i++) links[i].setAttribute("href", "/" + slug.toLowerCase());
  } catch (err) {}
})();
</script>`;
}

function bootArrivalScrollScript(bootVerse: number | null): string {
  const pinned = bootVerse != null ? `document.getElementById("v${bootVerse}")` : "null";
  return `<script>
(function () {
  function placeArrival() {
    if (history.scrollRestoration) history.scrollRestoration = "manual";
    var path = location.pathname.replace(/^\\/+/, "");
    var named = /^[a-z0-9]+\\.\\d+\\.(\\d+)(?:-(\\d+))?/i.exec(path);
    var el = ${pinned};
    if (!el && named) el = document.getElementById("v" + (named[2] || named[1]));
    if (el) {
      var press = el.querySelector(".verse-press") || el;
      var rect = press.getBoundingClientRect();
      var target = (window.scrollY || 0) + rect.top + rect.height / 2 - (window.innerHeight || 0) / 2;
      if (target < 0) target = 0;
      window.scrollTo(0, target);
      document.documentElement.dataset.placedScroll = String(Math.round(target));
      return;
    }
    // Verse address, verses not in the document yet. Do not pin the top.
    if (named) return;
    window.scrollTo(0, 0);
    // Restoration can land after this script. Pin again on the next frame.
    requestAnimationFrame(function () {
      var later = location.pathname.replace(/^\\/+/, "");
      if (/^[a-z0-9]+\\.\\d+\\.\\d+/i.test(later)) return;
      window.scrollTo(0, 0);
    });
  }
  placeArrival();
  window.addEventListener("pageshow", placeArrival);
})();
</script>`;
}

/** Right-edge scrubber. Hidden on short chapters, same cutoff as route.bible. */
function renderVerseRail(passage: Passage, pack: ChapterPack): string {
  const count = pack.verses.length;
  if (count < 8) return "";
  const focus = passage.verseStart;
  const found = focus == null ? 0 : pack.verses.findIndex((verse) => verse.v === focus);
  const valueNow = (found < 0 ? 0 : found) + 1;
  const dots = Array.from({ length: VERSE_RAIL_DOTS }, (_, index) =>
    `<span class="reader-verse-rail-dot" data-reader-rail-dot-index="${index}"></span>`,
  ).join("");
  return `<div class="reader-verse-rail" data-reader-rail="true" role="slider" tabindex="0" aria-label="Jump to verse" aria-valuemin="1" aria-valuemax="${count}" aria-valuenow="${valueNow}"><div class="reader-verse-rail-checkpoints" aria-hidden="true">${dots}</div></div><div class="reader-verse-modal" data-reader-rail-preview="true" hidden></div>`;
}

function renderVerses(passage: Passage, pack: ChapterPack, notes: NoteView[], xrefArrival = false): string {
  const start = passage.verseStart;
  const end = passage.verseEnd ?? passage.verseStart;
  const book = passage.book.toLowerCase();
  const rangeSlug = passage.kind === "range" ? passageSlug(passage) : null;
  const rangeNote = rangeSlug ? notes.find((note) => note.slug === rangeSlug) : undefined;
  let html = "";
  for (const verse of pack.verses) {
    if (verse.heading) html += `<h2 class="section-head">${escapeHtml(verse.heading)}</h2>`;
    const focused = start != null && end != null && verse.v >= start && verse.v <= end;
    const vslug = `${book}.${passage.chapter}.${verse.v}`;
    const exact = notes.find((note) => note.slug === vslug);
    const coveringHere = notes.filter(
      (note) =>
        note.kind !== "chapter" &&
        note.slug !== vslug &&
        note.slug !== rangeSlug &&
        noteTrayVerse(note) === verse.v &&
        noteCoversVerse(note, verse.v),
    );
    const marked =
      Boolean(exact) ||
      notes.some((note) => note.kind !== "chapter" && note.slug !== vslug && noteCoversVerse(note, verse.v));
    const openVerse = !xrefArrival && passage.kind === "verse" && focused;
    const openRangeEnd = !xrefArrival && passage.kind === "range" && verse.v === end;
    const open = openVerse || (!xrefArrival && passage.kind === "range" && focused);
    // Rails is-span: contiguous selection rail across the focused range (3–5). The range note sits under the last verse.
    const span = !xrefArrival && passage.kind === "range" && focused;
    const classes = ["verse", open ? "is-open" : "", span ? "is-span" : "", marked ? "has-note" : ""].filter(Boolean).join(" ");
    html += `<div class="${classes}" id="v${verse.v}" data-verse="${verse.v}" data-slug="${escapeHtml(vslug)}">`;
    const railSlug = rangeRailSlug(verse.v, passage, notes);
    if (railSlug) {
      html += `<button type="button" class="verse-range-rail" data-range-slug="${escapeHtml(railSlug)}" aria-label="Note for ${escapeHtml(noteLabel(railSlug))}"></button>`;
    }
    html += `<button type="button" class="verse-press" data-verse="${verse.v}" aria-label="Verse ${verse.v}">`;
    html += `<span class="vnum">${verse.v}</span><span class="vtext">${escapeHtml(verse.text)}</span>`;
    html += `</button>`;

    for (const note of coveringHere) {
      const rangeTray = note.kind === "range" ? ' data-range-composer="1"' : "";
      html += `<div class="note-tray" data-slug="${escapeHtml(note.slug)}"${rangeTray} data-covering="1" hidden>
        ${renderTrayShell({
          slug: note.slug,
          label: noteLabel(note.slug),
          blocks: note.blocks,
          bookmarked: Boolean(note.bookmarked),
          attachments: mergeParsedXrefs(note.attachments, note.blocks).list,
          route: `https://route.bible/${note.slug}`,
          closable: false,
        })}
      </div>`;
    }

    if (rangeSlug && verse.v === end) {
      html += `<div class="note-tray" data-slug="${escapeHtml(rangeSlug)}" data-range-composer="1" ${openRangeEnd ? "" : "hidden"}>
        ${renderTrayShell({
          slug: rangeSlug,
          label: passageLabel(passage),
          blocks: rangeNote?.blocks ?? [blankBlock()],
          bookmarked: Boolean(rangeNote?.bookmarked),
          attachments: mergeParsedXrefs(rangeNote?.attachments ?? [], rangeNote?.blocks ?? []).list,
          route: routeBibleUrl(passage),
          closable: false,
        })}
      </div>`;
    }

    html += `<div class="note-tray" data-slug="${escapeHtml(vslug)}" data-verse-composer="1" ${openVerse ? "" : "hidden"}>
      ${renderTrayShell({
        slug: vslug,
        label: noteLabel(vslug),
        blocks: exact?.blocks ?? [blankBlock()],
        bookmarked: Boolean(exact?.bookmarked),
        attachments: mergeParsedXrefs(exact?.attachments ?? [], exact?.blocks ?? []).list,
        route: `https://route.bible/${vslug}`,
        closable: false,
      })}
    </div>`;

    html += `</div>`;
  }
  return html;
}

function renderTrayShell(input: {
  slug: string;
  label: string;
  blocks: Block[];
  bookmarked?: boolean;
  attachments?: Attachment[];
  route: string;
  closable?: boolean;
}): string {
  const blocks = input.blocks.length ? input.blocks : [blankBlock()];
  const attachments = normalizeAttachments(input.attachments ?? []);
  const rows = blocks
    .map((block) => {
      const bullet = block.bullet !== false;
      return `<div class="oblock${bullet ? " is-bullet" : ""}" data-block-id="${escapeHtml(block.id)}" data-bullet="${bullet ? "1" : "0"}" style="--depth: ${Math.max(0, block.indent | 0)}">
        <span class="obullet" aria-hidden="true" title="${bullet ? "Remove bullet" : "Add bullet"}"></span>
        <div class="otext" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true">${decorateBlockHtml(block.text)}</div>
      </div>`;
    })
    .join("");
  const chips = attachments.map((att) => attachmentChipHtml(att)).join("");
  const bookmarked = Boolean(input.bookmarked);
  return `<div class="outliner" data-slug="${escapeHtml(input.slug)}" data-empty-id="b_empty">
  ${rows}
</div>
<ul class="att-board" ${attachments.length ? "" : "hidden"}>${chips}</ul>
<div class="tray-head">
  <div class="tray-toolbar">
    <span class="tray-meta">
      <a class="tray-label" href="${escapeHtml(input.route)}" target="_blank" rel="noreferrer">${escapeHtml(input.label)}</a>
      <span class="tray-status" data-status-for="${escapeHtml(input.slug)}" role="status"></span>
    </span>
    <span class="tray-actions">
      <button type="button" class="tray-attach" data-attach aria-label="Attach a link or passage" title="Attach">${iconPaperclip()}</button>
      <button type="button" class="tray-bookmark${bookmarked ? " is-on" : ""}" data-state-icon="bookmark" data-state-on="${bookmarked ? "true" : "false"}" data-bookmark aria-pressed="${bookmarked ? "true" : "false"}" aria-label="Bookmark note" title="Bookmark">${iconBookmark()}</button>
      <button type="button" class="tray-clear" data-clear="${escapeHtml(input.slug)}" aria-label="Clear note" title="Clear note">${iconTrash()}</button>
      ${
        input.closable
          ? `<button type="button" class="tray-close" data-close-tray aria-label="Close note" title="Close note">${iconClose()}</button>`
          : ""
      }
    </span>
  </div>
</div>`;
}

function decorateBlockHtml(text: string): string {
  return wikiTokens(text)
    .map((token) => {
      if (token.type === "wiki" && token.href) {
        return `<a href="${escapeHtml(token.href)}" class="wiki" data-wiki-raw="${escapeHtml(token.raw)}" contenteditable="false">${escapeHtml(token.label)}</a>`;
      }
      return escapeHtml(token.type === "wiki" ? token.raw : token.value);
    })
    .join("");
}

function attachmentChipHtml(att: Attachment): string {
  const title = escapeHtml(att.title);
  const id = escapeHtml(att.id);
  const sourceName = att.source === "scan" || att.source === "backlink" ? att.source : "manual";
  const source = ` data-att-source="${escapeHtml(sourceName)}"`;
  if (att.kind === "xref") {
    return `<li class="att-item"><a class="att-chip wiki" href="${escapeHtml(hrefForXref(att.slug))}" data-att-id="${id}" data-att-kind="xref" data-att-slug="${escapeHtml(att.slug)}" data-att-title="${title}"${source}>${title}</a><button type="button" class="att-remove" data-att-id="${id}" aria-label="Remove attachment" title="Remove attachment">${iconCloseTiny()}</button></li>`;
  }
  return `<li class="att-item"><a class="att-chip att-url" href="${escapeHtml(att.url)}" target="_blank" rel="noreferrer" data-att-id="${id}" data-att-kind="url" data-att-url="${escapeHtml(att.url)}" data-att-title="${title}"${source}>${title}</a><button type="button" class="att-remove" data-att-id="${id}" aria-label="Remove attachment" title="Remove attachment">${iconCloseTiny()}</button></li>`;
}

function blankBlock(): Block {
  return { id: "b_empty", indent: 0, text: "", bullet: true };
}

function noteLabel(slug: string): string {
  const passage = parsePassage(slug);
  return passage ? passageLabel(passage) : slug;
}

/** A range note lives under its last verse. A verse note lives under that verse. */
function noteTrayVerse(note: NoteView): number | null {
  if (note.verseStart == null) return null;
  if (note.kind === "range") return note.verseEnd ?? note.verseStart;
  return note.verseStart;
}

/** Narrowest range that draws a left border on this verse. The open passage range counts even when empty. */
function rangeRailSlug(verseNum: number, passage: Passage, notes: NoteView[]): string | null {
  const candidates: { slug: string; width: number }[] = [];
  if (
    passage.kind === "range" &&
    passage.verseStart != null &&
    passage.verseEnd != null &&
    verseNum >= passage.verseStart &&
    verseNum <= passage.verseEnd
  ) {
    candidates.push({ slug: passageSlug(passage), width: passage.verseEnd - passage.verseStart });
  }
  for (const note of notes) {
    if (note.kind !== "range" || note.verseStart == null) continue;
    const end = note.verseEnd ?? note.verseStart;
    if (end <= note.verseStart || verseNum < note.verseStart || verseNum > end) continue;
    const marked = !emptyBlocks(note.blocks) || note.bookmarked || (note.attachments?.length ?? 0) > 0;
    if (!marked && !candidates.some((row) => row.slug === note.slug)) continue;
    if (candidates.some((row) => row.slug === note.slug)) continue;
    candidates.push({ slug: note.slug, width: end - note.verseStart });
  }
  candidates.sort((a, b) => a.width - b.width);
  return candidates[0]?.slug ?? null;
}

function pager(passage: Passage): string {
  const previous = prevChapter(passage);
  const following = nextChapter(passage);
  const prevLink = previous
    ? `<a href="/${passageSlug(previous)}">← ${escapeHtml(passageLabel(previous))}</a>`
    : "<span></span>";
  const nextLink = following
    ? `<a href="/${passageSlug(following)}">${escapeHtml(passageLabel(following))} →</a>`
    : "<span></span>";
  return `<nav class="pager">${prevLink}${nextLink}</nav>`;
}

function authChip(signedIn: boolean, next: string): string {
  const href = `/login?next=${encodeURIComponent(next)}`;
  if (signedIn) {
    return `<a class="auth-chip is-in icon-btn" href="${escapeHtml(href)}" aria-label="Profile" title="Profile">${iconUser()}</a>`;
  }
  return `<a class="auth-chip icon-btn" href="${escapeHtml(href)}" aria-label="Sign in" title="Sign in">${iconUser()}</a>`;
}

function phIcon(name: string, size = 18, className = "", weight: "regular" | "fill" = "regular"): string {
  const paths: Record<string, string> = {
    user: "M230.92 212c-15.23-26.33-38.7-45.21-66.09-54.16a72 72 0 1 0-73.66 0c-27.39 8.94-50.86 27.82-66.09 54.16a8 8 0 1 0 13.85 8c18.84-32.56 52.14-52 89.07-52s70.23 19.44 89.07 52a8 8 0 1 0 13.85-8M72 96a56 56 0 1 1 56 56a56.06 56.06 0 0 1-56-56",
    check: "M229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32",
    notebook: "M184 112a8 8 0 0 1-8 8h-64a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8m-8 24h-64a8 8 0 0 0 0 16h64a8 8 0 0 0 0-16m48-88v160a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16h160a16 16 0 0 1 16 16M48 208h24V48H48Zm160 0V48H88v160z",
    "arrows-out": "M216 48v48a8 8 0 0 1-16 0V67.31l-42.34 42.35a8 8 0 0 1-11.32-11.32L188.69 56H160a8 8 0 0 1 0-16h48a8 8 0 0 1 8 8M98.34 146.34L56 188.69V160a8 8 0 0 0-16 0v48a8 8 0 0 0 8 8h48a8 8 0 0 0 0-16H67.31l42.35-42.34a8 8 0 0 0-11.32-11.32M208 152a8 8 0 0 0-8 8v28.69l-42.34-42.35a8 8 0 0 0-11.32 11.32L188.69 200H160a8 8 0 0 0 0 16h48a8 8 0 0 0 8-8v-48a8 8 0 0 0-8-8M67.31 56H96a8 8 0 0 0 0-16H48a8 8 0 0 0-8 8v48a8 8 0 0 0 16 0V67.31l42.34 42.35a8 8 0 0 0 11.32-11.32Z",
    "corners-in": "M152 96V48a8 8 0 0 1 16 0V88h40a8 8 0 0 1 0 16H160A8 8 0 0 1 152 96ZM96 152H48a8 8 0 0 0 0 16H88v40a8 8 0 0 0 16 0V160A8 8 0 0 0 96 152Zm112 0H160a8 8 0 0 0-8 8v48a8 8 0 0 0 16 0V168h40a8 8 0 0 0 0-16ZM96 40a8 8 0 0 0-8 8V88H48a8 8 0 0 0 0 16H96a8 8 0 0 0 8-8V48A8 8 0 0 0 96 40Z",
    "bookmark-simple": "M184 32H72a16 16 0 0 0-16 16v176a8 8 0 0 0 12.24 6.78L128 193.43l59.77 37.35A8 8 0 0 0 200 224V48a16 16 0 0 0-16-16m0 177.57l-51.77-32.35a8 8 0 0 0-8.48 0L72 209.57V48h112Z",
    "bookmark-simple-fill": "M184 32H72A16 16 0 0 0 56 48V224a8 8 0 0 0 12.24 6.78L128 193.43l59.77 37.35A8 8 0 0 0 200 224V48A16 16 0 0 0 184 32Z",
    "note-pencil": "m229.66 58.34l-32-32a8 8 0 0 0-11.32 0l-96 96A8 8 0 0 0 88 128v32a8 8 0 0 0 8 8h32a8 8 0 0 0 5.66-2.34l96-96a8 8 0 0 0 0-11.32M124.69 152H104v-20.69l64-64L188.69 88ZM200 76.69L179.31 56L192 43.31L212.69 64ZM224 128v80a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16h80a8 8 0 0 1 0 16H48v160h160v-80a8 8 0 0 1 16 0",
    "note-pencil-fill": "M224 128v80a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16V48A16 16 0 0 1 48 32h80a8 8 0 0 1 0 16H48v160H208V128a8 8 0 0 1 16 0Zm5.66-58.34-96 96A8 8 0 0 1 128 168H96a8 8 0 0 1-8-8V128a8 8 0 0 1 2.34-5.66l96-96a8 8 0 0 1 11.32 0l32 32A8 8 0 0 1 229.66 69.66Zm-17-5.66L192 43.31 179.31 56 200 76.69Z",
    book: "M208 24H72a32 32 0 0 0-32 32v168a8 8 0 0 0 8 8h144a8 8 0 0 0 0-16H56a16 16 0 0 1 16-16h136a8 8 0 0 0 8-8V32a8 8 0 0 0-8-8m-8 160H72a31.8 31.8 0 0 0-16 4.29V56a16 16 0 0 1 16-16h128Z",
    trash: "M216 48H176V40a24 24 0 0 0-24-24H104A24 24 0 0 0 80 40v8H40a8 8 0 0 0 0 16h8V208a16 16 0 0 0 16 16H192a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16ZM96 40a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8v8H96Zm96 168H64V64H192ZM112 104v64a8 8 0 0 1-16 0V104a8 8 0 0 1 16 0Zm48 0v64a8 8 0 0 1-16 0V104a8 8 0 0 1 16 0Z",
    x: "M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31 61.66 205.66a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66A8 8 0 0 1 61.66 50.34L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z",
    paperclip: "M209.66 122.34a8 8 0 0 1 0 11.32l-82.05 82a56 56 0 0 1-79.2-79.2l83.28-83.28a40 40 0 0 1 56.56 56.56L105.37 192.63a24 24 0 1 1-33.94-33.94l83.28-83.28a8 8 0 1 1 11.32 11.32L82.75 170a8 8 0 1 0 11.31 11.32l82.88-82.88a24 24 0 0 0-33.94-33.94L59.72 148.79a40 40 0 0 0 56.56 56.56l82.05-82a8 8 0 0 1 11.32 0Z",
  };
  const iconName = weight === "fill" ? `${name}-fill` : name;
  const d = paths[iconName];
  if (!d) return "";
  const cls = className ? ` class="${className}"` : "";
  const weightAttr = weight === "fill" ? ` data-phosphor-weight="fill"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"${weightAttr}${cls}><path d="${d}"/></svg>`;
}

function iconNotes(): string {
  return phIcon("notebook", 18);
}
function iconExpand(): string {
  // Stack both glyphs; CSS crossfades on .expand-btn.is-on (collapsed=arrows-out, expanded=corners-in).
  return `<span class="expand-icon">${phIcon("arrows-out", 18, "expand-icon-out")}${phIcon("corners-in", 18, "expand-icon-in")}</span>`;
}
function iconState(name: string): string {
  const outline = phIcon(name, 18);
  const filled = phIcon(name, 18, "", "fill");
  const outlinePath = outline.match(/<path d="[^"]*"\/>/)?.[0]?.replace("<path ", '<path class="state-icon-outline" ');
  const filledPath = filled.match(/<path d="[^"]*"\/>/)?.[0]?.replace("<path ", '<path class="state-icon-filled" data-phosphor-weight="fill" ');
  if (!outlinePath || !filledPath) return outline;
  const open = outline.slice(0, outline.indexOf("<path"));
  return `${open}${outlinePath}${filledPath}</svg>`;
}
function iconReader(): string {
  return phIcon("book", 18);
}
function iconTrash(): string {
  return phIcon("trash", 18);
}
function iconClose(): string {
  return phIcon("x", 18);
}
function iconCloseTiny(): string {
  return phIcon("x", 12);
}
function iconBookmark(): string {
  return iconState("bookmark-simple");
}
function iconPaperclip(): string {
  // Phosphor paperclip, regular weight (Rails ph_icon parity).
  return phIcon("paperclip", 18);
}
function iconUser(): string {
  return phIcon("user", 18);
}
