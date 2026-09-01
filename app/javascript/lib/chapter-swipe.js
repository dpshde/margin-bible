// Exedra chapter swipe — labs/exedra/src/components/Reader.tsx
// (DPS-LABS/selah-tools). Numbers copied from that file, not invented:
//   AXIS_LOCK_SLOP = 5px, then absX > absY locks horizontal (else vertical).
//   SWIPE_THRESHOLD = 50px distance-only commit. No velocity shortcut.
//   Long-press / highlight slop = 15px; Margin tap slop stays 14px.
//   Selection mode and chrome overlays cancel swipe.
const AXIS_LOCK_SLOP = 5
const SWIPE_THRESHOLD = 50
const TAP_SLOP = 14
const SCROLL_SLOP = 10

export function isTapGesture(dx, dy, slop = TAP_SLOP) {
  return Math.abs(dx) < slop && Math.abs(dy) < slop
}

export function lockSwipeAxis(dx, dy, locked = null, slop = AXIS_LOCK_SLOP) {
  if (locked) return locked
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX <= slop && absY <= slop) return null
  return absX > absY ? "horizontal" : "vertical"
}

export function isHorizontalIntent(dx, dy, slop = AXIS_LOCK_SLOP) {
  return lockSwipeAxis(dx, dy, null, slop) === "horizontal"
}

export function chapterSwipe({
  dx,
  dy,
  elapsedMs,
  rangeDragging = false,
  startedOnChrome = false,
  axis = null
}) {
  if (rangeDragging || startedOnChrome) return null
  if (lockSwipeAxis(dx, dy, axis) !== "horizontal") return null
  // elapsedMs is accepted so callers keep passing it; Exedra has no velocity commit.
  void elapsedMs
  if (Math.abs(dx) < SWIPE_THRESHOLD) return null
  return dx < 0 ? "next" : "prev"
}

export function rangeDragIntent({
  startVerse,
  currentVerse,
  startVerseTop,
  currentStartVerseTop,
  dx,
  dy,
  axis = null,
  scrollSlop = SCROLL_SLOP
}) {
  if (startVerse == null || currentVerse == null || currentVerse === startVerse) return false
  if (axis === "horizontal" || isHorizontalIntent(dx, dy)) return false
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
  dragging,
  axis = null
}) {
  const changedVerse = startVerse != null && endVerse != null && endVerse !== startVerse
  const horizontal = lockSwipeAxis(dx, dy, axis) === "horizontal"
  // A drag that lands on another verse is a range even if pointermove never
  // flipped `dragging` (throttled moves, pointercancel, or the first sample
  // on pointerup). Horizontal flicks without that drag still swipe chapters.
  if (changedVerse && (dragging || (!isTapGesture(dx, dy) && !horizontal))) {
    return { type: "range", start: startVerse, end: endVerse }
  }
  const swipe = chapterSwipe({
    dx,
    dy,
    elapsedMs,
    rangeDragging: dragging && changedVerse,
    axis
  })
  if (swipe) return { type: "chapter", direction: swipe }
  if (isTapGesture(dx, dy) && startVerse != null) {
    return { type: "tap", verse: startVerse }
  }
  return { type: "idle" }
}
