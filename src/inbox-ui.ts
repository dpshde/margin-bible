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

/** Every verse and range is a card, even when it is the only note in the chapter. A chapter note stays a normal row. */
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
      if (!verses) return list.map((note) => noteRowHtml(note)).join("");
      const title = chapterTitleFromNote(list[0]!);
      return `<li class="note-bundle"><a class="note-bundle-name" href="/${escapeHtml(slug)}">${escapeHtml(title)}</a><span class="note-bundle-verses">${verses}</span></li>`;
    })
    .join("");
}

function chapterRowHtml(ch: InboxChapterBundle): string {
  const title = escapeHtml(ch.label || ch.slug);
  const excerpt = escapeHtml(ch.excerpt || "");
  const stamp = formatStamp({ updatedAt: ch.updatedAt });
  const titleAttr = stamp ? ` title="${escapeHtml(stamp)}"` : "";
  return `<li><a class="note-row note-row-chapter" href="/${escapeHtml(ch.slug)}"${titleAttr}><span class="note-row-title">${title}</span>${
    excerpt ? `<span class="note-row-excerpt">${excerpt}</span>` : ""
  }</a></li>`;
}

/** Separate collapsible Rails-style view of bookmarked chapter/verse notes.
 *  Show every bookmarked note — including empty / bullet-only ranges (e.g. rom.5.3–5).
 *  The notes feed (THIS WEEK / Older) still hides empty bookmark-only rows.
 */
/** Phosphor bookmark-simple, regular weight. Kept inline so /notes stays asset-free. */
function bookmarkSimpleIcon(): string {
  return `<svg class="bookmarks-summary-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M184 32H72a16 16 0 0 0-16 16v176a8 8 0 0 0 12.24 6.78L128 193.43l59.77 37.35A8 8 0 0 0 200 224V48a16 16 0 0 0-16-16m0 177.57l-51.77-32.35a8 8 0 0 0-8.48 0L72 209.57V48h112Z"/></svg>`;
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
  return `<details class="bookmarks-view" id="bookmarks-view"><summary><span class="bookmarks-summary-label">${bookmarkSimpleIcon()}<span>Bookmarks</span></span></summary><div class="bookmarks-panel">${body}</div></details>`;
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
        for (const n of list) html += noteRow(n);
        continue;
      }
      html += '<li class="note-bundle"><a class="note-bundle-name" href="/' + escape(slug) + '">' + escape(chapterTitle(list[0])) + '</a><span class="note-bundle-verses">' + verses + "</span></li>";
    }
    return html;
  }

  function chapterRow(ch) {
    const title = escape(ch.label || ch.slug);
    const excerpt = escape(ch.excerpt || "");
    const when = noteWhen({ updatedAt: ch.updatedAt });
    const stamp = when.getTime() ? when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
    const titleAttr = stamp ? ' title="' + escape(stamp) + '"' : "";
    return '<li><a class="note-row note-row-chapter" href="/' + escape(ch.slug) + '"' + titleAttr + '><span class="note-row-title">' + title + "</span>" +
      (excerpt ? '<span class="note-row-excerpt">' + excerpt + "</span>" : "") + "</a></li>";
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
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
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

  function prefetchChapter(href) {
    const slug = chapterSlugFromHref(href);
    if (!slug) return;
    if (!htmlCache.has(href)) {
      htmlCache.set(href, fetch(href, { credentials: "same-origin", headers: { accept: "text/html", purpose: "prefetch" } })
        .then((r) => r.ok ? r.text() : Promise.reject())
        .catch(() => { htmlCache.delete(href); return null; }));
    }
    prefetchChapterNotes(slug);
  }

  async function softNavTo(href, { push = true } = {}) {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin) { location.href = href; return; }
    const slug = chapterSlugFromHref(url.href);
    if (slug) prefetchChapterNotes(slug);
    const htmlPromise = htmlCache.get(url.href) || fetch(url.href, { credentials: "same-origin", headers: { accept: "text/html" } }).then((r) => {
      if (!r.ok) throw new Error("nav");
      return r.text();
    });
    htmlCache.set(url.href, htmlPromise);
    try {
      const html = await htmlPromise;
      if (!html) { location.href = href; return; }
      if (push) history.pushState({ soft: 1 }, "", url.pathname + url.search + url.hash);
      else history.replaceState({ soft: 1 }, "", url.pathname + url.search + url.hash);
      document.open();
      document.write(html);
      document.close();
    } catch {
      location.href = href;
    }
  }

  function isInboxChapterLink(a) {
    if (!a || !a.href) return false;
    // note-row (recent + Older chapter rows), starter chips, chapter-grid cells, reader back icon.
    if (a.classList?.contains("note-row")) return true;
    if (a.classList?.contains("note-bundle-name") || a.classList?.contains("note-bundle-verse")) return true;
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
    event.preventDefault();
    softNavTo(a.href, { push: true });
  });

  document.addEventListener("pointerenter", (event) => {
    const a = event.target?.closest?.("a.note-row[href], a.note-bundle-name[href], a.note-bundle-verse[href], a.starter-chip[href], a.chapter-grid-cell[href]");
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
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && grid && !grid.hidden) {
      setGridOpen(false);
      showChapterPane(currentBook);
    }
  });
})();`;
}
