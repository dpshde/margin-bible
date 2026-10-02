/** Passphrase hashing and the session cookie. The pepper is a Worker secret, not source. */

export const MIN_PASSPHRASE_LENGTH = 12;
export const PBKDF2_ITERATIONS = 100_000;
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 400;
const SESSION_COOKIE = "margin_session";
const SESSION_ID = /^[0-9a-f]{64}$/;

export function validatePassphrase(
  raw: unknown,
): { ok: true; passphrase: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Passphrase required" };
  const passphrase = raw.normalize("NFKC").trim();
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_PASSPHRASE_LENGTH} characters` };
  }
  if (passphrase.length > 200) return { ok: false, error: "Passphrase is too long" };
  return { ok: true, passphrase };
}

export function normalizeLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const label = raw.normalize("NFKC").trim().slice(0, 80);
  return label || null;
}

/** Stable lookup key. A database copy is not enough to brute-force this without the pepper. */
export async function passphraseLookup(pepper: string, passphrase: string): Promise<string> {
  const key = await hmacKey(pepper);
  const mac = await crypto.subtle.sign("HMAC", key, bytes(passphrase.normalize("NFKC").trim()));
  return hex(new Uint8Array(mac));
}

export async function hashClaimToken(pepper: string, token: string): Promise<string> {
  const key = await hmacKey(pepper);
  const mac = await crypto.subtle.sign("HMAC", key, bytes(`claim:${token.trim()}`));
  return hex(new Uint8Array(mac));
}

export async function hashPassphrase(
  passphrase: string,
): Promise<{ salt: string; hash: string; iterations: number }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(passphrase, saltBytes, PBKDF2_ITERATIONS);
  return { salt: hex(saltBytes), hash: hex(hash), iterations: PBKDF2_ITERATIONS };
}

export async function verifyPassphrase(
  passphrase: string,
  saltHex: string,
  hashHex: string,
  iterations: number,
): Promise<boolean> {
  if (!iterations || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
  const salt = fromHex(saltHex);
  if (!salt) return false;
  const actual = await pbkdf2(passphrase, salt, iterations);
  return equalHex(hex(actual), hashHex);
}

/** Runs PBKDF2 even when the passphrase matches nothing, so a miss is not faster than a hit. */
let dummyHash: { salt: string; hash: string } | null = null;
export async function burnPassphraseTime(passphrase: string): Promise<void> {
  if (!dummyHash) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await pbkdf2("margin-dummy-passphrase", salt, PBKDF2_ITERATIONS);
    dummyHash = { salt: hex(salt), hash: hex(hash) };
  }
  await verifyPassphrase(passphrase, dummyHash.salt, dummyHash.hash, PBKDF2_ITERATIONS);
}

export function newSessionId(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

export function readSessionCookie(header: string | null): string | null {
  if (!header) return null;
  const match = /(?:^|;\s*)margin_session=([0-9a-f]+)/i.exec(header);
  if (!match) return null;
  const value = match[1].toLowerCase();
  return SESSION_ID.test(value) ? value : null;
}

export function sessionCookie(id: string, secure: boolean): string {
  return cookie(`${SESSION_COOKIE}=${id}`, SESSION_MAX_AGE_SEC, secure);
}

export function clearSessionCookie(secure: boolean): string {
  return cookie(`${SESSION_COOKIE}=`, 0, secure);
}

export function clearLibraryCookie(secure: boolean): string {
  return cookie("margin_library=", 0, secure);
}

export function clearAuthCookie(secure: boolean): string {
  return cookie("margin_auth=", 0, secure);
}

export function requestHasLegacyAuthCookie(header: string | null): boolean {
  if (!header) return false;
  return /(?:^|;\s*)margin_library=/.test(header) || /(?:^|;\s*)margin_auth=/.test(header);
}

export function clientIp(header: string | null): string {
  const ip = header?.split(",")[0]?.trim() || "unknown";
  return ip.slice(0, 64);
}

async function hmacKey(pepper: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", bytes(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function pbkdf2(passphrase: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", bytes(passphrase), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    256,
  );
  return new Uint8Array(bits);
}

function cookie(pair: string, maxAge: number, secure: boolean): string {
  const parts = [pair, "HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function hex(bytesIn: Uint8Array): string {
  return [...bytesIn].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function equalHex(actual: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", bytes(actual)),
    crypto.subtle.digest("SHA-256", bytes(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (left: BufferSource, right: BufferSource) => boolean;
  };
  if (typeof subtle.timingSafeEqual === "function") return subtle.timingSafeEqual(left, right);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}
