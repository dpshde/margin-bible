import assert from "node:assert/strict"
import { nearBottomEdge, nextChromeHidden } from "../../app/javascript/lib/chrome-hide.js"

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
}

console.log("chrome-hide: ok")
