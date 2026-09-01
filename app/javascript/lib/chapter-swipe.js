// Committed chapter swipe. Origin Exedra
// (cursor.com/codebase/dpshde/selah-tools/…/labs/exedra) is the source of
// truth but this VM cannot read it (origin CLI unauthenticated, API 401).
// Workspace has no Exedra pan/velocity numbers — only picker/sheet comments.
// Fallback specified for that case:
//   ignore pans whose |dy| > |dx| * 0.7
//   require ~100px horizontal OR a clear flick (0.85 px/ms after 56px)
//   cancel if the gesture started on a verse/note control
const AXIS_LOCK_SLOP = 10
const VERTICAL_REJECT = 0.7
const MIN_DISTANCE = 100
const MIN_FLICK = 56
const MIN_VELOCITY = 0.85
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
  return absY > absX * VERTICAL_REJECT ? "vertical" : "horizontal"
}

export function isHorizontalIntent(dx, dy, slop = AXIS_LOCK_SLOP) {
  return lockSwipeAxis(dx, dy, null, slop) === "horizontal"
}

// Mouse / trackpad / pen never chapter-swipe. A real touch pointer always
// may; otherwise only a coarse primary pointer (no typed event) is enough.
export function chapterSwipeAllowed({ pointerType = null, coarsePointer = false } = {}) {
  if (pointerType === "touch") return true
  if (pointerType == null || pointerType === "") return Boolean(coarsePointer)
  return false
}

export function detectCoarsePointer(queryMedia) {
  const media = queryMedia ?? globalThis.matchMedia
  if (typeof media !== "function") return false
  try {
    return Boolean(media.call(globalThis, "(pointer: coarse)")?.matches)
  } catch {
    return false
  }
}

export function chapterSwipe({
  dx,
  dy,
  elapsedMs,
  rangeDragging = false,
  startedOnChrome = false,
  startedOnControl = false,
  axis = null,
  pointerType = null,
  coarsePointer = false
}) {
  if (!chapterSwipeAllowed({ pointerType, coarsePointer })) return null
  if (rangeDragging || startedOnChrome || startedOnControl) return null
  if (lockSwipeAxis(dx, dy, axis) !== "horizontal") return null
  const absX = Math.abs(dx)
  const velocity = absX / Math.max(Number(elapsedMs) || 0, 1)
  const committedDrag = absX >= MIN_DISTANCE
  const clearFlick = absX >= MIN_FLICK && velocity >= MIN_VELOCITY
  if (!committedDrag && !clearFlick) return null
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
  allowChapterSwipe = true,
  scrollSlop = SCROLL_SLOP
}) {
  if (startVerse == null || currentVerse == null || currentVerse === startVerse) return false
  if (allowChapterSwipe && (axis === "horizontal" || isHorizontalIntent(dx, dy))) return false
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
  axis = null,
  startedOnControl = false,
  pointerType = null,
  coarsePointer = false
}) {
  const changedVerse = startVerse != null && endVerse != null && endVerse !== startVerse
  const swipeOk = chapterSwipeAllowed({ pointerType, coarsePointer })
  const horizontal = lockSwipeAxis(dx, dy, axis) === "horizontal"
  const onControl = startedOnControl || startVerse != null
  // A drag that lands on another verse is a range even if pointermove never
  // flipped `dragging` (throttled moves, pointercancel, or the first sample
  // on pointerup). Horizontal flicks without that drag still swipe chapters
  // only when the press did not start on a verse/note control.
  if (changedVerse && (dragging || (!isTapGesture(dx, dy) && !(horizontal && swipeOk)))) {
    return { type: "range", start: startVerse, end: endVerse }
  }
  const swipe = chapterSwipe({
    dx,
    dy,
    elapsedMs,
    rangeDragging: dragging && changedVerse,
    startedOnControl: onControl,
    axis,
    pointerType,
    coarsePointer
  })
  if (swipe) return { type: "chapter", direction: swipe }
  if (isTapGesture(dx, dy) && startVerse != null) {
    return { type: "tap", verse: startVerse }
  }
  return { type: "idle" }
}
