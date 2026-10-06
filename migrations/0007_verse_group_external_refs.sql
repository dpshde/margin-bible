-- http(s) chips on a verse group. They are not verse members and not xrefs.
-- CI does not apply migrations. ensureVerseGroupsTable also adds this column.

ALTER TABLE verse_groups ADD COLUMN external_refs TEXT NOT NULL DEFAULT '[]';
