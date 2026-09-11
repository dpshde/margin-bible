import assert from "node:assert/strict"
import {
  applyReaderChromeTuck,
  chromeLocked,
  detectFineHover,
  DOCUMENT_BOTTOM_ZONE,
  documentMetrics,
  nearBottomEdge,
  nearDocumentBottom,
  nearRevealEdge,
  nearTopEdge,
  nextChromeHidden,
  pointerOverPager,
  shouldProximityReveal,
  shouldShowChromeFromPointer
} from "../../app/javascript/lib/chrome-hide.js"

{
  assert.equal(nextChromeHidden({ hidden: false, scrollY: 10, lastY: 0 }), false)
  assert.equal(nextChromeHidden({ hidden: false, scrollY: 80, lastY: 40 }), true)
  assert.equal(nextChromeHidden({ hidden: true, scrollY: 40, lastY: 80 }), false)
  assert.equal(nextChromeHidden({ hidden: true, scrollY: 84, lastY: 80 }), true)
  assert.equal(nextChromeHidden({ hidden: false, scrollY: 200, lastY: 80, locked: true }), false)
  assert.equal(nextChromeHidden({ hidden: true, scrollY: 200, lastY: 80, nearBottom: true }), false)
}

{
  assert.ok(DOCUMENT_BOTTOM_ZONE > 106)
  assert.equal(nearDocumentBottom({
    scrollY: 1000,
    scrollHeight: 2000,
    viewportHeight: 800
  }), false)
  assert.equal(nearDocumentBottom({
    scrollY: 1100,
    scrollHeight: 2000,
    viewportHeight: 800
  }), true)
  assert.equal(nearDocumentBottom({
    scrollY: 1200,
    scrollHeight: 2000,
    viewportHeight: 800
  }), true)
  assert.equal(nearDocumentBottom({
    scrollY: 0,
    scrollHeight: 400,
    viewportHeight: 800
  }), true)
  assert.equal(nearDocumentBottom({
    scrollY: 1000,
    scrollHeight: 2000,
    viewportHeight: 800,
    zone: 80
  }), false)

  const metrics = documentMetrics({
    scrollingElement: { scrollHeight: 1918, clientHeight: 800 }
  }, { scrollY: 1110, innerHeight: 800 })
  assert.equal(metrics.scrollY, 1110)
  assert.equal(metrics.scrollHeight, 1918)
  assert.equal(metrics.viewportHeight, 800)
  assert.equal(nearDocumentBottom(metrics), true)

  // Pad collapse (~82px) clamps scrollY. Without nearBottom that looks like
  // a scroll-up and the bar flashes. With it, chrome stays shown.
  assert.equal(nextChromeHidden({ hidden: false, scrollY: 1110, lastY: 1000 }), true)
  assert.equal(nextChromeHidden({ hidden: true, scrollY: 1028, lastY: 1110 }), false)
  assert.equal(nextChromeHidden({
    hidden: false,
    scrollY: 1110,
    lastY: 1000,
    nearBottom: nearDocumentBottom({
      scrollY: 1110,
      scrollHeight: 1918,
      viewportHeight: 800
    })
  }), false)
  assert.equal(nextChromeHidden({
    hidden: true,
    scrollY: 1028,
    lastY: 1110,
    nearBottom: nearDocumentBottom({
      scrollY: 1028,
      scrollHeight: 1918,
      viewportHeight: 800
    })
  }), false)
}

{
  assert.equal(nearBottomEdge(920, 1000, 96), true)
  assert.equal(nearBottomEdge(800, 1000, 96), false)
  assert.equal(nearTopEdge(20, 72), true)
  assert.equal(nearTopEdge(90, 72), false)
  assert.equal(nearRevealEdge(20, 1000, "top"), true)
  assert.equal(nearRevealEdge(920, 1000, "bottom"), true)
}

{
  assert.equal(detectFineHover(() => ({ matches: true })), true)
  assert.equal(detectFineHover((q) => ({ matches: q.includes("hover") })), false)
  assert.equal(detectFineHover(() => { throw new Error("no mq") }), false)
  const pager = { closest: (sel) => sel === ".pager" ? pager : null }
  const verse = { closest: () => null }
  assert.equal(pointerOverPager(pager), true)
  assert.equal(pointerOverPager(verse), false)
  assert.equal(pointerOverPager(null), false)

  assert.equal(shouldProximityReveal({ edge: "top", fineHover: true }), true)
  assert.equal(shouldProximityReveal({ edge: "bottom", fineHover: true }), false)
  assert.equal(shouldProximityReveal({ edge: "bottom", pointerType: "mouse" }), false)
  assert.equal(shouldProximityReveal({ edge: "bottom", pointerType: "pen" }), false)
  assert.equal(shouldProximityReveal({ edge: "bottom", pointerType: "touch" }), true)
  assert.equal(shouldProximityReveal({ edge: "bottom", pointerType: "touch", overPager: true }), false)
  assert.equal(shouldProximityReveal({ edge: "bottom", overPager: true, fineHover: false }), false)
  assert.equal(shouldProximityReveal({ edge: "bottom", fineHover: false }), true)

  const bottom = { clientY: 920, innerHeight: 1000, edge: "bottom" }
  assert.equal(shouldShowChromeFromPointer({ ...bottom, fineHover: true }), false)
  assert.equal(shouldShowChromeFromPointer({ ...bottom, pointerType: "mouse" }), false)
  assert.equal(shouldShowChromeFromPointer({ ...bottom, pointerType: "touch" }), true)
  assert.equal(shouldShowChromeFromPointer({ ...bottom, pointerType: "touch", overPager: true }), false)
  assert.equal(shouldShowChromeFromPointer({ clientY: 800, innerHeight: 1000, edge: "bottom", pointerType: "touch" }), false)
  assert.equal(shouldShowChromeFromPointer({ clientY: 20, innerHeight: 1000, edge: "top", fineHover: true }), true)
}

{
  const iconBtn = {
    nodeType: 1,
    matches: () => false,
    isContentEditable: false,
    closest: () => null
  }
  const root = { contains: (el) => el === iconBtn }
  assert.equal(chromeLocked({ activeElement: iconBtn, root }), false)
  assert.equal(nextChromeHidden({
    hidden: false,
    scrollY: 80,
    lastY: 40,
    locked: chromeLocked({ activeElement: iconBtn, root })
  }), true)

  const input = {
    nodeType: 1,
    matches: (sel) => String(sel).includes("input"),
    isContentEditable: false,
    closest: () => null
  }
  const inputRoot = { contains: (el) => el === input }
  assert.equal(chromeLocked({ activeElement: input, root: inputRoot }), true)
  assert.equal(nextChromeHidden({
    hidden: false,
    scrollY: 80,
    lastY: 40,
    locked: chromeLocked({ activeElement: input, root: inputRoot })
  }), false)

  assert.equal(chromeLocked({ suggestOpen: true, root, activeElement: iconBtn }), true)
  assert.equal(chromeLocked({ menuOpen: true, root, activeElement: iconBtn }), true)
  assert.equal(chromeLocked({ gridOpen: true, root, activeElement: iconBtn }), true)
}

{
  const classList = new Set()
  const reader = {
    classList: {
      toggle(name, on) {
        if (on) classList.add(name)
        else classList.delete(name)
      },
      contains(name) { return classList.has(name) }
    }
  }
  assert.equal(applyReaderChromeTuck(null, true), false)
  assert.equal(applyReaderChromeTuck(reader, true), true)
  assert.equal(classList.has("is-chrome-tucked"), true)
  assert.equal(applyReaderChromeTuck(reader, false), false)
  assert.equal(classList.has("is-chrome-tucked"), false)
}

console.log("chrome-hide: ok")
