import { bookName } from "./book-names.js"

const SLUG = /^([1-3]?[a-z]{2,3})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/i

export function parseSlug(slug) {
  const match = String(slug || "").trim().match(SLUG)
  if (!match) return null
  const verseStart = match[3] ? Number(match[3]) : null
  const verseEnd = match[4] ? Number(match[4]) : verseStart
  let kind = "chapter"
  if (verseStart != null && verseEnd != null && verseEnd !== verseStart) kind = "range"
  else if (verseStart != null) kind = "verse"
  return {
    book: match[1].toLowerCase(),
    chapter: Number(match[2]),
    verseStart,
    verseEnd,
    kind
  }
}

export function slugLabel(slug) {
  const parsed = parseSlug(slug)
  if (!parsed) return String(slug || "")
  const name = bookName(parsed.book)
  if (parsed.kind === "chapter") return `${name} ${parsed.chapter}`
  return passageLabel(name, parsed.chapter, parsed.verseStart, parsed.verseEnd)
}

export function hrefForSlug(slug) {
  const parsed = parseSlug(slug)
  if (!parsed) return `/${slug}`
  if (parsed.kind === "chapter") return `/${slug}?chapter_note=1`
  return `/${slug}`
}

export function belongsToChapter(noteSlug, chapterSlug) {
  const note = String(noteSlug || "")
  const chapter = String(chapterSlug || "")
  if (!note || !chapter) return false
  return note === chapter || note.startsWith(`${chapter}.`)
}

export function normalizeSpan(start, end) {
  const lo = Math.min(Number(start), Number(end))
  const hi = Math.max(Number(start), Number(end))
  return { start: lo, end: hi }
}

export function rangeSlug(chapterSlug, start, end) {
  const span = normalizeSpan(start, end)
  if (span.start === span.end) return `${chapterSlug}.${span.start}`
  return `${chapterSlug}.${span.start}-${span.end}`
}

export function passageLabel(bookLabel, chapter, start, end) {
  const span = normalizeSpan(start, end)
  if (span.start === span.end) return `${bookLabel} ${chapter}:${span.start}`
  return `${bookLabel} ${chapter}:${span.start}–${span.end}`
}

export function selectionFromTap(tapped, current = null) {
  const n = Number(tapped)
  if (!Number.isFinite(n) || n < 1) return current
  if (current && current.start === current.end && current.start === n) return null
  if (current && current.start !== current.end && current.end === n) return null
  return { start: n, end: n }
}

export function selectionFromDrag(anchor, hovered) {
  const start = Number(anchor)
  const end = Number(hovered)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) return null
  return normalizeSpan(start, end)
}
