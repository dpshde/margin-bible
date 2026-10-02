-- Session ids are the only browser credential. Library ids are not cookies.
-- Passphrase lookup is an HMAC. The slow hash is PBKDF2 with a per-library salt.

ALTER TABLE libraries ADD COLUMN passphrase_lookup TEXT;
ALTER TABLE libraries ADD COLUMN passphrase_salt TEXT;
ALTER TABLE libraries ADD COLUMN passphrase_hash TEXT;
ALTER TABLE libraries ADD COLUMN passphrase_iterations INTEGER;
ALTER TABLE libraries ADD COLUMN claim_token_hash TEXT;
ALTER TABLE libraries ADD COLUMN webauthn_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS libraries_passphrase_lookup
  ON libraries (passphrase_lookup)
  WHERE passphrase_lookup IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS libraries_claim_token
  ON libraries (claim_token_hash)
  WHERE claim_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_by_library ON sessions (library_id, expires_at);

CREATE TABLE IF NOT EXISTS auth_attempts (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_attempts_by_ip ON auth_attempts (ip, created_at);

CREATE TABLE IF NOT EXISTS passkey_credentials (
  credential_id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS passkeys_by_library ON passkey_credentials (library_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id TEXT PRIMARY KEY,
  library_id TEXT,
  challenge TEXT NOT NULL,
  kind TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
