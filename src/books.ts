import data from "../vendor/data/books.json";

export type BooksData = {
  codes: string[];
  names: Record<string, string>;
  chapterCounts: Record<string, number>;
  verseCounts: Record<string, Record<string, number>>;
  aliases: Record<string, string>;
};

const books = data as BooksData;
const codes = new Set(books.codes);

const aliasIndex = new Map<string, string>();
for (const [key, code] of Object.entries(books.aliases)) {
  aliasIndex.set(normalizeAlias(key), code);
}
for (const code of books.codes) {
  aliasIndex.set(code.toLowerCase(), code);
}

function normalizeAlias(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function bookCodes(): readonly string[] {
  return books.codes;
}

export function bookName(code: string): string | null {
  return books.names[code.toUpperCase()] ?? null;
}

export function chapterCount(code: string): number {
  return books.chapterCounts[code.toUpperCase()] ?? 0;
}

export function isBookCode(code: string): boolean {
  return codes.has(code.toUpperCase());
}

export function resolveAlias(token: string): string | null {
  return aliasIndex.get(normalizeAlias(token)) ?? null;
}

export function nextBook(code: string): string | null {
  const index = books.codes.indexOf(code.toUpperCase());
  if (index < 0) return null;
  return books.codes[index + 1] ?? null;
}

export function prevBook(code: string): string | null {
  const index = books.codes.indexOf(code.toUpperCase());
  if (index <= 0) return null;
  return books.codes[index - 1] ?? null;
}

export const ntStartIndex = books.codes.indexOf("MAT");

export function testamentCodes(): { ot: string[]; nt: string[] } {
  const split = ntStartIndex < 0 ? books.codes.length : ntStartIndex;
  return {
    ot: books.codes.slice(0, split),
    nt: books.codes.slice(split),
  };
}

export type SearchTestament = "all" | "nt" | "ot";

/** All, NT, or OT. Anything else is the whole Bible. */
export function normalizeSearchTestament(value: unknown): SearchTestament {
  const next = String(value ?? "").trim().toLowerCase();
  return next === "nt" || next === "ot" ? next : "all";
}

/** `/gen.2.9` → `GEN`. Hidden Arrow has no testament field, so Margin filters these paths. */
export function bookCodeFromMarginPath(path: string): string | null {
  const slug = String(path || "").replace(/^\/+/, "").split(".")[0]?.toLowerCase() ?? "";
  if (!slug) return null;
  const code = slug.toUpperCase();
  return isBookCode(code) ? code : null;
}

export function marginPathInTestament(path: string, testament: SearchTestament): boolean {
  if (testament === "all") return true;
  const code = bookCodeFromMarginPath(path);
  if (!code) return false;
  const sets = testamentCodes();
  return (testament === "nt" ? sets.nt : sets.ot).includes(code);
}
