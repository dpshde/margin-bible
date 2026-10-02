import { newSessionId, SESSION_MAX_AGE_SEC } from "./auth";

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export type BoundLibrary = {
  id: string;
  label: string | null;
  salt: string;
  hash: string;
  iterations: number;
};

export type CurrentLibrary = {
  id: string;
  bound: boolean;
  noteCount: number;
  label: string | null;
  webauthnUserId: string | null;
};

export async function createGuestLibrary(db: D1Database, now = new Date()): Promise<string> {
  const id = crypto.randomUUID();
  const iso = now.toISOString();
  await db.prepare("INSERT INTO libraries (id, created_at, updated_at) VALUES (?, ?, ?)").bind(id, iso, iso).run();
  return id;
}

export async function readCurrentLibrary(db: D1Database, libraryId: string): Promise<CurrentLibrary | null> {
  const row = await db
    .prepare(
      `SELECT l.id, l.label, l.passphrase_lookup, l.webauthn_user_id,
              (SELECT COUNT(*) FROM notes n WHERE n.library_id = l.id) AS note_count
       FROM libraries l WHERE l.id = ?`,
    )
    .bind(libraryId)
    .first<{
      id: string;
      label: string | null;
      passphrase_lookup: string | null;
      webauthn_user_id: string | null;
      note_count: number;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    bound: Boolean(row.passphrase_lookup),
    noteCount: Number(row.note_count) || 0,
    label: row.label,
    webauthnUserId: row.webauthn_user_id,
  };
}

export async function findLibraryByLookup(db: D1Database, lookup: string): Promise<BoundLibrary | null> {
  const row = await db
    .prepare(
      `SELECT id, label, passphrase_salt, passphrase_hash, passphrase_iterations
       FROM libraries WHERE passphrase_lookup = ?`,
    )
    .bind(lookup)
    .first<{
      id: string;
      label: string | null;
      passphrase_salt: string | null;
      passphrase_hash: string | null;
      passphrase_iterations: number | null;
    }>();
  if (!row?.passphrase_salt || !row.passphrase_hash || !row.passphrase_iterations) return null;
  return {
    id: row.id,
    label: row.label,
    salt: row.passphrase_salt,
    hash: row.passphrase_hash,
    iterations: row.passphrase_iterations,
  };
}

export async function findLibraryByClaim(
  db: D1Database,
  claimHash: string,
): Promise<{ id: string; bound: boolean } | null> {
  const row = await db
    .prepare("SELECT id, passphrase_lookup FROM libraries WHERE claim_token_hash = ?")
    .bind(claimHash)
    .first<{ id: string; passphrase_lookup: string | null }>();
  if (!row) return null;
  return { id: row.id, bound: Boolean(row.passphrase_lookup) };
}

export async function bindPassphrase(
  db: D1Database,
  libraryId: string,
  fields: { lookup: string; salt: string; hash: string; iterations: number; label: string | null },
  now = new Date(),
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE libraries
       SET passphrase_lookup = ?, passphrase_salt = ?, passphrase_hash = ?, passphrase_iterations = ?,
           label = COALESCE(?, label), claim_token_hash = NULL, updated_at = ?
       WHERE id = ? AND passphrase_lookup IS NULL`,
    )
    .bind(fields.lookup, fields.salt, fields.hash, fields.iterations, fields.label, now.toISOString(), libraryId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function replacePassphrase(
  db: D1Database,
  libraryId: string,
  currentLookup: string,
  fields: { lookup: string; salt: string; hash: string; iterations: number },
  now = new Date(),
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE libraries
       SET passphrase_lookup = ?, passphrase_salt = ?, passphrase_hash = ?, passphrase_iterations = ?, updated_at = ?
       WHERE id = ? AND passphrase_lookup = ?`,
    )
    .bind(
      fields.lookup,
      fields.salt,
      fields.hash,
      fields.iterations,
      now.toISOString(),
      libraryId,
      currentLookup,
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function insertBoundLibrary(
  db: D1Database,
  fields: { lookup: string; salt: string; hash: string; iterations: number; label: string | null },
  now = new Date(),
): Promise<string> {
  const id = crypto.randomUUID();
  const iso = now.toISOString();
  await db
    .prepare(
      `INSERT INTO libraries (
         id, created_at, updated_at, label, passphrase_lookup, passphrase_salt, passphrase_hash, passphrase_iterations
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, iso, iso, fields.label, fields.lookup, fields.salt, fields.hash, fields.iterations)
    .run();
  return id;
}

export async function copyNotes(db: D1Database, fromId: string, toId: string): Promise<void> {
  if (fromId === toId) return;
  await db
    .prepare(
      `INSERT INTO notes (
         library_id, slug, osis, kind, book, chapter, verse_start, verse_end,
         blocks, bookmarked, attachments, created_at, updated_at
       )
       SELECT ?, slug, osis, kind, book, chapter, verse_start, verse_end,
              blocks, bookmarked, attachments, created_at, updated_at
       FROM notes
       WHERE library_id = ?
         AND slug NOT IN (SELECT slug FROM notes WHERE library_id = ?)`,
    )
    .bind(toId, fromId, toId)
    .run();
}

export async function deleteUnboundLibrary(db: D1Database, libraryId: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM notes WHERE library_id = ?").bind(libraryId),
    db.prepare("DELETE FROM sessions WHERE library_id = ?").bind(libraryId),
    db.prepare("DELETE FROM passkey_credentials WHERE library_id = ?").bind(libraryId),
    db.prepare("DELETE FROM webauthn_challenges WHERE library_id = ?").bind(libraryId),
    db.prepare("DELETE FROM libraries WHERE id = ? AND passphrase_lookup IS NULL").bind(libraryId),
  ]);
}

export async function createSession(db: D1Database, libraryId: string, now = new Date()): Promise<string> {
  const id = newSessionId();
  const expires = new Date(now.getTime() + SESSION_MAX_AGE_SEC * 1000).toISOString();
  await db
    .prepare("INSERT INTO sessions (id, library_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(id, libraryId, now.toISOString(), expires)
    .run();
  return id;
}

export async function readSession(
  db: D1Database,
  sessionId: string,
  now = new Date(),
): Promise<{ id: string; libraryId: string; bound: boolean } | null> {
  const row = await db
    .prepare(
      `SELECT s.id, s.library_id, s.expires_at, l.passphrase_lookup
       FROM sessions s JOIN libraries l ON l.id = s.library_id
       WHERE s.id = ?`,
    )
    .bind(sessionId)
    .first<{ id: string; library_id: string; expires_at: string; passphrase_lookup: string | null }>();
  if (!row) return null;
  if (row.expires_at <= now.toISOString()) {
    await deleteSession(db, sessionId);
    return null;
  }
  return { id: row.id, libraryId: row.library_id, bound: Boolean(row.passphrase_lookup) };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export async function deleteOtherSessions(db: D1Database, libraryId: string, keepSessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE library_id = ? AND id != ?").bind(libraryId, keepSessionId).run();
}

export async function loginBlocked(db: D1Database, ip: string, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - ATTEMPT_WINDOW_MS).toISOString();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM auth_attempts WHERE ip = ? AND created_at > ?")
    .bind(ip, since)
    .first<{ n: number }>();
  return (Number(row?.n) || 0) >= MAX_FAILURES;
}

export async function recordLoginFailure(db: D1Database, ip: string, now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - ATTEMPT_WINDOW_MS).toISOString();
  await db.batch([
    db.prepare("INSERT INTO auth_attempts (id, ip, created_at) VALUES (?, ?, ?)").bind(
      crypto.randomUUID(),
      ip,
      now.toISOString(),
    ),
    db.prepare("DELETE FROM auth_attempts WHERE created_at <= ?").bind(cutoff),
  ]);
}

export async function ensureWebauthnUserId(db: D1Database, libraryId: string): Promise<string> {
  const row = await db
    .prepare("SELECT webauthn_user_id FROM libraries WHERE id = ?")
    .bind(libraryId)
    .first<{ webauthn_user_id: string | null }>();
  if (row?.webauthn_user_id) return row.webauthn_user_id;
  const userId = hex(crypto.getRandomValues(new Uint8Array(32)));
  await db.prepare("UPDATE libraries SET webauthn_user_id = ? WHERE id = ? AND webauthn_user_id IS NULL").bind(userId, libraryId).run();
  const again = await db
    .prepare("SELECT webauthn_user_id FROM libraries WHERE id = ?")
    .bind(libraryId)
    .first<{ webauthn_user_id: string | null }>();
  if (!again?.webauthn_user_id) throw new Error("webauthn user id missing");
  return again.webauthn_user_id;
}

export async function listPasskeyIds(db: D1Database, libraryId: string): Promise<string[]> {
  const rows = await db
    .prepare("SELECT credential_id FROM passkey_credentials WHERE library_id = ?")
    .bind(libraryId)
    .all<{ credential_id: string }>();
  return rows.results.map((row) => row.credential_id);
}

export async function listPasskeys(
  db: D1Database,
  libraryId: string,
): Promise<Array<{ id: string; createdAt: string }>> {
  const rows = await db
    .prepare(
      "SELECT credential_id, created_at FROM passkey_credentials WHERE library_id = ? ORDER BY created_at, credential_id",
    )
    .bind(libraryId)
    .all<{ credential_id: string; created_at: string }>();
  return rows.results.map((row) => ({ id: row.credential_id, createdAt: row.created_at }));
}

const PASSKEY_ID_MAX = 512;

/** Deletes one credential on this library. An empty, oversized, or unknown id deletes nothing. */
export async function deletePasskey(db: D1Database, libraryId: string, credentialId: string): Promise<boolean> {
  if (!credentialId || credentialId.length > PASSKEY_ID_MAX) return false;
  const result = await db
    .prepare("DELETE FROM passkey_credentials WHERE library_id = ? AND credential_id = ?")
    .bind(libraryId, credentialId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function savePasskey(
  db: D1Database,
  input: { credentialId: string; libraryId: string; publicKey: string; signCount: number },
  now = new Date(),
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO passkey_credentials (credential_id, library_id, public_key, sign_count, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(input.credentialId, input.libraryId, input.publicKey, input.signCount, now.toISOString())
    .run();
}

export async function findPasskey(
  db: D1Database,
  credentialId: string,
): Promise<{ libraryId: string; publicKey: string; signCount: number } | null> {
  const row = await db
    .prepare("SELECT library_id, public_key, sign_count FROM passkey_credentials WHERE credential_id = ?")
    .bind(credentialId)
    .first<{ library_id: string; public_key: string; sign_count: number }>();
  if (!row) return null;
  return { libraryId: row.library_id, publicKey: row.public_key, signCount: row.sign_count };
}

export async function updatePasskeyCounter(db: D1Database, credentialId: string, signCount: number): Promise<void> {
  await db.prepare("UPDATE passkey_credentials SET sign_count = ? WHERE credential_id = ?").bind(signCount, credentialId).run();
}

export async function saveChallenge(
  db: D1Database,
  input: { id: string; libraryId: string | null; challenge: string; kind: "register" | "authenticate" },
  now = new Date(),
): Promise<void> {
  const expires = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  await db
    .prepare(
      "INSERT INTO webauthn_challenges (id, library_id, challenge, kind, expires_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(input.id, input.libraryId, input.challenge, input.kind, expires)
    .run();
}

export async function takeChallenge(
  db: D1Database,
  id: string,
  kind: "register" | "authenticate",
  now = new Date(),
): Promise<{ challenge: string; libraryId: string | null } | null> {
  const row = await db
    .prepare("SELECT challenge, library_id, kind, expires_at FROM webauthn_challenges WHERE id = ?")
    .bind(id)
    .first<{ challenge: string; library_id: string | null; kind: string; expires_at: string }>();
  await db.prepare("DELETE FROM webauthn_challenges WHERE id = ?").bind(id).run();
  if (!row || row.kind !== kind || row.expires_at <= now.toISOString()) return null;
  return { challenge: row.challenge, libraryId: row.library_id };
}

function hex(bytesIn: Uint8Array): string {
  return [...bytesIn].map((b) => b.toString(16).padStart(2, "0")).join("");
}
