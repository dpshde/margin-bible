const MIN_DISTANCE = 80
const MIN_FLICK = 36
const MIN_VELOCITY = 0.5
const HORIZONTAL_RATIO = 1.35

export function chapterSwipe({
  dx,
  dy,
  elapsedMs,
  rangeDragging = false,
  startedOnChrome = false
}) {
  if (rangeDragging || startedOnChrome) return null
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX < MIN_FLICK) return null
  if (absX < absY * HORIZONTAL_RATIO) return null
  const velocity = absX / Math.max(Number(elapsedMs) || 0, 1)
  if (absX < MIN_DISTANCE && velocity < MIN_VELOCITY) return null
  return dx < 0 ? "next" : "prev"
}
