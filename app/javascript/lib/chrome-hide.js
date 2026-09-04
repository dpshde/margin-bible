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
  menuOpen = false,
  gridOpen = false
} = {}) {
  if (suggestOpen || menuOpen || gridOpen) return true
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

// Tucking chrome collapses --reader-bottom-pad by ~5–7rem. If that shrink
// happens inside this zone, the browser clamps scrollY and the next event
// looks like a scroll-up — hide/show flash. Stay larger than the collapse.
export const DOCUMENT_BOTTOM_ZONE = 168

export function nearDocumentBottom({
  scrollY = 0,
  scrollHeight = 0,
  viewportHeight = 0,
  zone = DOCUMENT_BOTTOM_ZONE
} = {}) {
  const maxScroll = Math.max(0, scrollHeight - viewportHeight)
  if (maxScroll <= 0) return true
  return maxScroll - scrollY <= zone
}

export function documentMetrics(doc = globalThis.document, win = globalThis) {
  const scrolling = doc?.scrollingElement ?? doc?.documentElement
  return {
    scrollY: win?.scrollY ?? 0,
    scrollHeight: scrolling?.scrollHeight ?? 0,
    viewportHeight: scrolling?.clientHeight ?? win?.innerHeight ?? 0
  }
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

export function detectFineHover(queryMedia) {
  const media = queryMedia ?? globalThis.matchMedia
  if (typeof media !== "function") return false
  try {
    const hover = media.call(globalThis, "(hover: hover)")
    const fine = media.call(globalThis, "(pointer: fine)")
    return Boolean(hover?.matches && fine?.matches)
  } catch {
    return false
  }
}

export function pointerOverPager(target) {
  return Boolean(target?.closest?.(".pager"))
}

export function shouldProximityReveal({
  edge = "bottom",
  overPager = false,
  fineHover = false,
  pointerType = null
} = {}) {
  if (edge === "top") return true
  if (overPager) return false
  if (pointerType === "touch") return true
  if (pointerType === "mouse" || pointerType === "pen") return false
  if (fineHover) return false
  return true
}

export function shouldShowChromeFromPointer({
  clientY,
  innerHeight,
  edge = "bottom",
  overPager = false,
  fineHover = false,
  pointerType = null,
  zone
} = {}) {
  if (!nearRevealEdge(clientY, innerHeight, edge, zone)) return false
  return shouldProximityReveal({ edge, overPager, fineHover, pointerType })
}

export function applyReaderChromeTuck(reader, tucked) {
  if (!reader?.classList) return false
  reader.classList.toggle("is-chrome-tucked", Boolean(tucked))
  return reader.classList.contains("is-chrome-tucked")
}
