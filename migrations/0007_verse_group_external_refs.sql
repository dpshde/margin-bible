-- http(s) chips on a verse group. They are not verse members and not xrefs.
-- Safe to re-run. This file does not change the table shape. A new database gets
-- external_refs from 0005, and production already has the column. The UPDATE
-- matches no rows while the column is NOT NULL.

UPDATE verse_groups SET external_refs = '[]' WHERE external_refs IS NULL;
