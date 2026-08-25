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

export function selectionFromTap(tapped) {
  const n = Number(tapped)
  if (!Number.isFinite(n) || n < 1) return null
  return { start: n, end: n }
}

export function selectionFromDrag(anchor, hovered) {
  const start = Number(anchor)
  const end = Number(hovered)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) return null
  return normalizeSpan(start, end)
}
