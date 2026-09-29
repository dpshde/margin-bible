import { bookName } from "./books";
import { escapeHtml, page } from "./html";
import { bodyText, type NoteDraft } from "./notes";
import {
  nextChapter,
  parsePassage,
  passageLabel,
  passageSlug,
  prevChapter,
  type Passage,
} from "./passage";
import { readerClientSource } from "./reader-client";
import type { ChapterPack } from "./usj";

export type NoteView = NoteDraft & { updatedAt?: string };

export function renderMissing(message: string): string {
  return page(
    "Margin spike",
    `<header class="top"><h1>Margin</h1><a href="/notes">Notes</a></header>
<main>
  ${jumpForm()}
  <p class="empty">${escapeHtml(message)}</p>
</main>`,
  );
}

export function renderChapterPage(input: { passage: Passage; pack: ChapterPack; notes: NoteView[] }): string {
  const { passage, pack, notes } = input;
  const title = passageLabel(passage);
  const chapterPassage = { ...passage, verseStart: null, verseEnd: null, kind: "chapter" as const };
  const boot = {
    book: pack.book,
    bookName: bookName(pack.book) ?? pack.book,
    chapter: pack.chapter,
    chapterSlug: passageSlug(chapterPassage),
    chapterLabel: passageLabel(chapterPassage),
    verseStart: passage.verseStart,
    verseEnd: passage.verseEnd,
    notes: notes.map((note) => ({
      slug: note.slug,
      label: parsePassage(note.slug) ? passageLabel(parsePassage(note.slug)!) : note.slug,
      kind: note.kind,
      verseStart: note.verseStart,
      verseEnd: note.verseEnd,
      blocks: note.blocks,
    })),
  };

  const body = `<header class="topbar">
  <a class="notes-link" href="/notes">Notes</a>
  <h1 id="title">${escapeHtml(title)}</h1>
  <span class="top-spacer"></span>
</header>
<p id="range-hint" class="range-hint" hidden>Tap the last verse of the range.</p>
<main class="reader">
  <div id="chapter-slot"></div>
  <article class="chapter" id="chapter">${renderVerses(passage, pack)}</article>
  ${pager(passage)}
</main>
<div class="chrome">
  <form class="jump" action="/jump" method="get">
    <label class="sr-only" for="q">Jump</label>
    <input id="q" name="q" type="search" placeholder="John 3:16" autocomplete="off" spellcheck="false" enterkeyhint="go">
    <button type="button" class="dock-toggle" aria-label="Reader actions" aria-expanded="true">···</button>
  </form>
  <div class="dock" id="dock">
    <button type="button" data-action="quiet" aria-pressed="false">Focus</button>
    <button type="button" data-action="chapter" aria-pressed="false">Chapter note</button>
    <button type="button" data-action="expand" aria-pressed="false">Expand notes</button>
    <p id="save-status" class="status" role="status"></p>
  </div>
</div>
<script type="application/json" id="reader-boot">${jsonForScript(boot)}</script>
<script>
${readerClientSource()}
document.querySelector(".dock-toggle")?.addEventListener("click", () => {
  const dock = document.getElementById("dock");
  const toggle = document.querySelector(".dock-toggle");
  if (!dock || !toggle) return;
  const open = dock.hidden;
  dock.hidden = !open;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
});
</script>`;

  return readerDocument(`${title} · Margin`, body);
}

export function renderNotesIndex(notes: NoteView[], backSlug: string): string {
  const items =
    notes.length === 0
      ? `<p class="empty">This library has no notes yet. Open a chapter and type.</p>`
      : `<ul class="note-list">${notes
          .map((note) => {
            const excerpt = bodyText(note.blocks).replace(/\s+/g, " ").trim();
            return `<li><a href="/${escapeHtml(note.slug)}">${escapeHtml(noteLabel(note.slug))}</a><p>${escapeHtml(excerpt)}</p></li>`;
          })
          .join("")}</ul>`;

  return page(
    "Notes · Margin spike",
    `<header class="top"><h1>Notes</h1><a href="/${escapeHtml(backSlug)}">Reader</a></header>
<main>
  ${jumpForm()}
  ${items}
</main>`,
  );
}

function renderVerses(passage: Passage, pack: ChapterPack): string {
  const start = passage.verseStart;
  const end = passage.verseEnd ?? passage.verseStart;
  let html = "";
  for (const verse of pack.verses) {
    if (verse.heading) html += `<h2 class="section-head">${escapeHtml(verse.heading)}</h2>`;
    const open = start != null && end != null && (start === end ? verse.v === start : verse.v === end);
    const spanned = start != null && end != null && verse.v >= start && verse.v <= end;
    const classes = ["verse", open ? "is-open" : "", spanned ? "is-span" : ""].filter(Boolean).join(" ");
    html += `<div class="${classes}" id="v${verse.v}" data-verse="${verse.v}">
      <button type="button" class="verse-press" data-verse="${verse.v}">
        <span class="vnum">${verse.v}</span>
        <span class="vtext">${escapeHtml(verse.text)}</span>
      </button>
      <div class="trays"></div>
    </div>`;
  }
  return html;
}

function noteLabel(slug: string): string {
  const passage = parsePassage(slug);
  return passage ? passageLabel(passage) : slug;
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

function jumpForm(): string {
  return `<form class="jump" action="/jump" method="get">
    <label for="q" class="sr-only">Jump</label>
    <input id="q" name="q" placeholder="John 3:16" autocomplete="off" spellcheck="false">
    <button type="submit">Open</button>
  </form>`;
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function readerDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='2' fill='%231c1917'/%3E%3Cpath d='M4 4.5h8M4 8h8M4 11.5h5' stroke='%23f6f5f2' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,700&family=Poppins:wght@400;500;600&family=Lexend:wght@500;600;700&display=swap" rel="stylesheet">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #f6f5f2;
      --paper-raised: #ffffff;
      --ink: #1c1917;
      --ink-soft: #44403c;
      --muted: #78716c;
      --faint: #a8a29e;
      --line: color-mix(in srgb, var(--ink) 12%, transparent);
      --read: "Source Serif 4", "Iowan Old Style", Palatino, Georgia, serif;
      --sans: "Poppins", system-ui, sans-serif;
      --head: "Lexend", system-ui, sans-serif;
      --verse-gutter: 1.7rem;
      --verse-gap: 0.7rem;
      --verse-inset: 0.55rem;
      --sel-rail: color-mix(in srgb, var(--ink) 18%, transparent);
      --sel-rail-open: color-mix(in srgb, var(--ink) 42%, transparent);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); }
    body { min-height: 100dvh; }
    a { color: inherit; }
    button, input { font: inherit; color: inherit; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
    .topbar {
      position: sticky; top: 0; z-index: 5;
      display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
      padding: 0.55rem 1rem;
      background: color-mix(in srgb, var(--paper) 88%, transparent);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--line);
    }
    .topbar h1 { margin: 0; font-family: var(--head); font-size: 1.05rem; font-weight: 600; text-align: center; }
    .notes-link { font-size: 0.92rem; color: var(--ink-soft); text-decoration: none; }
    .top-spacer { width: 1px; }
    .range-hint { margin: 0.6rem auto 0; width: min(36rem, calc(100% - 2.2rem)); color: var(--muted); font-size: 0.85rem; }
    .reader { width: min(36rem, calc(100% - 2.2rem)); margin: 0 auto; padding: 0.85rem 0 8rem; }
    .section-head { font-family: var(--head); font-weight: 600; font-size: 1.45rem; line-height: 1.25; margin: 2.25rem 0 0.85rem; }
    .section-head:first-child { margin-top: 0; }
    .verse { position: relative; padding-left: var(--verse-inset); }
    .verse.has-note { box-shadow: inset 2px 0 0 var(--sel-rail); }
    .verse.is-open, .verse.is-span { box-shadow: inset 2px 0 0 var(--sel-rail-open); }
    .verse-press {
      display: grid; grid-template-columns: var(--verse-gutter) minmax(0, 1fr); gap: var(--verse-gap);
      width: 100%; appearance: none; border: 0; background: transparent; text-align: left;
      padding: 0; cursor: pointer;
    }
    .vnum { font-family: var(--read); font-size: 0.7em; color: color-mix(in srgb, var(--ink) 35%, transparent); text-align: right; padding-top: 0.42rem; }
    .verse.is-open .vnum, .verse.is-span .vnum { color: var(--ink-soft); }
    .vtext { font-family: var(--read); font-size: 1.25rem; line-height: 1.65; }
    .verse.is-span .vtext, .verse.is-open .vtext { background: color-mix(in srgb, var(--ink) 4%, transparent); border-radius: 0.08em; }
    .trays { margin-left: calc(var(--verse-gutter) + var(--verse-gap)); }
    .note-tray { padding: 0.2rem 0 0.7rem; }
    .chapter-slot, #chapter-slot { margin: 0 0 1.15rem calc(var(--verse-inset) + var(--verse-gutter) + var(--verse-gap)); }
    .tray-label { margin: 0.4rem 0 0; font-size: 0.78rem; color: var(--faint); }
    .tray-label a { color: var(--faint); text-decoration: none; }
    .outliner {
      width: 100%; min-height: 5.5rem; margin-top: 0.35rem;
      border: 1px solid var(--line); background: var(--paper-raised); border-radius: 0.65rem; padding: 0.35rem 0;
    }
    .outliner:focus-within { border-color: color-mix(in srgb, var(--ink) 28%, transparent); }
    .oblock { display: flex; align-items: flex-start; gap: 0.4rem; padding: 0.05rem 0.7rem 0.05rem calc(0.55rem + (var(--depth, 0) * 1.15rem)); }
    .obullet {
      width: 0.34rem; height: 0.34rem; margin-top: 0.58rem; border-radius: 50%; border: 0; padding: 0;
      background: transparent; flex: 0 0 auto; cursor: pointer;
    }
    .oblock.is-bullet .obullet { background: var(--faint); opacity: 0.75; }
    .oblock:not(.is-bullet) .obullet { background: color-mix(in srgb, var(--faint) 35%, transparent); }
    .otext {
      flex: 1; min-width: 0; min-height: 1.45em; line-height: 1.45; font-size: 16px;
      white-space: pre-wrap; word-break: break-word; outline: none; caret-color: var(--ink);
    }
    .outliner .oblock:only-child .otext { min-height: 4.4rem; }
    .pager { display: flex; justify-content: space-between; gap: 1rem; margin-top: 2rem; color: var(--muted); font-size: 0.92rem; }
    .pager a { color: var(--muted); text-decoration: none; }
    .chrome {
      position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
      width: min(36rem, calc(100% - 2rem)); z-index: 6;
      background: var(--paper-raised); border: 1px solid var(--line); border-radius: 1rem; padding: 0.65rem;
    }
    .jump { display: flex; gap: 0.45rem; margin: 0; }
    .jump input {
      flex: 1; font-size: 16px; min-height: 2.75rem; border: 1px solid var(--line); border-radius: 0.5rem;
      background: var(--paper); padding: 0 0.8rem;
    }
    .dock-toggle, .dock button {
      min-height: 2.75rem; border: 1px solid var(--line); border-radius: 0.5rem; background: var(--paper-raised); cursor: pointer;
    }
    .dock-toggle { width: 2.75rem; }
    .dock { display: grid; gap: 0.35rem; margin-top: 0.45rem; }
    .dock button { text-align: left; padding: 0 0.9rem; color: var(--ink-soft); }
    .dock button[aria-pressed="true"] { color: var(--ink); font-weight: 600; }
    .status { margin: 0; min-height: 1.2em; color: var(--faint); font-size: 0.78rem; }
    body.is-quiet .pager { display: none; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}
