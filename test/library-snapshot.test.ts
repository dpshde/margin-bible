import { describe, expect, test } from "bun:test";
import {
  buildLibrarySnapshot,
  noteAsSnapshot,
  SNAPSHOT_FORMAT,
  SNAPSHOT_VERSION,
  snapshotFilename,
} from "../src/library-snapshot";
import type { NoteRecord } from "../src/library";

function note(partial: Partial<NoteRecord> & Pick<NoteRecord, "slug" | "osis" | "kind" | "book" | "chapter">): NoteRecord {
  return {
    verseStart: null,
    verseEnd: null,
    blocks: [],
    bookmarked: false,
    attachments: [],
    createdAt: "2026-09-10T12:00:00.000Z",
    updatedAt: "2026-09-10T12:00:00.000Z",
    ...partial,
  };
}

describe("library snapshot", () => {
  test("filename is margin-notes-YYYYMMDD.json in UTC", () => {
    expect(snapshotFilename(new Date("2026-09-10T15:04:05.000Z"))).toBe("margin-notes-20260910.json");
    expect(snapshotFilename(new Date("2026-09-30T23:30:00.000Z"))).toBe("margin-notes-20260930.json");
  });

  test("builds margin.library-snapshot v1 without secrets", () => {
    const mine = note({
      slug: "jhn.1.1",
      osis: "JHN.1.1",
      kind: "verse",
      book: "JHN",
      chapter: 1,
      verseStart: 1,
      bookmarked: true,
      blocks: [{ id: "b_word", indent: 0, text: "Logos.", bullet: true }],
      attachments: [{ id: "att_abcd", kind: "xref", slug: "jhn.1.6", title: "John 1:6" }],
    });
    const later = note({
      slug: "heb.11.1",
      osis: "HEB.11.1",
      kind: "verse",
      book: "HEB",
      chapter: 11,
      verseStart: 1,
      blocks: [{ id: "b_faith", indent: 0, text: "Faith.", bullet: true }],
    });

    const snapshot = buildLibrarySnapshot({
      lastReadSlug: "jhn.1",
      readTrail: ["jhn.1", "heb.11"],
      notes: [later, mine],
      now: new Date("2026-09-10T15:04:05.000Z"),
    });

    expect(snapshot.format).toBe(SNAPSHOT_FORMAT);
    expect(snapshot.format).toBe("margin.library-snapshot");
    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(snapshot.version).toBe(1);
    expect(snapshot.exported_at).toBe("2026-09-10T15:04:05.000Z");
    expect(snapshot.library.last_read_slug).toBe("jhn.1");
    expect(snapshot.library.read_trail).toEqual(["jhn.1", "heb.11"]);
    expect(snapshot.notes.map((n) => n.slug)).toEqual(["heb.11.1", "jhn.1.1"]);

    const row = snapshot.notes[1];
    expect(row.osis).toBe("JHN.1.1");
    expect(row.kind).toBe("verse");
    expect(row.book).toBe("JHN");
    expect(row.chapter).toBe(1);
    expect(row.verse_start).toBe(1);
    expect(row.verse_end).toBeNull();
    expect(row.bookmarked).toBe(true);
    expect(row.source).toBe("human");
    expect(row.agent_name).toBeNull();
    expect(row.agent_color).toBeNull();
    expect(row.blocks[0].text).toBe("Logos.");
    expect(row.attachments[0].slug).toBe("jhn.1.6");
    expect(row.created_at).toBe("2026-09-10T12:00:00.000Z");

    const raw = JSON.stringify(snapshot);
    expect(raw).not.toContain("identity_key");
    expect(raw).not.toContain("claim_token");
    expect(raw).not.toContain("passphrase");
  });

  test("empty library still has the envelope shape", () => {
    const snapshot = buildLibrarySnapshot({
      lastReadSlug: null,
      notes: [],
      now: new Date("2026-09-30T10:00:00.000Z"),
    });
    expect(snapshot.library).toEqual({ last_read_slug: null, read_trail: [] });
    expect(snapshot.notes).toEqual([]);
  });

  test("noteAsSnapshot uses snake_case Rails keys", () => {
    const row = noteAsSnapshot(
      note({
        slug: "jhn.3.16-18",
        osis: "JHN.3.16-18",
        kind: "range",
        book: "JHN",
        chapter: 3,
        verseStart: 16,
        verseEnd: 18,
      }),
    );
    expect(row).toMatchObject({
      verse_start: 16,
      verse_end: 18,
      created_at: "2026-09-10T12:00:00.000Z",
      updated_at: "2026-09-10T12:00:00.000Z",
    });
    expect("verseStart" in row).toBe(false);
  });
});

describe("export auth gate helpers", () => {
  test("signed-in profile alone exposes Download notes → /export", async () => {
    const { renderLoginPage } = await import("../src/login-page");
    const { renderChapterPage } = await import("../src/reader-page");
    const { parsePassage } = await import("../src/passage");

    const profile = renderLoginPage({ signedIn: true, next: "/jhn.3" });
    expect(profile).toContain('href="/export"');
    expect(profile).toContain("Download notes");
    expect(profile).toContain("export-link");

    const guestProfile = renderLoginPage({ signedIn: false });
    expect(guestProfile).not.toContain('href="/export"');
    expect(guestProfile).not.toContain("Download notes");

    const chapter = renderChapterPage({
      passage: parsePassage("jhn.3")!,
      pack: { book: "JHN", chapter: 3, title: "John 3", verses: [{ n: 1, text: "Now" }], headings: [] },
      notes: [],
      signedIn: true,
    });
    expect(chapter).toContain('aria-label="Profile"');
    expect(chapter).toContain('href="/login?next=%2Fjhn.3"');
    expect(chapter).not.toContain('class="topbar-menu auth-menu"');
    expect(chapter).not.toContain('href="/export"');
    expect(chapter).not.toContain("Download notes");

    const guestChapter = renderChapterPage({
      passage: parsePassage("jhn.3")!,
      pack: { book: "JHN", chapter: 3, title: "John 3", verses: [{ n: 1, text: "Now" }], headings: [] },
      notes: [],
      signedIn: false,
    });
    expect(guestChapter).not.toContain('href="/export"');
    expect(guestChapter).not.toContain("Download notes");
  });
});
