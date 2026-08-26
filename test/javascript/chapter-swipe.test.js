import assert from "node:assert/strict"
import {
  chapterSwipe,
  isHorizontalIntent,
  isTapGesture,
  rangeDragIntent,
  versePointerDecision
} from "../../app/javascript/lib/chapter-swipe.js"

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

{
  assert.equal(rangeDragIntent({
    startVerse: 3, currentVerse: 7, startVerseTop: 120, currentStartVerseTop: 120, dx: 4, dy: 80
  }), true)
  assert.equal(rangeDragIntent({
    startVerse: 3, currentVerse: 3, startVerseTop: 120, currentStartVerseTop: 120, dx: 4, dy: 80
  }), false)
  assert.equal(rangeDragIntent({
    startVerse: 3, currentVerse: 7, startVerseTop: 120, currentStartVerseTop: 120, dx: 80, dy: 10
  }), false)
  assert.equal(rangeDragIntent({
    startVerse: 3, currentVerse: 7, startVerseTop: 120, currentStartVerseTop: 160, dx: 4, dy: 40
  }), false)
}

{
  assert.deepEqual(versePointerDecision({
    dx: 4, dy: 90, elapsedMs: 240, startVerse: 3, endVerse: 7, dragging: true
  }), { type: "range", start: 3, end: 7 })
  assert.deepEqual(versePointerDecision({
    dx: 3, dy: 2, elapsedMs: 80, startVerse: 3, endVerse: 3, dragging: false
  }), { type: "tap", verse: 3 })
  assert.deepEqual(versePointerDecision({
    dx: -90, dy: 8, elapsedMs: 220, startVerse: 3, endVerse: 3, dragging: false
  }), { type: "chapter", direction: "next" })
  assert.equal(versePointerDecision({
    dx: -90, dy: 8, elapsedMs: 220, startVerse: 3, endVerse: 7, dragging: true
  }).type, "range")
  assert.equal(versePointerDecision({
    dx: 8, dy: 40, elapsedMs: 180, startVerse: 3, endVerse: 3, dragging: false
  }).type, "idle")
}

console.log("chapter-swipe: ok")
