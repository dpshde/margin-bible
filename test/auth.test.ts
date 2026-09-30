import { describe, expect, test } from "bun:test";
import {
  authCookie,
  clearAuthCookie,
  identityKeyFromPassphrase,
  readAuthCookie,
  validatePassphrase,
} from "../src/auth";

describe("passphrase auth", () => {
  test("rejects short or blank passphrases", () => {
    expect(validatePassphrase("ab").ok).toBe(false);
    expect(validatePassphrase("   ").ok).toBe(false);
    expect(validatePassphrase(null).ok).toBe(false);
    expect(validatePassphrase("demo").ok).toBe(true);
  });

  test("same passphrase yields the same identity key", async () => {
    const a = await identityKeyFromPassphrase("Dylan demo pin");
    const b = await identityKeyFromPassphrase("  Dylan demo pin  ");
    const c = await identityKeyFromPassphrase("other phrase here");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  test("auth cookie is httponly and readable", () => {
    expect(readAuthCookie("margin_auth=1")).toBe(true);
    expect(readAuthCookie("theme=dark; margin_auth=1; x=1")).toBe(true);
    expect(readAuthCookie("margin_auth=0")).toBe(false);
    expect(readAuthCookie(null)).toBe(false);
    expect(authCookie(true).includes("HttpOnly")).toBe(true);
    expect(authCookie(true).includes("Secure")).toBe(true);
    expect(clearAuthCookie(false).includes("Max-Age=0")).toBe(true);
  });
});
