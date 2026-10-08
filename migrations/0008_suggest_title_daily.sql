-- One counter per library and per IP for paid suggest-title calls, per UTC day.
-- The worker also CREATE TABLE IF NOT EXISTS on the suggest-title write path
-- so a preview database picks this up without a manual migrate.
-- Re-running this file is a no-op when the table already exists.
-- This is not a guest-library garbage collector.

CREATE TABLE IF NOT EXISTS suggest_title_usage (
  actor TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (actor, day)
);
