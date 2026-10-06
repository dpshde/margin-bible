-- Tiny hub-keyed name for a fan-in or star web.
-- Members stay on note xref chips. This row is only title, description, and
-- the last optional cross-link fill so undo does not guess.
-- CI does not apply migrations. The worker also CREATE TABLE IF NOT EXISTS
-- on use so a preview database picks this up without a manual migrate.
-- TODO(pair): fold these rows into the library snapshot.

CREATE TABLE IF NOT EXISTS verse_groups (
  library_id TEXT NOT NULL,
  hub_slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  undo_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (library_id, hub_slug)
);
