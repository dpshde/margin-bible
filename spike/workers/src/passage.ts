import { bookName, chapterCount, isBookCode, nextBook, prevBook, resolveAlias } from "./books";

export type PassageKind = "chapter" | "verse" | "range";

export type Passage = {
  book: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  kind: PassageKind;
};

const SLUG = /^([1-3]?[a-z]{2,3})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/i;

export function createPassage(
  book: string,
  chapter: number,
  verseStart: number | null = null,
  verseEnd: number | null = null,
): Passage {
  const kind: PassageKind =
    verseStart == null ? "chapter" : verseEnd != null && verseEnd !== verseStart ? "range" : "verse";
  return {
    book: book.toUpperCase(),
    chapter,
    verseStart,
    verseEnd: kind === "range" ? verseEnd : null,
    kind,
  };
}

export function passageSlug(passage: Passage): string {
  const base = `${passage.book.toLowerCase()}.${passage.chapter}`;
  if (passage.kind === "chapter" || passage.verseStart == null) return base;
  if (passage.kind === "range" && passage.verseEnd != null) {
    return `${base}.${passage.verseStart}-${passage.verseEnd}`;
  }
  return `${base}.${passage.verseStart}`;
}

export function passageOsis(passage: Passage): string {
  return passageSlug(passage).toUpperCase();
}

export function chapterSlug(passage: Passage): string {
  return `${passage.book.toLowerCase()}.${passage.chapter}`;
}

export function passageLabel(passage: Passage): string {
  const name = bookName(passage.book) ?? passage.book;
  if (passage.kind === "chapter" || passage.verseStart == null) return `${name} ${passage.chapter}`;
  if (passage.kind === "range" && passage.verseEnd != null) {
    return `${name} ${passage.chapter}:${passage.verseStart}–${passage.verseEnd}`;
  }
  return `${name} ${passage.chapter}:${passage.verseStart}`;
}

export function focusVerse(passage: Passage): number | null {
  if (passage.verseStart == null) return null;
  return passage.verseEnd ?? passage.verseStart;
}

export function coversVerse(passage: Passage, verse: number): boolean {
  if (passage.verseStart == null) return false;
  const last = passage.verseEnd ?? passage.verseStart;
  return verse >= passage.verseStart && verse <= last;
}

export function prevChapter(passage: Passage): Passage | null {
  if (passage.chapter > 1) return createPassage(passage.book, passage.chapter - 1);
  const previous = prevBook(passage.book);
  if (!previous) return null;
  return createPassage(previous, chapterCount(previous));
}

export function nextChapter(passage: Passage): Passage | null {
  const max = chapterCount(passage.book);
  if (passage.chapter < max) return createPassage(passage.book, passage.chapter + 1);
  const following = nextBook(passage.book);
  if (!following) return null;
  return createPassage(following, 1);
}

export function routeBibleUrl(passage: Passage): string {
  return `https://route.bible/${passageSlug(passage)}`;
}

export function parsePassage(input: string | null | undefined): Passage | null {
  if (input == null) return null;
  const raw = input.trim();
  if (!raw) return null;

  const slugMatch = SLUG.exec(raw);
  if (slugMatch) {
    const book = resolveAlias(slugMatch[1]) ?? slugMatch[1].toUpperCase();
    if (!isBookCode(book)) return null;
    const verseStart = slugMatch[3] ? Number(slugMatch[3]) : null;
    const verseEnd = slugMatch[4] ? Number(slugMatch[4]) : null;
    return createPassage(book, Number(slugMatch[2]), verseStart, verseEnd);
  }

  return parseHuman(raw);
}

function parseHuman(raw: string): Passage | null {
  const normalized = raw.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  const match = /^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/.exec(normalized);
  if (match) {
    const book = resolveAlias(match[1]);
    if (!book) return null;
    const verseStart = match[3] ? Number(match[3]) : null;
    const verseEnd = match[4] ? Number(match[4]) : null;
    return createPassage(book, Number(match[2]), verseStart, verseEnd);
  }

  const book = resolveAlias(normalized);
  if (!book) return null;
  return createPassage(book, 1);
}
