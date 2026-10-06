-- One automatic title pass per verse group.
-- CI does not apply migrations. The worker also ALTER TABLE on use, then
-- backfills this flag, so a preview database picks it up without a manual migrate.
-- Groups that already have a title were named by hand or by the sparkle.
-- Mark them so the first-pass auto title does not overwrite them.
-- A later manual edit must not clear the flag.

ALTER TABLE verse_groups ADD COLUMN auto_titled INTEGER NOT NULL DEFAULT 0;

UPDATE verse_groups
SET auto_titled = 1
WHERE auto_titled = 0 AND trim(title) != '';
