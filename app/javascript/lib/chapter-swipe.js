const MIN_DISTANCE = 80
const MIN_FLICK = 36
const MIN_VELOCITY = 0.5
const HORIZONTAL_RATIO = 1.35
const TAP_SLOP = 14
const AXIS_SLOP = 16
const SCROLL_SLOP = 10

export function isTapGesture(dx, dy, slop = TAP_SLOP) {
  return Math.abs(dx) < slop && Math.abs(dy) < slop
}

export function isHorizontalIntent(dx, dy, slop = AXIS_SLOP) {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  return absX >= slop && absX >= absY * HORIZONTAL_RATIO
}

export function chapterSwipe({
  dx,
  dy,
  elapsedMs,
  rangeDragging = false,
  startedOnChrome = false
}) {
  if (rangeDragging || startedOnChrome) return null
  if (!isHorizontalIntent(dx, dy, MIN_FLICK)) return null
  const absX = Math.abs(dx)
  const velocity = absX / Math.max(Number(elapsedMs) || 0, 1)
  if (absX < MIN_DISTANCE && velocity < MIN_VELOCITY) return null
  return dx < 0 ? "next" : "prev"
}

export function rangeDragIntent({
  startVerse,
  currentVerse,
  startVerseTop,
  currentStartVerseTop,
  dx,
  dy,
  scrollSlop = SCROLL_SLOP
}) {
  if (startVerse == null || currentVerse == null || currentVerse === startVerse) return false
  if (isHorizontalIntent(dx, dy)) return false
  if (
    startVerseTop != null &&
    currentStartVerseTop != null &&
    Math.abs(currentStartVerseTop - startVerseTop) > scrollSlop
  ) {
    return false
  }
  return true
}

export function versePointerDecision({
  dx,
  dy,
  elapsedMs,
  startVerse,
  endVerse,
  dragging
}) {
  const changedVerse = startVerse != null && endVerse != null && endVerse !== startVerse
  if (dragging && changedVerse) {
    return { type: "range", start: startVerse, end: endVerse }
  }
  const swipe = chapterSwipe({
    dx,
    dy,
    elapsedMs,
    rangeDragging: dragging && changedVerse
  })
  if (swipe) return { type: "chapter", direction: swipe }
  if (isTapGesture(dx, dy) && startVerse != null) {
    return { type: "tap", verse: startVerse }
  }
  return { type: "idle" }
}
