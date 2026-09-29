import { escapeHtml, page } from "./html";
import { bodyText, noteCoversVerse, type NoteDraft } from "./notes";
import {
  nextChapter,
  parsePassage,
  passageLabel,
  passageSlug,
  prevChapter,
  routeBibleUrl,
  type Passage,
} from "./passage";
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
  const slug = passageSlug(passage);
  const exact = notes.find((note) => note.slug === slug);
  const title = passageLabel(passage);
  const initial = exact ? bodyText(exact.blocks) : "";

  const body = `<header class="top">
    <h1>${escapeHtml(title)}</h1>
    <a href="/notes">Notes</a>
  </header>
<main>
  ${jumpForm()}
  <form class="tray" id="note-form" method="post" action="/api/notes/${escapeHtml(slug)}">
    <p class="tray-label">
      <a href="${escapeHtml(routeBibleUrl(passage))}" rel="noreferrer">${escapeHtml(title)}</a>
      · this note is only <code>${escapeHtml(slug)}</code>
    </p>
    <label for="note-text" style="position:absolute;left:-999px">Note</label>
    <textarea id="note-text" name="text">${escapeHtml(initial)}</textarea>
    <div class="tray-row">
      <p class="status" id="note-status" role="status"></p>
      <button type="submit">Save</button>
    </div>
  </form>
  <section>
    <h2>Notes in this chapter</h2>
    <div id="chapter-notes">${renderNoteList(notes)}</div>
  </section>
  <article class="chapter">${renderVerses(passage, pack, notes)}</article>
  ${pager(passage)}
</main>
<footer>
  <p>Berean Standard Bible, public domain. Text is a chapter cache, never stored inside the note. Share-out goes to route.bible. Search stays with the sibling that owns POST /api/search.</p>
</footer>
<script>
(() => {
  const form = document.querySelector("#note-form");
  const text = document.querySelector("#note-text");
  const status = document.querySelector("#note-status");
  const focus = document.querySelector(".verse.is-focus");
  if (focus) focus.scrollIntoView({ block: "center" });
  if (!form || !text || !status) return;
  let last = text.value;
  let timer = 0;
  async function save() {
    if (text.value === last) return;
    status.textContent = "Saving";
    const response = await fetch(form.action, {
      method: "PUT",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ text: text.value }),
    });
    const data = await response.json();
    if (!response.ok) {
      status.textContent = data.error || "Not saved";
      return;
    }
    last = text.value;
    status.textContent = data.deleted ? "Cleared" : "Saved";
    if (Array.isArray(data.chapterNotes)) paintList(data.chapterNotes);
  }
  function paintList(notes) {
    const host = document.querySelector("#chapter-notes");
    if (!host) return;
    host.replaceChildren();
    if (notes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No notes in this chapter yet.";
      host.append(empty);
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "note-list";
    for (const note of notes) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = "/" + note.slug;
      link.textContent = note.label || note.slug;
      const excerpt = document.createElement("p");
      excerpt.textContent = String(note.text || "").replace(/\\s+/g, " ").trim();
      li.append(link, excerpt);
      ul.append(li);
    }
    host.append(ul);
  }
  text.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(save, 400);
  });
  window.addEventListener("pagehide", () => {
    if (text.value === last) return;
    fetch(form.action, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: text.value }),
      keepalive: true,
    });
  });
})();
</script>`;

  return page(`${title} · Margin spike`, body);
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

function renderVerses(passage: Passage, pack: ChapterPack, notes: NoteView[]): string {
  const start = passage.verseStart;
  const end = passage.verseEnd ?? passage.verseStart;
  let html = "";
  for (const verse of pack.verses) {
    if (verse.heading) html += `<h2>${escapeHtml(verse.heading)}</h2>`;
    const focused = start != null && end != null && verse.v >= start && verse.v <= end;
    const marked = notes.some((note) => noteCoversVerse(note, verse.v));
    const href = `/${passage.book.toLowerCase()}.${passage.chapter}.${verse.v}`;
    const classes = ["verse", focused ? "is-focus" : "", marked ? "has-note" : ""].filter(Boolean).join(" ");
    html += `<p class="${classes}" id="v${verse.v}"><a class="vnum" href="${href}">${verse.v}</a><span class="vtext">${escapeHtml(verse.text)}</span></p>`;
  }
  return html;
}

function renderNoteList(notes: NoteView[]): string {
  if (notes.length === 0) return `<p class="empty">No notes in this chapter yet.</p>`;
  const items = notes
    .map((note) => {
      const excerpt = bodyText(note.blocks).replace(/\s+/g, " ").trim();
      return `<li><a href="/${escapeHtml(note.slug)}">${escapeHtml(noteLabel(note.slug))}</a><p>${escapeHtml(excerpt)}</p></li>`;
    })
    .join("");
  return `<ul class="note-list">${items}</ul>`;
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
    <label for="q" style="position:absolute;left:-999px">Jump</label>
    <input id="q" name="q" placeholder="John 3:16" autocomplete="off" spellcheck="false">
    <button type="submit">Open</button>
  </form>`;
}
