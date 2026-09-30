/** Passphrase → stable library identity for the Workers spike. No email provider. */

const AUTH_COOKIE = "margin_auth";
const PEPPER = "margin-spike-v1";

export function readAuthCookie(header: string | null): boolean {
  if (!header) return false;
  return /(?:^|;\s*)margin_auth=1(?:;|$)/.test(header);
}

export function authCookie(secure: boolean): string {
  const parts = [
    `${AUTH_COOKIE}=1`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${60 * 60 * 24 * 400}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearAuthCookie(secure: boolean): string {
  const parts = [`${AUTH_COOKIE}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearLibraryCookie(secure: boolean): string {
  const parts = ["margin_library=", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Normalize + hash a passphrase into a stable identity key. */
export async function identityKeyFromPassphrase(passphrase: string): Promise<string> {
  const normalized = passphrase.normalize("NFKC").trim();
  if (normalized.length < 4) throw new Error("passphrase too short");
  if (normalized.length > 200) throw new Error("passphrase too long");
  const data = new TextEncoder().encode(`${PEPPER}:${normalized}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function findOrCreateIdentityLibrary(
  db: D1Database,
  identityKey: string,
  label: string | null,
): Promise<{ id: string; created: boolean; lastReadSlug: string | null }> {
  const existing = await db
    .prepare("SELECT id, last_read_slug FROM libraries WHERE identity_key = ?")
    .bind(identityKey)
    .first<{ id: string; last_read_slug: string | null }>();
  if (existing) {
    if (label) {
      await db
        .prepare("UPDATE libraries SET label = ?, updated_at = ? WHERE id = ?")
        .bind(label, new Date().toISOString(), existing.id)
        .run();
    }
    return { id: existing.id, created: false, lastReadSlug: existing.last_read_slug };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO libraries (id, created_at, updated_at, identity_key, label) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, now, now, identityKey, label)
    .run();
  return { id, created: true, lastReadSlug: null };
}

export function validatePassphrase(raw: unknown): { ok: true; passphrase: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Passphrase required" };
  const passphrase = raw.normalize("NFKC").trim();
  if (passphrase.length < 4) return { ok: false, error: "Use at least 4 characters" };
  if (passphrase.length > 200) return { ok: false, error: "Passphrase is too long" };
  return { ok: true, passphrase };
}
