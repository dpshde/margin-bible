import assert from "node:assert/strict"
import { chapterSwipe, isHorizontalIntent, isTapGesture } from "../../app/javascript/lib/chapter-swipe.js"

{
  assert.equal(chapterSwipe({ dx: -90, dy: 8, elapsedMs: 220 }), "next")
  assert.equal(chapterSwipe({ dx: 90, dy: -6, elapsedMs: 200 }), "prev")
}

{
  assert.equal(chapterSwipe({ dx: -40, dy: 4, elapsedMs: 80 }), "next")
  assert.equal(chapterSwipe({ dx: 20, dy: 2, elapsedMs: 40 }), null)
  assert.equal(chapterSwipe({ dx: -90, dy: 80, elapsedMs: 180 }), null)
  assert.equal(chapterSwipe({ dx: -90, dy: 8, elapsedMs: 220, rangeDragging: true }), null)
  assert.equal(chapterSwipe({ dx: -90, dy: 8, elapsedMs: 220, startedOnChrome: true }), null)
  assert.equal(chapterSwipe({ dx: -50, dy: 4, elapsedMs: 400 }), null)
  assert.equal(chapterSwipe({ dx: 12, dy: 90, elapsedMs: 180 }), null)
}

{
  assert.equal(isHorizontalIntent(-40, 8), true)
  assert.equal(isHorizontalIntent(-40, 40), false)
  assert.equal(isTapGesture(4, 3), true)
  assert.equal(isTapGesture(20, 0), false)
  assert.equal(chapterSwipe({ dx: -90, dy: 20, elapsedMs: 180, rangeDragging: true }), null)
  assert.equal(chapterSwipe({ dx: -90, dy: 20, elapsedMs: 180 }), "next")
}

console.log("chapter-swipe: ok")
