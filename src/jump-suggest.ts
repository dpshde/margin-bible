import {
  autocompletePassage,
  getChapterCount,
  getVerseCount,
  resolveBookAlias,
  tryParseAnyPassage,
  type AutocompletePassageSuggestion,
  type OsisBookCode,
} from "grab-bcv";

export type JumpHit = AutocompletePassageSuggestion;

export type PassageContext = {
  book: OsisBookCode;
  chapter?: number;
  verse?: number;
};

export type JumpState = {
  hits: JumpHit[];
  hint: string | null;
  context: PassageContext | null;
};

export function jumpState(input: string | null | undefined): JumpState {
  const raw = String(input ?? "");
  const query = raw.trim();
  const hits = query ? autocompletePassage(query, { limit: 8 }) : [];
  const context = passageContext(raw);
  const visibleHits = hits.filter((hit) => !isRedundantBookHit(hit, raw, context));
  const hint = hintFor(context, visibleHits);
  return { hits: visibleHits, hint, context };
}

export function insertTextFor(hit: JumpHit | null | undefined): string {
  const text = String(hit?.insertText || hit?.label || "");
  if (hit?.kind === "book" && text && !text.endsWith(" ")) return `${text} `;
  return text;
}

export function passageContext(input: string | null | undefined): PassageContext | null {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;

  const parsed = tryParseAnyPassage(trimmed);
  if (parsed.ok) {
    const value = Array.isArray(parsed.value) ? parsed.value[0] : parsed.value;
    const book = value?.start?.book;
    if (!book) return null;
    const chapter = value.start.chapter;
    const verse = value.start.verse;
    if (verse) return { book, chapter, verse };
    if (chapter) return { book, chapter };
    return { book };
  }

  if (/\d/.test(trimmed)) return null;
  const book = resolveBookAlias(trimmed);
  return book ? { book } : null;
}

export function canGo(input: string | null | undefined): boolean {
  const parsed = tryParseAnyPassage(String(input || "").trim());
  if (!parsed.ok) return false;
  const value = Array.isArray(parsed.value) ? parsed.value[0] : parsed.value;
  return Boolean(value?.start?.chapter);
}

function hintFor(context: PassageContext | null, visibleHits: JumpHit[] = []): string | null {
  if (!context?.book) return null;
  if (context.verse) return null;
  if (context.chapter) {
    const verses = getVerseCount(context.book, context.chapter);
    if (!verses) return null;
    return verses === 1 ? "1 verse" : `${verses} verses`;
  }
  if (visibleHits.some((hit) => hit.kind === "book")) return null;
  const chapters = getChapterCount(context.book);
  if (!chapters) return null;
  return chapters === 1 ? "1 chapter" : `${chapters} chapters`;
}

function isRedundantBookHit(
  hit: JumpHit,
  input: string,
  context: PassageContext | null,
): boolean {
  if (hit.kind !== "book" || !context?.book || context.chapter) return false;
  const typed = String(input || "");
  return typed.trim().toLowerCase() === String(hit.insertText || "").trim().toLowerCase();
}
