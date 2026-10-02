import {
  findAnyPassage,
  resolveBookAlias,
  type ParsedPassage,
} from "grab-bcv";
import { bookName, chapterCount, nextBook, prevBook } from "./books";

export type PassageKind = "chapter" | "verse" | "range";

export type Passage = {
  book: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  kind: PassageKind;
};

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

/** Chapter URLs paint scripture first and load notes after. A verse or range includes its notes in the first HTML. */
export function lazyChapterNotes(passage: Passage): boolean {
  return passage.kind === "chapter";
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

/**
 * Resolve jump-bar / route input via grab-bcv (same contract as Rails margin,
 * route.bible, and other dps products). Accepts natural text, OSIS slugs, and
 * share URLs. Book-only tokens (e.g. "jude") fall back to chapter 1.
 */
export function parsePassage(input: string | null | undefined): Passage | null {
  if (input == null) return null;
  const raw = input.trim();
  if (!raw) return null;

  const found = findAnyPassage(raw);
  if (found) return fromGrab(found);

  // Bare book name / alias with no chapter yet — open chapter 1.
  const book = resolveBookAlias(raw);
  if (book) return createPassage(book, 1);

  return null;
}

function fromGrab(parsed: ParsedPassage): Passage {
  const book = parsed.start.book;
  const chapter = parsed.start.chapter;
  const verseStart = parsed.start.verse ?? null;
  const sameChapterRange =
    parsed.rangeType === "same_chapter" &&
    parsed.end.verse != null &&
    verseStart != null &&
    parsed.end.verse !== verseStart;
  const verseEnd = sameChapterRange ? parsed.end.verse! : null;
  return createPassage(book, chapter, verseStart, verseEnd);
}
