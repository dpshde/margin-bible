import { describe, expect, test } from "bun:test";
import {
  groupNotesByWeek,
  groupInboxNotes,
  notesListHtml,
  weekLabel,
  startOfWeek,
  chapterSlugOfNote,
  chapterTitleFromNote,
  isVerseLevelSlug,
  olderSectionHtml,
  humanNoteLabel,
  olderChapterMeta,
  notesInboxScript,
  bookmarksViewHtml,
  inboxNoteExcerpt,
  noteHasInboxBody,
} from "../src/inbox-ui";
import { jumpFormHtml } from "../src/jump-ui";
import { renderNotesIndex } from "../src/reader-page";
import { page } from "../src/html";

describe("inbox side rails", () => {
  const css = page("t", "<p>x</p>");

  test("keeps week sections and bookmark rows lightly encapsulated", () => {
    expect(css).toContain("border-left: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);");
    expect(css).toContain("border-right: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);");
    expect(css).toContain(".note-week {");
    expect(css).toContain("not a stack of cards");
    expect(css).not.toContain(".bookmarks-panel .note-list {\n      padding-inline: .45rem;");
  });
});

describe("inbox week grouping", () => {
  test("labels this week / last week / range", () => {
    const now = new Date("2026-09-29T15:00:00"); // Tuesday
    const thisWeek = startOfWeek(now);
    const lastWeek = new Date(thisWeek);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const older = new Date(thisWeek);
    older.setDate(older.getDate() - 14);
    expect(weekLabel(thisWeek, now)).toBe("This week");
    expect(weekLabel(lastWeek, now)).toBe("Last week");
    expect(weekLabel(older, now)).toMatch(/Sep /);
  });

  test("groups newest week first; within week newest first", () => {
    const now = new Date("2026-09-29T15:00:00");
    const notes = [
      { slug: "a", label: "A", excerpt: "old", updatedAt: "2026-09-10T12:00:00Z" },
      { slug: "b", label: "B", excerpt: "this-early", updatedAt: "2026-09-28T10:00:00Z" },
      { slug: "c", label: "C", excerpt: "this-late", updatedAt: "2026-09-29T12:00:00Z" },
      { slug: "d", label: "D", excerpt: "last", updatedAt: "2026-09-22T12:00:00Z" },
    ];
    const sections = groupNotesByWeek(notes, now);
    expect(sections[0].label).toBe("This week");
    expect(sections[0].notes.map((n) => n.slug)).toEqual(["c", "b"]);
    expect(sections[1].label).toBe("Last week");
    expect(sections[1].notes[0].slug).toBe("d");
    expect(sections[2].notes[0].slug).toBe("a");
  });

  test("notesListHtml emits week headers", () => {
    const html = notesListHtml([
      { slug: "jhn.1.1", label: "John 1:1", excerpt: "hi", updatedAt: new Date().toISOString() },
      { slug: "2co.12.8-9", label: "2 Corinthians 12:8–9", excerpt: "grace", updatedAt: new Date().toISOString() },
      { slug: "jos.8", label: "Joshua 8", excerpt: "chapter question", updatedAt: new Date().toISOString() },
    ]);
    expect(html).toContain("note-week-label");
    expect(html).toContain("This week");
    expect(html).toContain('aria-label="John 1:1"');
    expect(html).toContain(">1</a>");
    expect(html).not.toContain(">John 1:1<");
    expect(html).toContain('aria-label="2 Corinthians 12:8–9"');
    expect(html).toContain(">8–9</a>");
    expect(html).not.toContain(">2 Corinthians 12:8–9<");
    expect(html).toContain(">Joshua 8<");
    expect(html).toContain("chapter question");
    expect(html).toContain('class="note-bundle-name" href="/jos.8?chapter_note=1"');
    expect(html).toContain('class="note-bundle-open" href="/jos.8"');
    expect(html).toContain('class="note-bundle-name" href="/jhn.1?chapter_note=1"');
  });
});

describe("bookmark card polish", () => {
  test("keeps only Bookmarks title and collapse control; long previews use row markup", () => {
    const longExcerpt = "Hebrews 12 " + "a long paragraph that should stay bounded in the bookmark row. ".repeat(20);
    const html = bookmarksViewHtml([
      { slug: "heb.12.1", label: "Hebrews 12:1", excerpt: longExcerpt, bookmarked: true, updatedAt: "2026-09-30T12:00:00Z" },
    ]);
    expect(html).toContain('class="bookmarks-summary-label"');
    expect(html).toContain('class="bookmarks-summary-icon"');
    expect(html).toContain(">Bookmarks</span>");
    expect(html).not.toContain("bookmarks-count");
    expect(html).toContain('class="note-row-excerpt"');
    expect(html).toContain(longExcerpt.replace(/\s+/g, " ").trim());
  });

  test("Bookmarks uses icon + soft wash, not THIS WEEK twin / heavy card", () => {
    const css = page("t", "<p>x</p>");
    expect(css).toContain(".bookmarks-view {\n      margin: 0 0 1rem;\n      padding: .35rem .45rem .4rem;\n      border-radius: .55rem;\n      background: var(--fill);");
    expect(css).toContain(".bookmarks-summary-icon");
    expect(css).toContain(".bookmarks-view > summary::after { content: \"＋\"; display: inline-flex; align-items: center; justify-content: center; min-width: 1.35rem; min-height: 1.35rem; padding: .1rem .2rem;");
    expect(css).toContain("color: var(--ink-soft);");
    // Week sections use inverted filled bars as clear dividers.
    expect(css).not.toContain(".bookmarks-view {\n      margin: 0 0 1rem;\n    }");
    expect(css).not.toContain("border-left: 2px solid color-mix(in srgb, var(--ink-soft) 22%, transparent)");
    expect(css).toContain(".note-week-label {\n      display: flex; align-items: center;\n      margin: 0; padding: .35rem .55rem;");
    expect(css).toContain("border-radius: 0;");
    expect(css).toContain(".note-week .note-list li:first-child { border-top: 0; }");
    expect(css).toContain("display: flex; align-items: baseline; gap: .5rem; min-width: 0;");
    expect(css).toContain(".note-row-title {\n      flex: none; max-width: 100%;\n      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;");
    expect(css).toContain(".note-row-excerpt {\n      min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;");
    expect(css).not.toContain("-webkit-line-clamp");
    expect(css).toContain(".note-week .note-row {\n      padding-inline: .65rem;");
    expect(css).toContain("border-radius: 0;");
    expect(css).toContain("background: var(--ink); color: var(--paper);");
    expect(css).toContain("text-transform: uppercase;");
    expect(css).toContain(".bookmarks-panel .note-list .note-row { border-radius: .35rem; }");
    expect(css).toContain(".bookmarks-panel .note-list .note-row:hover");
    expect(css).toContain("background: var(--paper-raised);");
  });

  test("inbox typography: stronger titles, quieter previews, clearer section labels", () => {
    const css = page("t", "<p>x</p>");
    expect(css).toContain("font-weight: 700; font-size: .95rem");
    expect(css).toContain("color: var(--faint); font-size: .78rem");
    expect(css).toContain("letter-spacing: .08em; text-transform: uppercase");
    expect(css).toContain("color: var(--ink-soft);");
    // Typography only — no layout redesign markers.
    expect(css).not.toContain(".note-row { display: grid");
  });

  test("bookmark rows are plain links, with no verse hover popover", () => {
    const html = bookmarksViewHtml([
      { slug: "2co.12.7-9", label: "2 Corinthians 12:7–9", excerpt: "grace", bookmarked: true, updatedAt: "2026-09-30T12:00:00Z" },
      { slug: "rom.9.17", label: "Romans 9:17", excerpt: "", bookmarked: true, updatedAt: "2026-09-30T12:00:00Z" },
      { slug: "heb.12", label: "Hebrews 12", excerpt: "chapter note", bookmarked: true, updatedAt: "2026-09-30T12:00:00Z" },
    ]);
    expect(html).toContain('class="note-row" href="/2co.12.7-9"');
    expect(html).toContain('class="note-row" href="/rom.9.17"');
    expect(html).toContain('class="note-row" href="/heb.12"');
    expect(html).not.toContain("note-row-verse");
    const css = page("t", "<p>x</p>");
    expect(css).not.toContain("bookmark-verse-popup");
    const script = notesInboxScript();
    expect(script).not.toContain("bookmarkVersePopup");
    expect(script).not.toContain("bookmark-verse-popup");
  });
});

describe("bookmark-only inbox filtering", () => {
  test("empty bookmarks stay out of notes feed but appear under Bookmarks", () => {
    const empty = {
      slug: "rom.5.3-5",
      label: "Romans 5:3–5",
      excerpt: "",
      bookmarked: true,
      updatedAt: "2026-09-30T12:00:00Z",
    };
    // Notes list (THIS WEEK / Older): still hide empty bookmark-only.
    expect(notesListHtml([empty])).toContain("No notes yet");
    expect(notesListHtml([empty])).not.toContain('href="/rom.5.3-5"');
    // Bookmarks section: show any bookmarked note, even empty/bullet-only ranges.
    const bmEmpty = bookmarksViewHtml([empty]);
    expect(bmEmpty).toContain('href="/rom.5.3-5"');
    expect(bmEmpty).toContain("Romans 5:3–5");
    expect(bmEmpty).not.toContain("No bookmarks yet.");

    const withBody = { ...empty, excerpt: "We rejoice in suffering" };
    const html = notesListHtml([empty, withBody]);
    expect(html).toContain('href="/rom.5.3-5"');
    expect(bookmarksViewHtml([empty, withBody])).toContain('href="/rom.5.3-5"');
  });

  test("verse and range bookmarks appear in Bookmarks (empty or with body)", () => {
    const verse = {
      slug: "rom.5.3",
      label: "Romans 5:3",
      excerpt: "rejoice in our sufferings",
      bookmarked: true,
      updatedAt: "2026-09-30T12:00:00Z",
    };
    const range = {
      slug: "rom.5.3-5",
      label: "Romans 5:3–5",
      excerpt: "",
      bookmarked: true,
      updatedAt: "2026-09-30T12:00:00Z",
    };
    const bm = bookmarksViewHtml([verse, range]);
    expect(bm).toContain('href="/rom.5.3"');
    expect(bm).toContain('href="/rom.5.3-5"');
    expect(bm).toContain("Romans 5:3–5");
    expect(bm).toContain("rejoice in our sufferings");
    expect(bm).not.toContain("No bookmarks yet.");
  });

  test("API-shaped notes (text/blocks, empty excerpt) still count as body", () => {
    const fromText = {
      slug: "rom.5.3-5",
      label: "Romans 5:3–5",
      excerpt: "",
      text: "We rejoice in our sufferings",
      bookmarked: true,
      updatedAt: "2026-09-30T12:00:00Z",
    };
    const fromBlocks = {
      slug: "jhn.3.16",
      label: "John 3:16",
      excerpt: "",
      blocks: [{ indent: 0, text: "For God so loved the world" }],
      bookmarked: true,
      updatedAt: "2026-09-30T12:00:00Z",
    };
    expect(noteHasInboxBody(fromText)).toBe(true);
    expect(inboxNoteExcerpt(fromText)).toBe("We rejoice in our sufferings");
    expect(noteHasInboxBody(fromBlocks)).toBe(true);
    expect(bookmarksViewHtml([fromText as any, fromBlocks as any])).toContain('href="/rom.5.3-5"');
    expect(bookmarksViewHtml([fromText as any, fromBlocks as any])).toContain('href="/jhn.3.16"');
  });
});

describe("inbox recent weeks + older chapter bundles", () => {
  test("chapterSlugOfNote strips verse/range", () => {
    expect(chapterSlugOfNote("jhn.3.16")).toBe("jhn.3");
    expect(chapterSlugOfNote("jhn.3.16-18")).toBe("jhn.3");
    expect(chapterSlugOfNote("ROM.8")).toBe("rom.8");
  });

  test("chapterTitleFromNote drops verse suffix", () => {
    expect(chapterTitleFromNote({ slug: "jhn.3.16", label: "John 3:16", excerpt: "" })).toBe("John 3");
    expect(chapterTitleFromNote({ slug: "jhn.3.16-18", label: "John 3:16–18", excerpt: "" })).toBe("John 3");
    expect(chapterTitleFromNote({ slug: "rom.8", label: "Romans 8", excerpt: "" })).toBe("Romans 8");
  });

  test("last 14 days stay individual week rows; older bundle by chapter", () => {
    const now = new Date("2026-09-30T12:00:00");
    const notes = [
      { slug: "jhn.3.16", label: "John 3:16", excerpt: "fresh", updatedAt: "2026-09-29T12:00:00Z" },
      { slug: "jhn.3.17", label: "John 3:17", excerpt: "also-fresh", updatedAt: "2026-09-28T12:00:00Z" },
      { slug: "rom.8.28", label: "Romans 8:28", excerpt: "last-weekish", updatedAt: "2026-09-22T12:00:00Z" },
      { slug: "heb.12.1", label: "Hebrews 12:1", excerpt: "old-a", updatedAt: "2026-09-01T12:00:00Z" },
      { slug: "heb.12.2", label: "Hebrews 12:2", excerpt: "old-b", updatedAt: "2026-08-20T12:00:00Z" },
      { slug: "deu.6.4", label: "Deuteronomy 6:4", excerpt: "older-alone", updatedAt: "2026-07-01T12:00:00Z" },
    ];
    const sections = groupInboxNotes(notes, now);
    expect(sections[0].kind).toBe("week");
    if (sections[0].kind !== "week") throw new Error("expected week");
    expect(sections[0].notes.map((n) => n.slug)).toEqual(["jhn.3.16", "jhn.3.17"]);
    // rom.8.28 is within 14 days of Sep 30 (Sep 22) → week section, not Older
    const weekSlugs = sections
      .filter((s) => s.kind === "week")
      .flatMap((s) => (s.kind === "week" ? s.notes.map((n) => n.slug) : []));
    expect(weekSlugs).toContain("rom.8.28");
    expect(weekSlugs).not.toContain("heb.12.1");

    const older = sections.find((s) => s.kind === "older");
    expect(older).toBeTruthy();
    if (!older || older.kind !== "older") throw new Error("expected older");
    expect(older.label).toBe("Older");
    expect(older.chapters.map((c) => c.slug)).toEqual(["heb.12", "deu.6"]);
    expect(older.chapters[0].label).toBe("Hebrews 12");
    expect(older.chapters[0].notes).toHaveLength(2);
    expect(older.chapters[0].excerpt).toBe("2 notes");
    expect(older.chapters[1].excerpt).toBe("1 note");

    const html = notesListHtml(notes, now);
    expect(html).toContain("John 3:16");
    expect(html).toContain('aria-label="Romans 8:28"');
    expect(html).toContain(">28</a>");
    expect(html).not.toContain(">Romans 8:28<");
    expect(html).toContain(">Older<");
    expect(html).toContain('href="/heb.12"');
    expect(html).toContain("Hebrews 12");
    expect(html).toContain("note-row-chapter");
    expect(html).not.toContain("Hebrews 12:1");
    expect(html).not.toContain('href="/heb.12.1"');
  });


  test("Dylan-shaped Romans 6 Sep 15 notes bundle under Older on Sep 30", () => {
    const now = new Date("2026-09-30T14:54:00Z");
    const notes = [
      { slug: "rom.6.18", label: "Romans 6:18", excerpt: "slaves", updatedAt: "2026-09-15T16:01:43Z" },
      { slug: "rom.6.12", label: "Romans 6:12", excerpt: "body", updatedAt: "2026-09-15T15:56:35Z" },
      { slug: "rom.6.11", label: "Romans 6:11", excerpt: "alive", updatedAt: "2026-09-15T15:56:03Z" },
      { slug: "luk.16.25", label: "Luke 16:25", excerpt: "recent", updatedAt: "2026-09-20T14:32:54Z" },
      { slug: "heb.12.1", label: "Hebrews 12:1", excerpt: "witnesses", updatedAt: "2026-09-03T02:25:31Z" },
    ];
    const html = notesListHtml(notes, now);
    expect(html).toContain(">Older<");
    expect(html).toContain("note-row-chapter");
    expect(html).toContain('href="/rom.6"');
    expect(html).toContain(">Romans 6<");
    expect(html).toContain(">3 notes<");
    expect(html).not.toContain("3 notes ·");
    expect(html).not.toContain('href="/rom.6.18"');
    expect(html).not.toContain('href="/rom.6.12"');
    expect(html).not.toContain('href="/rom.6.11"');
    expect(html).not.toContain(">Romans 6:18<");
    // A lone recent verse is still a card, not a full citation row.
    expect(html).toContain('href="/luk.16.25"');
    expect(html).toContain('aria-label="Luke 16:25"');
    expect(html).toContain(">25</a>");
    expect(html).not.toContain(">Luke 16:25<");
  });

  test("chapterTitleFromNote prefers human title even when label is raw OSIS", () => {
    expect(chapterTitleFromNote({ slug: "rom.6.18", label: "rom.6.18", excerpt: "" })).toBe("Romans 6");
    expect(chapterTitleFromNote({ slug: "heb.12.1", label: "heb.12.1", excerpt: "" })).toBe("Hebrews 12");
  });

  test("Older HTML is one row per chapter (not verse wall)", () => {
    const now = new Date("2026-09-30T12:00:00");
    const notes = [
      { slug: "rom.6.18", label: "rom.6.18", excerpt: "a", updatedAt: "2026-08-01T12:00:00Z" },
      { slug: "rom.6.12", label: "rom.6.12", excerpt: "b", updatedAt: "2026-08-02T12:00:00Z" },
      { slug: "rom.6.11", label: "rom.6.11", excerpt: "c", updatedAt: "2026-08-03T12:00:00Z" },
      { slug: "heb.12.1", label: "heb.12.1", excerpt: "d", updatedAt: "2026-07-01T12:00:00Z" },
    ];
    const html = notesListHtml(notes, now);
    expect(html).toContain(">Older<");
    expect(html).toContain("Romans 6");
    expect(html).toContain("Hebrews 12");
    expect(html).toContain('href="/rom.6"');
    expect(html).toContain('href="/heb.12"');
    expect(html).not.toContain('href="/rom.6.18"');
    expect(html).not.toContain('href="/rom.6.12"');
    expect(html).not.toContain(">rom.6.18<");
    expect(html).toContain(">3 notes<");
    expect(html).not.toContain("3 notes ·");
    expect(html).toContain(">1 note<");
    const older = olderSectionHtml(html);
    expect(older).not.toMatch(/note-row-title">[a-z0-9]+\.\d+\.\d+/i);
  });

  test("dateless notes treat as Older and still chapter-bundle", () => {
    const now = new Date("2026-09-30T12:00:00");
    const notes = [
      { slug: "rom.6.18", label: "rom.6.18", excerpt: "a" },
      { slug: "rom.6.12", label: "rom.6.12", excerpt: "b" },
      { slug: "heb.12.29", label: "heb.12.29", excerpt: "c" },
    ];
    const sections = groupInboxNotes(notes, now);
    expect(sections).toHaveLength(1);
    expect(sections[0].kind).toBe("older");
    if (sections[0].kind !== "older") throw new Error("expected older");
    expect(sections[0].chapters.map((c) => c.slug)).toEqual(["rom.6", "heb.12"]);
    expect(sections[0].chapters.every((c) => !isVerseLevelSlug(c.slug))).toBe(true);
    const html = notesListHtml(notes, now);
    const older = olderSectionHtml(html);
    expect(older).toContain(">Romans 6<");
    expect(older).toContain(">Hebrews 12<");
    expect(older).not.toMatch(/href="\/[a-z0-9]+\.\d+\.\d+/i);
    expect(older).not.toContain(">rom.6.18<");
  });

  test("Older HTML has no verse-level note-row slug (regression)", () => {
    const now = new Date("2026-09-30T15:00:00Z");
    const notes = [
      { slug: "rom.6.18", label: "rom.6.18", excerpt: "slaves", updatedAt: "2026-09-15T16:01:43Z" },
      { slug: "rom.6.12", label: "rom.6.12", excerpt: "body", updatedAt: "2026-09-15T15:56:35Z" },
      { slug: "luk.16.9", label: "luk.16.9", excerpt: "treasure", updatedAt: "2026-09-13T13:04:36Z" },
      { slug: "heb.12.29", label: "heb.12.29", excerpt: "fire", updatedAt: "2026-09-10T14:42:50Z" },
      { slug: "luk.16", label: "Luke 16", excerpt: "chapter", updatedAt: "2026-09-20T14:48:36Z" },
      { slug: "luk.16.25", label: "Luke 16:25", excerpt: "remember", updatedAt: "2026-09-20T14:32:54Z" },
    ];
    const html = notesListHtml(notes, now);
    const older = olderSectionHtml(html);
    expect(older).toContain("note-week-older");
    // Every Older row is chapter-keyed — never /book.ch.verse
    expect(older).not.toMatch(/class="note-row"[^>]*href="\/[a-z0-9]+\.\d+\.\d+/i);
    expect(older).not.toMatch(/href="\/[a-z0-9]+\.\d+\.\d+/i);
    const hrefs = [...older.matchAll(/href="\/([^"]+)"/g)].map((m) => m[1].split("?")[0]);
    expect(older).toContain('href="/rom.6?chapter_note=1"');
    expect(older).toContain('class="note-bundle-open" href="/rom.6"');
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(isVerseLevelSlug(href)).toBe(false);
      expect(href).toMatch(/^[a-z0-9]+\.\d+$/i);
    }
    expect(older).toContain(">Romans 6<");
    expect(older).toContain(">Hebrews 12<");
    expect(older).not.toContain(">rom.6.18<");
    expect(older).not.toContain(">luk.16.9<");
    expect(older).not.toContain(">heb.12.29<");
    // Last week: the chapter name once, the verse as a number card.
    // The full citation stays on the card's aria-label.
    expect(html).toContain(">Luke 16<");
    expect(html).toContain('class="note-bundle-verse" href="/luk.16.25" aria-label="Luke 16:25"');
    expect(html).toContain(">25</a>");
    expect(html).not.toContain(">Luke 16:25<");
  });



  test("notesInboxScript never paints over SSR mount", () => {
    const src = notesInboxScript();
    expect(src).toContain("margin_inbox_v4");
    expect(src).toContain("Never overwrite");
    expect(src).not.toContain("mount.innerHTML = rowsHtml");
    expect(src).not.toContain("paint(mirrored)");
    expect(src).not.toContain("if (html !== painted) mount.innerHTML");
  });

  test("olderChapterMeta is count-only", () => {
    expect(olderChapterMeta(1)).toBe("1 note");
    expect(olderChapterMeta(3)).toBe("3 notes");
    expect(olderChapterMeta(0)).toBe("0 notes");
  });

    test("humanNoteLabel never returns raw OSIS", () => {
    expect(humanNoteLabel({ slug: "rom.6.18", label: "rom.6.18", excerpt: "" })).toBe("Romans 6:18");
    expect(humanNoteLabel({ slug: "rom.6.18", label: "Romans 6:18", excerpt: "" })).toBe("Romans 6:18");
    expect(isVerseLevelSlug("rom.6.18")).toBe(true);
    expect(isVerseLevelSlug("rom.6")).toBe(false);
  });
});

describe("jump form polish", () => {
  test("no Open submit button; has custom clear", () => {
    const html = jumpFormHtml();
    expect(html).not.toContain("Open");
    expect(html).not.toContain('type="submit"');
    expect(html).toContain("jump-clear");
    expect(html).toContain("jump-input-row");
    expect(html).toContain("jump-field");
  });

  test("notes index SSR has weeks and no Open", () => {
    const html = renderNotesIndex(
      [
        {
          slug: "jhn.1.1",
          kind: "verse",
          verseStart: 1,
          verseEnd: 1,
          blocks: [{ id: "b1", indent: 0, text: "In the beginning", bullet: true }],
          bookmarked: false,
          updatedAt: new Date().toISOString(),
        } as any,
      ],
      "jhn.1",
    );
    expect(html).toContain("note-week-label");
    expect(html).toContain("jump-clear");
    expect(html).not.toMatch(/>Open</);
    expect(html).not.toContain('class="tray-head"');
    expect(html).toContain('class="starter-chip"');
    expect(html).toContain('class="note-week"');
  });

  test("notes title is a chapter-grid picker seeded from backSlug", () => {
    const html = renderNotesIndex([], "rom.5");
    expect(html).toContain('id="chapter-grid-title"');
    expect(html).toContain(">Notes</button>");
    expect(html).toContain('id="chapter-grid"');
    expect(html).toContain('id="books-meta"');
    expect(html).toContain('href="/rom.5"');
    expect(html).toContain("data-chapter-nav");
    const script = notesInboxScript();
    expect(script).toContain("Chapter grid (Notes title picker");
    expect(script).toContain("chapter-grid-cell");
    expect(script).toContain("isInboxChapterLink");
  });
});
