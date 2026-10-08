import { parsePassage, passageLabel } from "./passage";

/** Shared inbox (notes list) helpers for browser embeds. Rails cue: pack mirror + instant paint. */

export const INBOX_CACHE_KEY = "margin_inbox_v4";

/** Soft empty-state copy. Starter chips live outside #notes-mount so list paints don't drop them. */
export const EMPTY_NOTES_COPY = "No notes yet — jump to a passage below or type a reference.";

export const STARTER_CHAPTERS: { slug: string; label: string }[] = [
  { slug: "jhn.3", label: "John 3" },
  { slug: "rom.8", label: "Romans 8" },
  { slug: "psa.23", label: "Psalm 23" },
  { slug: "deu.6", label: "Deuteronomy 6" },
];

export type InboxNote = {
  slug: string;
  label: string;
  excerpt: string;
  bookmarked?: boolean;
  updatedAt?: string;
  createdAt?: string;
};


/** Body preview for inbox / Bookmarks. Prefer excerpt; fall back to text/blocks.
 *  Empty string excerpt must not block fallback — API notes ship `text`/`blocks`, not `excerpt`.
 */
export function inboxNoteExcerpt(note: {
  excerpt?: string | null;
  text?: string | null;
  blocks?: Array<{ indent?: number; text?: string }> | null;
}): string {
  const fromExcerpt = note.excerpt != null ? String(note.excerpt).replace(/\s+/g, " ").trim() : "";
  if (fromExcerpt) return fromExcerpt;
  const fromText = note.text != null ? String(note.text).replace(/\s+/g, " ").trim() : "";
  if (fromText) return fromText;
  const blocks = note.blocks;
  if (Array.isArray(blocks) && blocks.length) {
    return blocks
      .map((b) => `${"  ".repeat(Number(b.indent) || 0)}${b.text || ""}`)
      .join("\n")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

export function noteHasInboxBody(note: {
  excerpt?: string | null;
  text?: string | null;
  blocks?: Array<{ indent?: number; text?: string }> | null;
}): boolean {
  return Boolean(inboxNoteExcerpt(note));
}


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function starterChipsHtml(): string {
  const links = STARTER_CHAPTERS.map(
    (ch) => `<a class="starter-chip" href="/${ch.slug}">${ch.label}</a>`,
  ).join("");
  return `<nav class="starter-chips" aria-label="Starter passages">${links}</nav>`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as const)[c]!,
  );
}

/** Prefer updated_at, fall back to created_at. */
export function noteWhen(note: { updatedAt?: string; createdAt?: string }): Date {
  const raw = note.updatedAt || note.createdAt || "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

/** Local calendar week starting Sunday. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function weekLabel(weekStart: Date, now = new Date()): string {
  const thisWeek = startOfWeek(now);
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  if (weekStart.getTime() === thisWeek.getTime()) return "This week";
  if (weekStart.getTime() === lastWeek.getTime()) return "Last week";
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const sameYear = weekStart.getFullYear() === end.getFullYear();
  const nowYear = now.getFullYear();
  const showYear = weekStart.getFullYear() !== nowYear || end.getFullYear() !== nowYear;
  const left = `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}${showYear ? `, ${weekStart.getFullYear()}` : ""}`;
  if (sameYear && weekStart.getMonth() === end.getMonth()) {
    return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}–${end.getDate()}${showYear ? `, ${weekStart.getFullYear()}` : ""}`;
  }
  const right = `${MONTHS[end.getMonth()]} ${end.getDate()}${showYear && !sameYear ? `, ${end.getFullYear()}` : showYear ? `, ${end.getFullYear()}` : ""}`;
  return `${left} – ${right}`;
}

export function groupNotesByWeek(notes: InboxNote[], now = new Date()): { label: string; notes: InboxNote[] }[] {
  const sorted = [...notes].sort((a, b) => noteWhen(b).getTime() - noteWhen(a).getTime());
  const groups = new Map<number, InboxNote[]>();
  const order: number[] = [];
  for (const note of sorted) {
    const key = startOfWeek(noteWhen(note)).getTime();
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(note);
  }
  return order.map((key) => ({
    label: weekLabel(new Date(key), now),
    notes: groups.get(key)!,
  }));
}

/** Rolling window: notes within the last 14 days stay week-separated. */
export const INBOX_RECENT_DAYS = 14;

export function recentCutoff(now = new Date()): Date {
  return new Date(now.getTime() - INBOX_RECENT_DAYS * 24 * 60 * 60 * 1000);
}

/** `jhn.3.16` / `jhn.3.16-18` / `jhn.3` → `jhn.3`. */
export function chapterSlugOfNote(slug: string): string {
  const m = /^([a-z0-9]+)\.(\d+)/i.exec(String(slug || "").trim());
  return m ? `${m[1].toLowerCase()}.${m[2]}` : String(slug || "").trim();
}

/** True for verse/range OSIS like rom.6.18 or luk.16.9 — not chapter keys like rom.6. */
export function isVerseLevelSlug(slug: string): boolean {
  return /^[a-z0-9]+\.\d+\.\d+/i.test(String(slug || "").trim());
}

/** Older row meta: count only — never verse body or raw OSIS. */
export function olderChapterMeta(count: number): string {
  const n = Math.max(0, Number(count) || 0);
  return n === 1 ? "1 note" : `${n} notes`;
}

/** Extract Older <section> from inbox HTML (SSR or client). */
export function olderSectionHtml(html: string): string {
  const m = /<section class="note-week note-week-older"[\s\S]*?<\/section>/.exec(html);
  return m ? m[0] : "";
}

/** Human label for a week row. Never show raw OSIS (rom.6.18) as the title. */
export function humanNoteLabel(note: InboxNote): string {
  const raw = String(note.label || "").trim();
  if (raw && !/^[a-z0-9]+\.\d+/i.test(raw)) return raw;
  const passage = parsePassage(note.slug);
  if (passage) return passageLabel(passage);
  return raw || note.slug;
}

/** Human chapter title ("John 3:16" / "jhn.3.16" → "John 3"). Prefer slug → passageLabel. */
export function chapterTitleFromNote(note: InboxNote): string {
  const chapterSlug = chapterSlugOfNote(note.slug);
  const passage = parsePassage(chapterSlug);
  if (passage) {
    return passageLabel({ ...passage, kind: "chapter", verseStart: null, verseEnd: null });
  }
  const label = String(note.label || "").trim();
  const m = /^(.+?\s+\d+)(?::|$)/.exec(label);
  if (m) return m[1];
  return chapterSlug || label || note.slug;
}

export type InboxChapterBundle = {
  slug: string;
  label: string;
  notes: InboxNote[];
  updatedAt: string;
  excerpt: string;
};

export type InboxWeekSection = { kind: "week"; label: string; notes: InboxNote[] };
export type InboxOlderSection = { kind: "older"; label: string; chapters: InboxChapterBundle[] };
export type InboxSection = InboxWeekSection | InboxOlderSection;

/** Last 14 days: week buckets (individual notes). Older: one row per chapter.
 * Missing/invalid dates → Older (noteWhen → epoch), still chapter-bundled — never a verse wall.
 */
export function groupInboxNotes(notes: InboxNote[], now = new Date()): InboxSection[] {
  const sorted = [...notes].sort((a, b) => noteWhen(b).getTime() - noteWhen(a).getTime());
  const cutoff = recentCutoff(now).getTime();
  const recent: InboxNote[] = [];
  const older: InboxNote[] = [];
  for (const note of sorted) {
    const when = noteWhen(note).getTime();
    // No usable date → Older (never invent "now"). Recent window only for real timestamps.
    if (when > 0 && when >= cutoff) recent.push(note);
    else older.push(note);
  }
  const sections: InboxSection[] = groupNotesByWeek(recent, now).map((s) => ({
    kind: "week" as const,
    label: s.label,
    notes: s.notes,
  }));
  if (older.length) {
    const byChapter = new Map<string, InboxNote[]>();
    const order: string[] = [];
    for (const note of older) {
      const key = chapterSlugOfNote(note.slug);
      if (!byChapter.has(key)) {
        byChapter.set(key, []);
        order.push(key);
      }
      byChapter.get(key)!.push(note);
    }
    const chapters: InboxChapterBundle[] = order.map((slug) => {
      const list = byChapter.get(slug)!;
      const newest = list[0]!;
      const excerpt = olderChapterMeta(list.length);
      // Never emit verse-level hrefs under Older — re-strip even if a bad key slipped in.
      const chapterSlug = isVerseLevelSlug(slug) ? chapterSlugOfNote(slug) : slug;
      return {
        slug: chapterSlug,
        label: chapterTitleFromNote(newest),
        notes: list,
        updatedAt: newest.updatedAt || newest.createdAt || "",
        excerpt,
      };
    });
    sections.push({ kind: "older", label: "Older", chapters });
  }
  return sections;
}

function formatStamp(note: { updatedAt?: string; createdAt?: string }): string {
  const d = noteWhen(note);
  if (!d.getTime()) return "";
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function noteRowHtml(n: InboxNote): string {
  const title = escapeHtml(humanNoteLabel(n));
  const excerpt = escapeHtml(n.excerpt || "");
  const stamp = formatStamp(n);
  const titleAttr = stamp ? ` title="${escapeHtml(stamp)}"` : "";
  return `<li><a class="note-row" href="/${escapeHtml(n.slug)}"${titleAttr}><span class="note-row-title">${title}</span>${
    excerpt ? `<span class="note-row-excerpt">${excerpt}</span>` : ""
  }</a></li>`;
}

/** "John 3:16" → "16". "John 3:16–18" → "16–18". Chapter-only labels return "". */
function verseCitation(note: InboxNote): string {
  const label = humanNoteLabel(note);
  const colon = label.lastIndexOf(":");
  if (colon < 0) return "";
  return label.slice(colon + 1).trim();
}

/** Book + chapter opens the chapter note. The rest of a recent row opens the chapter. Verse cards stay on top.
 *  Older rows pass rowOpensNote so the whole row, including the count, opens the chapter note. */
function chapterBundleHtml(
  slug: string,
  title: string,
  opts: { verses?: string; excerpt?: string; stamp?: string; rowOpensNote?: boolean } = {},
): string {
  const titleAttr = opts.stamp ? ` title="${escapeHtml(opts.stamp)}"` : "";
  const body = opts.verses
    ? `<span class="note-bundle-verses">${opts.verses}</span>`
    : opts.excerpt
      ? `<span class="note-row-excerpt">${escapeHtml(opts.excerpt)}</span>`
      : "";
  const rowClass = opts.verses ? "note-bundle" : "note-bundle note-row-chapter";
  const openHref = opts.rowOpensNote ? `/${escapeHtml(slug)}?chapter_note=1` : `/${escapeHtml(slug)}`;
  return `<li class="${rowClass}"><a class="note-bundle-open" href="${openHref}" tabindex="-1" aria-hidden="true"></a><a class="note-bundle-name" href="/${escapeHtml(slug)}?chapter_note=1"${titleAttr}>${escapeHtml(title)}</a>${body}</li>`;
}

/** Every verse and range is a card, even when it is the only note in the chapter. A chapter note stays a chapter row. */
function weekChapterRows(notes: InboxNote[]): string {
  const order: string[] = [];
  const byChapter = new Map<string, InboxNote[]>();
  for (const note of notes) {
    const key = chapterSlugOfNote(note.slug);
    if (!byChapter.has(key)) {
      byChapter.set(key, []);
      order.push(key);
    }
    byChapter.get(key)!.push(note);
  }
  return order
    .map((slug) => {
      const list = byChapter.get(slug)!;
      const verses = list
        .map((note) => {
          const place = verseCitation(note);
          if (!place) return "";
          const stamp = formatStamp(note);
          const titleAttr = stamp ? ` title="${escapeHtml(stamp)}"` : "";
          const label = humanNoteLabel(note);
          return `<a class="note-bundle-verse" href="/${escapeHtml(note.slug)}" aria-label="${escapeHtml(label)}"${titleAttr}>${escapeHtml(place)}</a>`;
        })
        .filter(Boolean)
        .join("");
      if (!verses) {
        return list
          .map((note) => chapterBundleHtml(slug, chapterTitleFromNote(note), { excerpt: note.excerpt || "", stamp: formatStamp(note) }))
          .join("");
      }
      return chapterBundleHtml(slug, chapterTitleFromNote(list[0]!), { verses });
    })
    .join("");
}

function chapterRowHtml(ch: InboxChapterBundle): string {
  return chapterBundleHtml(ch.slug, ch.label || ch.slug, {
    excerpt: ch.excerpt || "",
    stamp: formatStamp({ updatedAt: ch.updatedAt }),
    rowOpensNote: true,
  });
}

/** Separate collapsible Rails-style view of bookmarked chapter/verse notes.
 *  Show every bookmarked note — including empty / bullet-only ranges (e.g. rom.5.3–5).
 *  The notes feed (THIS WEEK / Older) still hides empty bookmark-only rows.
 */
/** Phosphor bookmark-simple, regular weight. Kept inline so /notes stays asset-free. */
function bookmarkSimpleIcon(): string {
  return `<svg class="bookmarks-summary-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M184 32H72a16 16 0 0 0-16 16v176a8 8 0 0 0 12.24 6.78L128 193.43l59.77 37.35A8 8 0 0 0 200 224V48a16 16 0 0 0-16-16m0 177.57l-51.77-32.35a8 8 0 0 0-8.48 0L72 209.57V48h112Z"/></svg>`;
}

function phoneTabIcon(kind: "book" | "notebook" | "bookmark" | "groups"): string {
  if (kind === "groups") {
    return `<svg class="phone-tab-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.2" cy="8" r="1.5" fill="currentColor"/><circle cx="12.6" cy="3.4" r="1.5" fill="currentColor"/><circle cx="12.6" cy="12.6" r="1.5" fill="currentColor"/><path d="M4.6 7.3 11.1 4.1M4.6 8.7 11.1 11.8" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`;
  }
  const paths = {
    book: "M208 24H72a32 32 0 0 0-32 32v168a8 8 0 0 0 8 8h144a8 8 0 0 0 0-16H56a16 16 0 0 1 16-16h136a8 8 0 0 0 8-8V32a8 8 0 0 0-8-8m-8 160H72a31.8 31.8 0 0 0-16 4.29V56a16 16 0 0 1 16-16h128Z",
    notebook: "M184 112a8 8 0 0 1-8 8h-64a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8m-8 24h-64a8 8 0 0 0 0 16h64a8 8 0 0 0 0-16m48-88v160a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16V48a16 16 0 0 1 16-16h160a16 16 0 0 1 16 16M48 208h24V48H48Zm160 0V48H88v160z",
    bookmark: "M184 32H72a16 16 0 0 0-16 16v176a8 8 0 0 0 12.24 6.78L128 193.43l59.77 37.35A8 8 0 0 0 200 224V48a16 16 0 0 0-16-16m0 177.57l-51.77-32.35a8 8 0 0 0-8.48 0L72 209.57V48h112Z",
  };
  return `<svg class="phone-tab-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="${paths[kind]}"/></svg>`;
}

/** Scripture, the notes feed, Bookmarks, and Topics. Icons only; names stay on aria-label. */
export function phoneTabsHtml(opts: { surface: "notes" | "scripture"; readerHref: string; groupsHref?: string }): string {
  const scripture = opts.surface === "scripture" ? ' aria-current="page"' : "";
  const notes = opts.surface === "notes" ? ' aria-current="page"' : "";
  const reader = escapeHtml(opts.readerHref);
  const groupsHref = escapeHtml(opts.groupsHref ?? "/notes#groups");
  return `<nav class="phone-tabs" aria-label="Sections"><a class="phone-tab" data-phone-tab="scripture" href="${reader}" data-reader-link aria-label="Scripture"${scripture}>${phoneTabIcon("book")}</a><a class="phone-tab" data-phone-tab="notes" href="/notes" aria-label="Notes"${notes}>${phoneTabIcon("notebook")}</a><a class="phone-tab" data-phone-tab="bookmarks" href="/notes#bookmarks" aria-label="Bookmarks">${phoneTabIcon("bookmark")}</a><a class="phone-tab" data-phone-tab="groups" href="${groupsHref}" aria-label="Topics">${phoneTabIcon("groups")}</a></nav>`;
}

/** Bookmarks and verse groups share this shell. Desktop expands inline; phone tabs show the list full screen. */
export function notesCollectionHtml(opts: {
  id: string;
  label: string;
  icon: string;
  body: string;
  panelId?: string;
  open?: boolean;
  rootAttrs?: string;
}): string {
  const panelId = opts.panelId ? ` id="${opts.panelId}"` : "";
  const titleId = `${opts.id}-sheet-title`;
  const open = opts.open ? " open" : "";
  const rootAttrs = opts.rootAttrs ? ` ${opts.rootAttrs}` : "";
  return `<details class="bookmarks-view" id="${opts.id}"${rootAttrs}${open}><summary><span class="bookmarks-summary-label">${opts.icon}<span>${opts.label}</span></span></summary><div class="notes-sheet"><button type="button" class="notes-sheet-backdrop" data-notes-sheet-close aria-label="Close"></button><div class="notes-sheet-panel"><div class="notes-sheet-handle" aria-hidden="true"></div><p class="notes-sheet-title" id="${titleId}">${opts.label}</p><div class="bookmarks-panel"${panelId}>${opts.body}</div></div></div></details>`;
}

export function bookmarksViewHtml(notes: InboxNote[]): string {
  const bookmarked = [...notes]
    .filter((note) => Boolean(note.bookmarked))
    .map((note) => ({ ...note, excerpt: inboxNoteExcerpt(note) || note.excerpt || "" }))
    .sort((a, b) => noteWhen(b).getTime() - noteWhen(a).getTime());
  const rows = bookmarked.map((note) => noteRowHtml(note)).join("");
  const body = rows
    ? `<ul class="note-list">${rows}</ul>`
    : `<p class="empty">No bookmarks yet.</p>`;
  return notesCollectionHtml({
    id: "bookmarks-view",
    label: "Bookmarks",
    icon: bookmarkSimpleIcon(),
    body,
  });
}

/** SSR + shared list markup: recent weeks, then Older chapter bundles. */
export function notesListHtml(notes: InboxNote[], now = new Date()): string {
  // Notes feed only: hide empty bookmark-only rows (no proper body). Bookmarks
  // section lists those separately via bookmarksViewHtml.
  const visible = notes
    .filter((note) => !note.bookmarked || noteHasInboxBody(note))
    .map((note) => ({ ...note, excerpt: inboxNoteExcerpt(note) || note.excerpt || "" }));
  if (!visible.length) return `<p class="empty">${EMPTY_NOTES_COPY}</p>`;
  const sections = groupInboxNotes(visible, now);
  return sections
    .map((section) => {
      if (section.kind === "week") {
        const rows = weekChapterRows(section.notes);
        return `<section class="note-week"><h2 class="note-week-label">${escapeHtml(section.label)}</h2><ul class="note-list">${rows}</ul></section>`;
      }
      const rows = section.chapters.map(chapterRowHtml).join("");
      return `<section class="note-week note-week-older"><h2 class="note-week-label">${escapeHtml(section.label)}</h2><ul class="note-list">${rows}</ul></section>`;
    })
    .join("");
}

/** Lean boot script for /notes — paint from sessionStorage first, then revalidate. */
export function notesInboxScript(): string {
  return `(() => {
  const KEY = ${JSON.stringify(INBOX_CACHE_KEY)};
  const EMPTY = ${JSON.stringify(EMPTY_NOTES_COPY)};
  const MONTHS = ${JSON.stringify(MONTHS)};
  const mount = document.getElementById("notes-mount");
  if (!mount) return;

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function noteWhen(n) {
    const raw = n.updatedAt || n.createdAt || "";
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  }

  function startOfWeek(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - x.getDay());
    return x;
  }

  function weekLabel(weekStart, now) {
    const thisWeek = startOfWeek(now);
    const lastWeek = new Date(thisWeek);
    lastWeek.setDate(lastWeek.getDate() - 7);
    if (weekStart.getTime() === thisWeek.getTime()) return "This week";
    if (weekStart.getTime() === lastWeek.getTime()) return "Last week";
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const sameYear = weekStart.getFullYear() === end.getFullYear();
    const nowYear = now.getFullYear();
    const showYear = weekStart.getFullYear() !== nowYear || end.getFullYear() !== nowYear;
    const left = MONTHS[weekStart.getMonth()] + " " + weekStart.getDate() + (showYear ? ", " + weekStart.getFullYear() : "");
    if (sameYear && weekStart.getMonth() === end.getMonth()) {
      return MONTHS[weekStart.getMonth()] + " " + weekStart.getDate() + "–" + end.getDate() + (showYear ? ", " + weekStart.getFullYear() : "");
    }
    const right = MONTHS[end.getMonth()] + " " + end.getDate() + (showYear ? ", " + end.getFullYear() : "");
    return left + " – " + right;
  }

  const RECENT_DAYS = 14;

  function chapterSlugOf(slug) {
    const m = /^([a-z0-9]+)\.(\d+)/i.exec(String(slug || "").trim());
    return m ? m[1].toLowerCase() + "." + m[2] : String(slug || "").trim();
  }

  const BOOK_NAMES = {"GEN":"Genesis","EXO":"Exodus","LEV":"Leviticus","NUM":"Numbers","DEU":"Deuteronomy","JOS":"Joshua","JDG":"Judges","RUT":"Ruth","1SA":"1 Samuel","2SA":"2 Samuel","1KI":"1 Kings","2KI":"2 Kings","1CH":"1 Chronicles","2CH":"2 Chronicles","EZR":"Ezra","NEH":"Nehemiah","EST":"Esther","JOB":"Job","PSA":"Psalms","PRO":"Proverbs","ECC":"Ecclesiastes","SNG":"Song of Solomon","ISA":"Isaiah","JER":"Jeremiah","LAM":"Lamentations","EZK":"Ezekiel","DAN":"Daniel","HOS":"Hosea","JOL":"Joel","AMO":"Amos","OBA":"Obadiah","JON":"Jonah","MIC":"Micah","NAM":"Nahum","HAB":"Habakkuk","ZEP":"Zephaniah","HAG":"Haggai","ZEC":"Zechariah","MAL":"Malachi","MAT":"Matthew","MRK":"Mark","LUK":"Luke","JHN":"John","ACT":"Acts","ROM":"Romans","1CO":"1 Corinthians","2CO":"2 Corinthians","GAL":"Galatians","EPH":"Ephesians","PHP":"Philippians","COL":"Colossians","1TH":"1 Thessalonians","2TH":"2 Thessalonians","1TI":"1 Timothy","2TI":"2 Timothy","TIT":"Titus","PHM":"Philemon","HEB":"Hebrews","JAS":"James","1PE":"1 Peter","2PE":"2 Peter","1JN":"1 John","2JN":"2 John","3JN":"3 John","JUD":"Jude","REV":"Revelation"};
  function chapterTitle(n) {
    const chapterSlug = chapterSlugOf(n.slug);
    const sm = /^([a-z0-9]+)\.(\d+)$/i.exec(chapterSlug);
    if (sm) {
      const name = BOOK_NAMES[sm[1].toUpperCase()] || sm[1];
      return name + " " + sm[2];
    }
    const label = String(n.label || "").trim();
    const m = /^(.+?\s+\d+)(?::|$)/.exec(label);
    if (m) return m[1];
    return chapterSlug || label || n.slug;
  }

  function noteRow(n) {
    let titleRaw = String(n.label || "").trim();
    if (!titleRaw || /^[a-z0-9]+\.\d+/i.test(titleRaw)) {
      const sm = /^([a-z0-9]+)\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/i.exec(String(n.slug || ""));
      if (sm) {
        const name = BOOK_NAMES[sm[1].toUpperCase()] || sm[1];
        titleRaw = !sm[3] ? (name + " " + sm[2]) : (name + " " + sm[2] + ":" + sm[3] + (sm[4] ? "–" + sm[4] : ""));
      } else titleRaw = n.slug || titleRaw;
    }
    const title = escape(titleRaw || n.slug || "");
    const excerpt = escape(n.excerpt || "");
    const when = noteWhen(n);
    const stamp = when.getTime() ? when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
    const titleAttr = stamp ? ' title="' + escape(stamp) + '"' : "";
    return '<li><a class="note-row" href="/' + escape(n.slug) + '"' + titleAttr + '><span class="note-row-title">' + title + "</span>" +
      (excerpt ? '<span class="note-row-excerpt">' + excerpt + "</span>" : "") + "</a></li>";
  }

  function weekChapterRows(notes) {
    const order = [];
    const byChapter = new Map();
    for (const n of notes) {
      const key = chapterSlugOf(n.slug);
      if (!byChapter.has(key)) { byChapter.set(key, []); order.push(key); }
      byChapter.get(key).push(n);
    }
    let html = "";
    for (const slug of order) {
      const list = byChapter.get(slug);
      let verses = "";
      for (const n of list) {
        let label = String(n.label || "").trim();
        if (!label || /^[a-z0-9]+\.\d+/i.test(label)) {
          const sm = /^([a-z0-9]+)\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/i.exec(String(n.slug || ""));
          if (sm && sm[3]) {
            const name = BOOK_NAMES[sm[1].toUpperCase()] || sm[1];
            label = name + " " + sm[2] + ":" + sm[3] + (sm[4] ? "–" + sm[4] : "");
          }
        }
        const colon = label.lastIndexOf(":");
        if (colon < 0) continue;
        const place = label.slice(colon + 1).trim();
        if (!place) continue;
        const when = noteWhen(n);
        const stamp = when.getTime() ? when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
        const titleAttr = stamp ? ' title="' + escape(stamp) + '"' : "";
        verses += '<a class="note-bundle-verse" href="/' + escape(n.slug) + '" aria-label="' + escape(label) + '"' + titleAttr + ">" + escape(place) + "</a>";
      }
      if (!verses) {
        for (const n of list) {
          const when = noteWhen(n);
          const stamp = when.getTime() ? when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
          html += chapterBundleRow(slug, chapterTitle(n), { excerpt: n.excerpt || "", stamp });
        }
        continue;
      }
      html += chapterBundleRow(slug, chapterTitle(list[0]), { verses });
    }
    return html;
  }

  function chapterBundleRow(slug, title, opts) {
    const titleAttr = opts.stamp ? ' title="' + escape(opts.stamp) + '"' : "";
    const body = opts.verses
      ? '<span class="note-bundle-verses">' + opts.verses + "</span>"
      : (opts.excerpt ? '<span class="note-row-excerpt">' + escape(opts.excerpt) + "</span>" : "");
    const rowClass = opts.verses ? "note-bundle" : "note-bundle note-row-chapter";
    const openHref = opts.rowOpensNote ? ("/" + escape(slug) + "?chapter_note=1") : ("/" + escape(slug));
    return '<li class="' + rowClass + '"><a class="note-bundle-open" href="' + openHref + '" tabindex="-1" aria-hidden="true"></a><a class="note-bundle-name" href="/' + escape(slug) + '?chapter_note=1"' + titleAttr + ">" + escape(title) + "</a>" + body + "</li>";
  }

  function chapterRow(ch) {
    const when = noteWhen({ updatedAt: ch.updatedAt });
    const stamp = when.getTime() ? when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
    return chapterBundleRow(ch.slug, ch.label || ch.slug, { excerpt: ch.excerpt || "", stamp, rowOpensNote: true });
  }

  function rowsHtml(notes) {
    if (!notes || !notes.length) return '<p class="empty">' + EMPTY + "</p>";
    const sorted = notes.slice().sort((a, b) => noteWhen(b) - noteWhen(a));
    const now = new Date();
    const cutoff = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
    const recent = [];
    const older = [];
    for (const n of sorted) {
      const when = noteWhen(n).getTime();
      if (when > 0 && when >= cutoff) recent.push(n);
      else older.push(n);
    }
    const parts = [];
    const weekGroups = new Map();
    const weekOrder = [];
    for (const n of recent) {
      const key = startOfWeek(noteWhen(n)).getTime();
      if (!weekGroups.has(key)) { weekGroups.set(key, []); weekOrder.push(key); }
      weekGroups.get(key).push(n);
    }
    for (const key of weekOrder) {
      const label = weekLabel(new Date(key), now);
      const rows = weekChapterRows(weekGroups.get(key));
      parts.push('<section class="note-week"><h2 class="note-week-label">' + escape(label) + '</h2><ul class="note-list">' + rows + "</ul></section>");
    }
    if (older.length) {
      const byChapter = new Map();
      const chapterOrder = [];
      for (const n of older) {
        const key = chapterSlugOf(n.slug);
        if (!byChapter.has(key)) { byChapter.set(key, []); chapterOrder.push(key); }
        byChapter.get(key).push(n);
      }
      const rows = chapterOrder.map((slug) => {
        const list = byChapter.get(slug);
        const newest = list[0];
        const excerpt = list.length === 1 ? "1 note" : (list.length + " notes");
        const chapterSlug = /^[a-z0-9]+\.\d+\.\d+/i.test(slug) ? chapterSlugOf(slug) : slug;
        return chapterRow({
          slug: chapterSlug,
          label: chapterTitle(newest),
          updatedAt: newest.updatedAt || newest.createdAt || "",
          excerpt,
        });
      }).join("");
      parts.push('<section class="note-week note-week-older"><h2 class="note-week-label">Older</h2><ul class="note-list">' + rows + "</ul></section>");
    }
    return parts.join("");
  }

  function noteExcerpt(n) {
    const ex = n.excerpt != null ? String(n.excerpt).replace(/\\s+/g, " ").trim() : "";
    if (ex) return ex;
    const tx = n.text != null ? String(n.text).replace(/\\s+/g, " ").trim() : "";
    if (tx) return tx;
    const blocks = n.blocks;
    if (Array.isArray(blocks) && blocks.length) {
      return blocks.map((b) => ("  ").repeat(b.indent || 0) + (b.text || "")).join("\\n").replace(/\\s+/g, " ").trim();
    }
    return "";
  }
  function normalize(notes) {
    return (notes || []).map((n) => ({
      slug: n.slug,
      label: n.label || n.slug,
      excerpt: noteExcerpt(n),
      bookmarked: Boolean(n.bookmarked),
      updatedAt: n.updatedAt || "",
      createdAt: n.createdAt || "",
    })).filter((n) => !n.bookmarked || n.excerpt);
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.notes)) return null;
      return data;
    } catch { return null; }
  }

  function writeCache(notes, backSlug) {
    try {
      const prev = readCache();
      sessionStorage.setItem(KEY, JSON.stringify({
        notes: normalize(notes),
        backSlug: backSlug || prev?.backSlug || "jhn.1",
        savedAt: Date.now(),
      }));
    } catch { /* quota */ }
  }

  // SSR #notes-mount (notesListHtml) is the only /notes list paint.
  // Never overwrite with client rowsHtml — that path previously re-expanded
  // Older into per-verse OSIS titles (rom.6.18) from stale cache / date skew.
  const mirror = document.getElementById("inbox-pack-mirror");
  let mirrored = null;
  if (mirror) {
    try {
      const seeded = JSON.parse(mirror.textContent || "[]");
      if (Array.isArray(seeded)) mirrored = seeded;
    } catch { /* ignore */ }
  }
  if (mirrored) {
    writeCache(mirrored, document.querySelector('.icon-btn[aria-label="Reader"]')?.getAttribute("href")?.slice(1));
  }

  // Background revalidate → sessionStorage only (reader prefetch). Do not touch mount.
  fetch("/api/notes", { credentials: "same-origin", headers: { accept: "application/json" } })
    .then((r) => r.json())
    .then((data) => {
      if (!data?.ok || !Array.isArray(data.notes)) return;
      writeCache(normalize(data.notes));
    })
    .catch(() => {});

  // --- Soft-nav inbox → chapter (same VBV swap path as reader pager/grid) ---
  const CHAPTER_NOTES_KEY = "margin_chapter_notes_v1";
  const htmlCache = new Map();
  const notesPrefetch = new Map();

  function chapterSlugFromHref(href) {
    try {
      const path = new URL(href, location.origin).pathname.replace(/^\\/+/, "");
      if (!path || path === "notes" || path.startsWith("api/") || path.startsWith("login")) return null;
      if (!/^[a-z0-9]+\\.\\d+/i.test(path)) return null;
      const m = /^([a-z0-9]+)\\.(\\d+)/i.exec(path);
      return m ? (m[1].toLowerCase() + "." + m[2]) : null;
    } catch { return null; }
  }

  function writeChapterNotesCache(slug, list) {
    try {
      let all = {};
      try {
        const raw = sessionStorage.getItem(CHAPTER_NOTES_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data && typeof data === "object") all = data;
        }
      } catch {}
      all[slug] = { notes: list, savedAt: Date.now() };
      const keys = Object.keys(all).sort((a, b) => (all[b].savedAt || 0) - (all[a].savedAt || 0));
      const trimmed = {};
      for (const key of keys.slice(0, 24)) trimmed[key] = all[key];
      sessionStorage.setItem(CHAPTER_NOTES_KEY, JSON.stringify(trimmed));
    } catch {}
  }

  function prefetchChapterNotes(slug) {
    if (!slug) return Promise.resolve(null);
    if (notesPrefetch.has(slug)) return notesPrefetch.get(slug);
    const req = fetch("/api/notes?chapter=" + encodeURIComponent(slug), {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      priority: "low",
    })
      .then((r) => {
      if (r.status === 429) return { rateLimited: true };
      return r.ok ? r.json() : Promise.reject();
    })
      .then((data) => {
        if (data && data.rateLimited) return null;
        if (data?.ok && Array.isArray(data.notes)) {
          writeChapterNotesCache(slug, data.notes);
          return data.notes;
        }
        return null;
      })
      .catch(() => { notesPrefetch.delete(slug); return null; });
    notesPrefetch.set(slug, req);
    return req;
  }

  function documentHref(href) {
    try {
      const url = new URL(href, location.origin);
      if (url.origin !== location.origin) return "";
      url.hash = "";
      return url.href;
    } catch { return ""; }
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
  function prefetchChapter(href, opts) {
    href = documentHref(href);
    const slug = chapterSlugFromHref(href);
    if (!slug) return;
    if (!htmlCache.has(href)) {
      const init = { credentials: "same-origin", headers: { accept: "text/html", purpose: "prefetch", "x-margin-prefetch": "1" } };
      if (opts && opts.priority) init.priority = opts.priority;
      if (opts && opts.signal) init.signal = opts.signal;
      const promise = fetch(href, init)
        .then((r) => r.ok ? r.text() : Promise.reject())
        .catch(() => {
          if (htmlCache.get(href) === promise) htmlCache.delete(href);
          return null;
        });
      htmlCache.set(href, promise);
    }
    prefetchChapterNotes(slug);
  }

  async function softNavTo(href, { push = true, useChapterCache = false } = {}) {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin) { location.href = href; return; }
    const exactKey = documentHref(url.href);
    const slug = chapterSlugFromHref(exactKey);
    if (slug) prefetchChapterNotes(slug);
    const chapterKey = slug ? documentHref("/" + slug) : "";
    try {
      let html = null;
      const exactPromise = htmlCache.get(exactKey);
      if (exactPromise) html = await exactPromise;
      // A verse URL can miss while its chapter document is already warm (search resolve stores that key).
      if (!html && useChapterCache && chapterKey && chapterKey !== exactKey) {
        const chapterPromise = htmlCache.get(chapterKey);
        if (chapterPromise) html = await chapterPromise;
      }
      if (!html) {
        const htmlPromise = fetch(exactKey, { credentials: "same-origin", headers: { accept: "text/html" } }).then((r) => {
          if (!r.ok) throw new Error("nav");
          return r.text();
        });
        htmlCache.set(exactKey, htmlPromise);
        html = await htmlPromise;
      }
      if (!html) { location.href = href; return; }
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
  function preloadHrefs(hrefs) {
    if (!hrefs || !hrefs.forEach) return;
    hrefs.forEach((href) => {
      const key = documentHref(href);
      const slug = chapterSlugFromHref(key);
      if (!slug) return;
      const chapterKey = documentHref("/" + slug);
      // Same chapter document search resolve stores. Sibling chapters are kept; nothing is aborted.
      prefetchChapter(chapterKey, { priority: "low" });
      if (key && key !== chapterKey) prefetchChapter(key, { priority: "low" });
    });
  }
  window.__marginPrefetchChapter = prefetchSearchChapter;
  window.__marginSoftNav = softNavTo;
  window.__marginPreloadHrefs = preloadHrefs;

  function isInboxChapterLink(a) {
    if (!a || !a.href) return false;
    // note-row (recent + Older chapter rows), starter chips, chapter-grid cells, reader back icon.
    if (a.classList?.contains("note-row")) return true;
    if (a.classList?.contains("att-chip") && a.classList?.contains("wiki") && a.closest?.(".verse-group")) return true;
    if (a.classList?.contains("note-bundle-name") || a.classList?.contains("note-bundle-verse") || a.classList?.contains("note-bundle-open")) return true;
    if (a.classList?.contains("starter-chip")) return true;
    if (a.classList?.contains("chapter-grid-cell") || a.hasAttribute("data-chapter-nav")) return true;
    if (a.classList?.contains("icon-btn") && a.getAttribute("aria-label") === "Reader") return true;
    return false;
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
    const a = event.target?.closest?.("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    if (!isInboxChapterLink(a)) return;
    const slug = chapterSlugFromHref(a.href);
    if (!slug) return;
    // Preserve Older hrefs like /rom.6 — soft-nav fetches that exact path.
    // Verse chips reuse a warm chapter document the way search resolve does.
    const verseChip = Boolean(a.classList?.contains("att-chip") && a.classList?.contains("wiki") && a.closest?.(".verse-group"));
    event.preventDefault();
    softNavTo(a.href, { push: true, useChapterCache: verseChip });
  });

  document.addEventListener("pointerenter", (event) => {
    const a = event.target?.closest?.("a.note-row[href], a.note-bundle-name[href], a.note-bundle-open[href], a.note-bundle-verse[href], a.starter-chip[href], a.chapter-grid-cell[href]");
    if (a?.href && chapterSlugFromHref(a.href)) prefetchChapter(a.href);
  }, true);

  // --- Chapter grid (Notes title picker; same Rails/CF picker as chapter pages) ---
  const grid = document.querySelector("#chapter-grid");
  const gridTitle = document.querySelector("#chapter-grid-title");
  const gridHeading = document.querySelector("#chapter-grid-heading");
  const bookList = document.querySelector("#chapter-grid-books");
  const chapterCells = document.querySelector("#chapter-grid-chapters");
  let booksMeta = null;
  try { booksMeta = JSON.parse(document.querySelector("#books-meta")?.textContent || "null"); } catch {}
  const seedSlug = document.querySelector('.icon-btn[aria-label="Reader"]')?.getAttribute("href")?.slice(1) || "jhn.1";
  let gridBook = (seedSlug.split(".")[0] || "jhn").toUpperCase();
  const currentBook = gridBook;
  const currentChapter = Number(seedSlug.split(".")[1]) || 1;

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
      const count = booksMeta?.chapterCounts?.[gridBook] || 0;
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
  function bindPhoneTabs() {
    var phoneQuery = window.matchMedia("(max-width: 767px)");
    function phone() { return phoneQuery.matches; }
    var titles = { notes: "Notes", bookmarks: "Bookmarks", groups: "Topics" };
    function tabFromHash() {
      var hash = String(location.hash || "").replace(/^#/, "");
      if (hash === "bookmarks" || hash === "groups") return hash;
      return "notes";
    }
    function apply() {
      var onPhone = phone();
      var tab = tabFromHash();
      if (onPhone) document.documentElement.dataset.phoneTab = tab;
      else document.documentElement.removeAttribute("data-phone-tab");
      var bookmarks = document.getElementById("bookmarks-view");
      var groups = document.getElementById("verse-groups-view");
      if (onPhone) {
        if (bookmarks) bookmarks.open = tab === "bookmarks";
        if (groups) groups.open = tab === "groups";
      }
      var tabs = document.querySelectorAll(".phone-tab");
      for (var i = 0; i < tabs.length; i++) {
        var name = tabs[i].getAttribute("data-phone-tab");
        if (name === "scripture") continue;
        if (onPhone && name === tab) tabs[i].setAttribute("aria-current", "page");
        else if (onPhone) tabs[i].removeAttribute("aria-current");
      }
      var title = document.getElementById("chapter-grid-title");
      if (title && onPhone && document.querySelector(".notes-main")) title.textContent = titles[tab];
    }
    window.addEventListener("hashchange", apply);
    if (phoneQuery.addEventListener) phoneQuery.addEventListener("change", apply);
    apply();
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && grid && !grid.hidden) {
      setGridOpen(false);
      showChapterPane(currentBook);
    }
  });
  bindPhoneTabs();
})();`;
}
