import assert from "node:assert/strict"
import {
  chapterSwipe,
  isHorizontalIntent,
  isTapGesture,
  lockSwipeAxis,
  rangeDragIntent,
  versePointerDecision
} from "../../app/javascript/lib/chapter-swipe.js"

{
  assert.equal(chapterSwipe({ dx: -110, dy: 8, elapsedMs: 280 }), "next")
  assert.equal(chapterSwipe({ dx: 110, dy: -6, elapsedMs: 260 }), "prev")
}

{
  // Tiny / old-sensitive paths stay idle. Before: 36px + 0.5px/ms committed.
  assert.equal(chapterSwipe({ dx: -40, dy: 4, elapsedMs: 80 }), null)
  assert.equal(chapterSwipe({ dx: 20, dy: 2, elapsedMs: 40 }), null)
  assert.equal(chapterSwipe({ dx: -90, dy: 8, elapsedMs: 220 }), null)
  assert.equal(chapterSwipe({ dx: -99, dy: 8, elapsedMs: 400 }), null)
  assert.equal(chapterSwipe({ dx: -100, dy: 8, elapsedMs: 400 }), "next")
  // Clear flick: 70px at 1.0 px/ms.
  assert.equal(chapterSwipe({ dx: -70, dy: 6, elapsedMs: 70 }), "next")
  assert.equal(chapterSwipe({ dx: -56, dy: 4, elapsedMs: 200 }), null)
  assert.equal(chapterSwipe({ dx: -110, dy: 8, elapsedMs: 280, rangeDragging: true }), null)
  assert.equal(chapterSwipe({ dx: -110, dy: 8, elapsedMs: 280, startedOnChrome: true }), null)
  assert.equal(chapterSwipe({ dx: -110, dy: 8, elapsedMs: 280, startedOnControl: true }), null)
  assert.equal(chapterSwipe({ dx: 12, dy: 90, elapsedMs: 180 }), null)
  // |dy| > |dx| * 0.7 is a vertical pan (90 * 0.7 = 63).
  assert.equal(chapterSwipe({ dx: -90, dy: 80, elapsedMs: 180 }), null)
  assert.equal(chapterSwipe({ dx: -110, dy: 80, elapsedMs: 220 }), null)
  assert.equal(chapterSwipe({ dx: -110, dy: 70, elapsedMs: 220 }), "next")
}

{
  assert.equal(lockSwipeAxis(4, 3), null)
  assert.equal(lockSwipeAxis(20, 10), "horizontal")
  assert.equal(lockSwipeAxis(20, 16), "vertical")
  assert.equal(lockSwipeAxis(20, 20), "vertical")
  assert.equal(lockSwipeAxis(80, 90, "horizontal"), "horizontal")
  assert.equal(isHorizontalIntent(-40, 8), true)
  assert.equal(isHorizontalIntent(-40, 40), false)
  assert.equal(isTapGesture(4, 3), true)
  assert.equal(isTapGesture(20, 0), false)
  assert.equal(chapterSwipe({ dx: -110, dy: 20, elapsedMs: 240, rangeDragging: true }), null)
  assert.equal(chapterSwipe({ dx: -110, dy: 20, elapsedMs: 240 }), "next")
  assert.equal(chapterSwipe({ dx: -110, dy: 8, elapsedMs: 240, axis: "vertical" }), null)
  assert.equal(chapterSwipe({ dx: -40, dy: 8, elapsedMs: 80, axis: "horizontal" }), null)
  assert.equal(chapterSwipe({ dx: -70, dy: 20, elapsedMs: 70, axis: "horizontal" }), "next")
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
  assert.equal(rangeDragIntent({
    startVerse: 3, currentVerse: 7, startVerseTop: 120, currentStartVerseTop: 120, dx: 80, dy: 90, axis: "horizontal"
  }), false)
}

{
  assert.deepEqual(versePointerDecision({
    dx: 4, dy: 90, elapsedMs: 240, startVerse: 3, endVerse: 7, dragging: true
  }), { type: "range", start: 3, end: 7 })
  assert.deepEqual(versePointerDecision({
    dx: 3, dy: 2, elapsedMs: 80, startVerse: 3, endVerse: 3, dragging: false
  }), { type: "tap", verse: 3 })
  // Press on a verse/note control never chapter-swipes.
  assert.equal(versePointerDecision({
    dx: -110, dy: 8, elapsedMs: 280, startVerse: 3, endVerse: 3, dragging: false
  }).type, "idle")
  assert.equal(versePointerDecision({
    dx: -110, dy: 8, elapsedMs: 280, startVerse: 3, endVerse: 7, dragging: true
  }).type, "range")
  assert.equal(versePointerDecision({
    dx: 8, dy: 40, elapsedMs: 180, startVerse: 3, endVerse: 3, dragging: false
  }).type, "idle")
  assert.deepEqual(versePointerDecision({
    dx: 4, dy: 90, elapsedMs: 240, startVerse: 3, endVerse: 7, dragging: false
  }), { type: "range", start: 3, end: 7 })
  assert.equal(versePointerDecision({
    dx: 3, dy: 2, elapsedMs: 80, startVerse: 3, endVerse: 7, dragging: false
  }).type, "tap")
  assert.deepEqual(versePointerDecision({
    dx: -110, dy: 8, elapsedMs: 280, startVerse: null, endVerse: null, dragging: false
  }), { type: "chapter", direction: "next" })
  assert.equal(versePointerDecision({
    dx: -110, dy: 8, elapsedMs: 280, startVerse: null, endVerse: null, dragging: false, axis: "vertical"
  }).type, "idle")
  assert.equal(versePointerDecision({
    dx: -110, dy: 8, elapsedMs: 280, startVerse: null, endVerse: null, dragging: false, startedOnControl: true
  }).type, "idle")
}

console.log("chapter-swipe: ok")
