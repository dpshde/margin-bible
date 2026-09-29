import { bodyText, noteCoversVerse, type Block, type NoteDraft } from "./notes";
import { parsePassage, passageLabel } from "./passage";

export type NoteRecord = NoteDraft & {
  createdAt: string;
  updatedAt: string;
};

type NoteSqlRow = {
  slug: string;
  osis: string;
  kind: NoteDraft["kind"];
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  blocks: string;
  created_at: string;
  updated_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readLibraryCookie(header: string | null): string | null {
  if (!header) return null;
  const match = /(?:^|;\s*)margin_library=([^;]+)/.exec(header);
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  return UUID.test(value) ? value : null;
}

export function libraryCookie(id: string, secure: boolean): string {
  const parts = [
    `margin_library=${id}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${60 * 60 * 24 * 400}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function ensureLibrary(db: D1Database, cookieId: string | null): Promise<{ id: string; fresh: boolean; lastReadSlug: string | null }> {
  if (cookieId) {
    const existing = await db
      .prepare("SELECT id, last_read_slug FROM libraries WHERE id = ?")
      .bind(cookieId)
      .first<{ id: string; last_read_slug: string | null }>();
    if (existing) return { id: existing.id, fresh: false, lastReadSlug: existing.last_read_slug };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO libraries (id, created_at, updated_at) VALUES (?, ?, ?)").bind(id, now, now).run();
  return { id, fresh: true, lastReadSlug: null };
}

export async function rememberRead(db: D1Database, libraryId: string, slug: string): Promise<void> {
  await db
    .prepare("UPDATE libraries SET last_read_slug = ?, updated_at = ? WHERE id = ?")
    .bind(slug, new Date().toISOString(), libraryId)
    .run();
}

export async function listNotes(
  db: D1Database,
  libraryId: string,
  filter?: { book?: string; chapter?: number; verse?: number },
): Promise<NoteRecord[]> {
  let sql = "SELECT slug, osis, kind, book, chapter, verse_start, verse_end, blocks, created_at, updated_at FROM notes WHERE library_id = ?";
  const binds: Array<string | number> = [libraryId];
  if (filter?.book && filter.chapter != null) {
    sql += " AND book = ? AND chapter = ?";
    binds.push(filter.book, filter.chapter);
  }
  sql += " ORDER BY book, chapter, verse_start IS NULL, verse_start, slug LIMIT 500";
  const result = await db.prepare(sql).bind(...binds).all<NoteSqlRow>();
  const notes = (result.results ?? []).map(rowToNote);
  if (filter?.verse == null) return notes;
  return notes.filter((note) => noteCoversVerse(note, filter.verse as number));
}

export async function findNote(db: D1Database, libraryId: string, slug: string): Promise<NoteRecord | null> {
  const row = await db
    .prepare(
      "SELECT slug, osis, kind, book, chapter, verse_start, verse_end, blocks, created_at, updated_at FROM notes WHERE library_id = ? AND slug = ?",
    )
    .bind(libraryId, slug)
    .first<NoteSqlRow>();
  return row ? rowToNote(row) : null;
}

export async function saveNote(db: D1Database, libraryId: string, note: NoteDraft): Promise<NoteRecord> {
  const now = new Date().toISOString();
  const blocks = JSON.stringify(note.blocks);
  await db
    .prepare(
      `INSERT INTO notes (
        library_id, slug, osis, kind, book, chapter, verse_start, verse_end, blocks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(library_id, slug) DO UPDATE SET
        osis = excluded.osis,
        kind = excluded.kind,
        book = excluded.book,
        chapter = excluded.chapter,
        verse_start = excluded.verse_start,
        verse_end = excluded.verse_end,
        blocks = excluded.blocks,
        updated_at = excluded.updated_at`,
    )
    .bind(
      libraryId,
      note.slug,
      note.osis,
      note.kind,
      note.book,
      note.chapter,
      note.verseStart,
      note.verseEnd,
      blocks,
      now,
      now,
    )
    .run();
  const saved = await findNote(db, libraryId, note.slug);
  if (!saved) throw new Error("note disappeared after save");
  return saved;
}

export async function deleteNote(db: D1Database, libraryId: string, slug: string): Promise<void> {
  await db.prepare("DELETE FROM notes WHERE library_id = ? AND slug = ?").bind(libraryId, slug).run();
}

export function noteJson(note: NoteRecord) {
  return {
    slug: note.slug,
    osis: note.osis,
    kind: note.kind,
    book: note.book,
    chapter: note.chapter,
    verseStart: note.verseStart,
    verseEnd: note.verseEnd,
    label: labelFor(note),
    text: bodyText(note.blocks),
    blocks: note.blocks,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function labelFor(note: NoteDraft): string {
  return parsePassage(note.slug) ? passageLabel(parsePassage(note.slug)!) : note.slug;
}

function rowToNote(row: NoteSqlRow): NoteRecord {
  return {
    slug: row.slug,
    osis: row.osis,
    kind: row.kind,
    book: row.book,
    chapter: row.chapter,
    verseStart: row.verse_start,
    verseEnd: row.verse_end,
    blocks: parseBlocks(row.blocks),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseBlocks(raw: string): Block[] {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const record = row as Record<string, unknown>;
      return [
        {
          id: typeof record.id === "string" ? record.id : "b_legacy",
          indent: Number(record.indent) || 0,
          text: typeof record.text === "string" ? record.text : "",
          bullet: record.bullet !== false,
        },
      ];
    });
  } catch {
    return [];
  }
}
