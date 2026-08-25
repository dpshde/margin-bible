import assert from "node:assert/strict"
import { chapterSwipe } from "../../app/javascript/lib/chapter-swipe.js"

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

console.log("chapter-swipe: ok")
