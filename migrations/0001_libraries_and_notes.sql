-- Spike schema. Anonymous library cookie, then notes addressed by OSIS slug.
-- A verse note and a range note that covers it are two rows (different slugs).

CREATE TABLE IF NOT EXISTS libraries (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_read_slug TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  library_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  osis TEXT NOT NULL,
  kind TEXT NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse_start INTEGER,
  verse_end INTEGER,
  blocks TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (library_id, slug)
);

CREATE INDEX IF NOT EXISTS notes_by_chapter
  ON notes (library_id, book, chapter);
