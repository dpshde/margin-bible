-- One automatic title pass per verse group.
-- Safe to re-run. This file does not change the table shape. Production already
-- has auto_titled from the worker, and a repeated column add fails as a
-- duplicate. A new database gets the column from 0005. The UPDATE is the
-- one-time backfill and does not run on GET. Groups that already have a title
-- were named by hand or by the sparkle. Mark them so the first-pass auto title
-- does not overwrite them. A later manual edit must not clear the flag.

UPDATE verse_groups
SET auto_titled = 1
WHERE auto_titled = 0 AND trim(title) != '';
