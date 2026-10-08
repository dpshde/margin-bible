-- Tiny hub-keyed name for a fan-in or star web.
-- Members stay on note xref chips. This row is only title, description, and
-- the last optional cross-link fill so undo does not guess.
-- CI does not apply migrations. The worker also CREATE TABLE IF NOT EXISTS
-- on use so a preview database picks this up without a manual migrate.
-- Re-running this file is a no-op when the table already exists.
-- Later columns live here too. Production already has this table from the
-- worker, so CREATE TABLE IF NOT EXISTS does not try to add them again.
-- TODO(pair): fold these rows into the library snapshot.

CREATE TABLE IF NOT EXISTS verse_groups (
  library_id TEXT NOT NULL,
  hub_slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  undo_json TEXT NOT NULL DEFAULT '[]',
  star_slug TEXT NOT NULL DEFAULT '',
  jev_title TEXT NOT NULL DEFAULT '',
  external_refs TEXT NOT NULL DEFAULT '[]',
  auto_titled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (library_id, hub_slug)
);
