-- Passphrase-bound libraries. Same identity_key ⇒ same library across browsers.
-- Anonymous (cookie-only) libraries keep identity_key NULL.

ALTER TABLE libraries ADD COLUMN identity_key TEXT;
ALTER TABLE libraries ADD COLUMN label TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS libraries_identity_key
  ON libraries (identity_key)
  WHERE identity_key IS NOT NULL;
