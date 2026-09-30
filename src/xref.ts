/**
 * Xref href helpers — spike port of Rails xref-peek.js + passage-span slugLabel.
 */
import { parsePassage, passageLabel, passageSlug, type Passage } from "./passage";

const SLUG = /^([1-3]?[a-z]{2,3})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/i;

export function parseSlug(slug: string): {
  book: string;
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  kind: "chapter" | "verse" | "range";
} | null {
  const match = String(slug || "").trim().match(SLUG);
  if (!match) return null;
  const verseStart = match[3] ? Number(match[3]) : null;
  const verseEnd = match[4] ? Number(match[4]) : verseStart;
  let kind: "chapter" | "verse" | "range" = "chapter";
  if (verseStart != null && verseEnd != null && verseEnd !== verseStart) kind = "range";
  else if (verseStart != null) kind = "verse";
  return {
    book: match[1].toLowerCase(),
    chapter: Number(match[2]),
    verseStart,
    verseEnd,
    kind,
  };
}

export function slugLabel(slug: string): string {
  const passage = parsePassage(slug);
  if (passage) return passageLabel(passage);
  return String(slug || "");
}

export function hrefForXref(slug: string): string {
  const parsed = parseSlug(slug);
  if (!parsed) {
    const path = String(slug || "").replace(/^\//, "");
    return path ? `/${path}` : "/";
  }
  const base = `/${parsed.book}.${parsed.chapter}`;
  if (parsed.kind === "chapter") return base;
  if (parsed.kind === "range") return `${base}.${parsed.verseStart}-${parsed.verseEnd}?xref=1`;
  return `${base}.${parsed.verseStart}?xref=1`;
}

export function parseXrefHref(href: string | null | undefined): (Passage & { slug?: string }) | null {
  if (!href) return null;
  try {
    const url = new URL(href, "https://margin.bible");
    const slug = url.pathname.replace(/^\//, "").toLowerCase();
    const passage = parsePassage(slug);
    if (!passage) return null;
    return { ...passage, slug: passageSlug(passage) };
  } catch {
    return null;
  }
}

export function sameChapterSlug(parsed: Passage, chapterSlug: string): boolean {
  return `${parsed.book.toLowerCase()}.${parsed.chapter}` === String(chapterSlug).toLowerCase();
}
