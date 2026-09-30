/** Rails-parity `Margin::LibrarySnapshot` (margin.library-snapshot v1). */

import type { NoteRecord } from "./library";

export const SNAPSHOT_FORMAT = "margin.library-snapshot";
export const SNAPSHOT_VERSION = 1;

export type SnapshotNote = {
  slug: string;
  osis: string;
  kind: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  bookmarked: boolean;
  source: string;
  agent_name: string | null;
  agent_color: string | null;
  blocks: NoteRecord["blocks"];
  attachments: NoteRecord["attachments"];
  created_at: string;
  updated_at: string;
};

export type LibrarySnapshot = {
  format: typeof SNAPSHOT_FORMAT;
  version: typeof SNAPSHOT_VERSION;
  exported_at: string;
  library: {
    last_read_slug: string | null;
    read_trail: string[];
  };
  notes: SnapshotNote[];
};

export function snapshotFilename(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `margin-notes-${y}${m}${d}.json`;
}

export function noteAsSnapshot(note: NoteRecord): SnapshotNote {
  return {
    slug: note.slug,
    osis: note.osis,
    kind: note.kind,
    book: note.book,
    chapter: note.chapter,
    verse_start: note.verseStart,
    verse_end: note.verseEnd,
    bookmarked: note.bookmarked,
    source: "human",
    agent_name: null,
    agent_color: null,
    blocks: note.blocks,
    attachments: note.attachments,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  };
}

/** Build a restoreable snapshot. Never includes identity keys or other libraries. */
export function buildLibrarySnapshot(input: {
  lastReadSlug: string | null;
  readTrail?: string[] | null;
  notes: NoteRecord[];
  now?: Date;
}): LibrarySnapshot {
  const now = input.now ?? new Date();
  const read_trail = Array.isArray(input.readTrail)
    ? input.readTrail.filter((s): s is string => typeof s === "string")
    : [];
  const notes = [...input.notes].sort(compareNotesForSnapshot).map(noteAsSnapshot);
  return {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    exported_at: now.toISOString(),
    library: {
      last_read_slug: input.lastReadSlug,
      read_trail,
    },
    notes,
  };
}

function compareNotesForSnapshot(a: NoteRecord, b: NoteRecord): number {
  if (a.book !== b.book) return a.book < b.book ? -1 : 1;
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  const av = a.verseStart ?? Number.POSITIVE_INFINITY;
  const bv = b.verseStart ?? Number.POSITIVE_INFINITY;
  if (av !== bv) return av - bv;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}
