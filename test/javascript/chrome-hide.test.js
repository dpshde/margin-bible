import assert from "node:assert/strict"
import {
  chromeLocked,
  nearBottomEdge,
  nearRevealEdge,
  nearTopEdge,
  nextChromeHidden
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
  assert.equal(nearBottomEdge(920, 1000, 96), true)
  assert.equal(nearBottomEdge(800, 1000, 96), false)
  assert.equal(nearTopEdge(20, 72), true)
  assert.equal(nearTopEdge(90, 72), false)
  assert.equal(nearRevealEdge(20, 1000, "top"), true)
  assert.equal(nearRevealEdge(920, 1000, "bottom"), true)
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

console.log("chrome-hide: ok")
