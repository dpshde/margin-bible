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
