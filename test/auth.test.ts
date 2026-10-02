import { describe, expect, test } from "bun:test";
import {
  clearAuthCookie,
  clearLibraryCookie,
  hashPassphrase,
  MIN_PASSPHRASE_LENGTH,
  passphraseLookup,
  readSessionCookie,
  requestHasLegacyAuthCookie,
  sessionCookie,
  validatePassphrase,
  verifyPassphrase,
} from "../src/auth";

const PEPPER = "test-pepper-not-the-prod-secret";

describe("passphrase auth", () => {
  test("rejects short or blank passphrases", () => {
    expect(validatePassphrase("short pin").ok).toBe(false);
    expect(validatePassphrase("   ").ok).toBe(false);
    expect(validatePassphrase(null).ok).toBe(false);
    expect(validatePassphrase("a").ok).toBe(false);
    const ok = validatePassphrase("  a real passphrase  ");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.passphrase).toBe("a real passphrase");
    expect(MIN_PASSPHRASE_LENGTH).toBeGreaterThanOrEqual(12);
  });

  test("lookup depends on the pepper and the phrase", async () => {
    const a = await passphraseLookup(PEPPER, "a real passphrase");
    const b = await passphraseLookup(PEPPER, "  a real passphrase  ");
    const c = await passphraseLookup(PEPPER, "another passphrase");
    const d = await passphraseLookup("other-pepper", "a real passphrase");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test("slow hash verifies only the same phrase", async () => {
    const stored = await hashPassphrase("a real passphrase");
    expect(stored.iterations).toBe(100_000);
    expect(await verifyPassphrase("a real passphrase", stored.salt, stored.hash, stored.iterations)).toBe(true);
    expect(await verifyPassphrase("a real passphrase!", stored.salt, stored.hash, stored.iterations)).toBe(false);
    expect(await verifyPassphrase("a real passphrase", stored.salt, stored.hash, 1)).toBe(false);
  });

  test("session cookie is random, httponly, and not a library id", () => {
    const id = "ab".repeat(32);
    expect(readSessionCookie(`margin_session=${id}`)).toBe(id);
    expect(readSessionCookie(`theme=dark; margin_session=${id}; x=1`)).toBe(id);
    expect(readSessionCookie("margin_session=11111111-1111-4111-8111-111111111111")).toBeNull();
    expect(readSessionCookie(null)).toBeNull();
    const header = sessionCookie(id, true);
    expect(header.includes("HttpOnly")).toBe(true);
    expect(header.includes("Secure")).toBe(true);
    expect(header.includes("margin_library")).toBe(false);
    expect(clearAuthCookie(false).includes("Max-Age=0")).toBe(true);
    expect(clearLibraryCookie(true).includes("Secure")).toBe(true);
    expect(requestHasLegacyAuthCookie("margin_library=abc")).toBe(true);
    expect(requestHasLegacyAuthCookie(`margin_session=${id}`)).toBe(false);
  });
});
