-- Bookmarks and attachment chips (xref + url), matching Rails notes columns.
ALTER TABLE notes ADD COLUMN bookmarked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS notes_by_bookmarked
  ON notes (library_id, bookmarked)
  WHERE bookmarked = 1;
