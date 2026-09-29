import { describe, expect, test } from "bun:test";
import { libraryCookie, readLibraryCookie } from "../src/library";

describe("library cookie", () => {
  test("reads only a uuid", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(readLibraryCookie(`margin_library=${id}`)).toBe(id);
    expect(readLibraryCookie(`theme=dark; margin_library=${id}; other=1`)).toBe(id);
    expect(readLibraryCookie("margin_library=not-a-uuid")).toBeNull();
    expect(readLibraryCookie(null)).toBeNull();
  });

  test("marks the cookie httponly", () => {
    const header = libraryCookie("11111111-1111-4111-8111-111111111111", true);
    expect(header.includes("HttpOnly")).toBe(true);
    expect(header.includes("Secure")).toBe(true);
    expect(libraryCookie("11111111-1111-4111-8111-111111111111", false).includes("Secure")).toBe(false);
  });
});
