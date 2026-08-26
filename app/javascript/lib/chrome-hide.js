const DOWN = 8
const UP = -8

export function nextChromeHidden({
  hidden = false,
  scrollY = 0,
  lastY = 0,
  locked = false,
  nearBottom = false,
  minY = 24
} = {}) {
  if (locked || nearBottom || scrollY < minY) return false
  const delta = scrollY - lastY
  if (delta > DOWN) return true
  if (delta < UP) return false
  return hidden
}

export function nearBottomEdge(clientY, innerHeight, zone = 96) {
  return innerHeight - clientY <= zone
}
