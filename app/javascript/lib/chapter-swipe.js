const MIN_DISTANCE = 80
const MIN_FLICK = 36
const MIN_VELOCITY = 0.5
const HORIZONTAL_RATIO = 1.35
const TAP_SLOP = 14
const AXIS_SLOP = 16

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
