const DOWN = 8
const UP = -8

export function isChromeTypingTarget(element) {
  if (!element || element.nodeType !== 1) return false
  if (element.matches?.("input, textarea, select")) return true
  if (element.isContentEditable) return true
  return Boolean(element.closest?.("[contenteditable='true']"))
}

export function chromeLocked({
  activeElement = null,
  root = null,
  suggestOpen = false,
  menuOpen = false
} = {}) {
  if (suggestOpen || menuOpen) return true
  if (!root || !activeElement || !root.contains(activeElement)) return false
  return isChromeTypingTarget(activeElement)
}

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

export function nearTopEdge(clientY, zone = 72) {
  return clientY <= zone
}

export function nearRevealEdge(clientY, innerHeight, edge = "bottom", zone) {
  if (edge === "top") return nearTopEdge(clientY, zone || 72)
  return nearBottomEdge(clientY, innerHeight, zone || 96)
}
