import assert from "node:assert/strict"
import {
  belongsToChapter,
  hrefForSlug,
  normalizeSpan,
  passageLabel,
  rangeSlug,
  selectionFromDrag,
  selectionFromTap,
  slugLabel
} from "../../app/javascript/lib/passage-span.js"

{
  assert.deepEqual(selectionFromTap(8), { start: 8, end: 8 })
  const first = selectionFromTap(8)
  const second = selectionFromTap(14, first)
  assert.deepEqual(second, { start: 14, end: 14 })
  assert.notDeepEqual(second, normalizeSpan(first.start, 14))
  assert.equal(selectionFromTap(8, first), null)
  assert.equal(selectionFromTap(7, { start: 3, end: 7 }), null)
  assert.deepEqual(selectionFromTap(3, { start: 3, end: 7 }), { start: 3, end: 3 })
}

{
  assert.deepEqual(selectionFromDrag(3, 7), { start: 3, end: 7 })
  assert.deepEqual(selectionFromDrag(7, 3), { start: 3, end: 7 })
  assert.deepEqual(selectionFromDrag(3, 3), { start: 3, end: 3 })
  assert.equal(rangeSlug("jhn.1", 3, 7), "jhn.1.3-7")
  assert.equal(rangeSlug("jhn.1", 7, 3), "jhn.1.3-7")
  assert.equal(rangeSlug("jhn.1", 8, 8), "jhn.1.8")
  assert.equal(passageLabel("John", 1, 3, 7), "John 1:3–7")
}

{
  assert.equal(slugLabel("jhn.1.16"), "John 1:16")
  assert.equal(slugLabel("jhn.1.3-7"), "John 1:3–7")
  assert.equal(slugLabel("jhn.1"), "John 1")
  assert.equal(hrefForSlug("jhn.1"), "/jhn.1?chapter_note=1")
  assert.equal(belongsToChapter("jhn.1.16", "jhn.1"), true)
  assert.equal(belongsToChapter("jhn.10.1", "jhn.1"), false)
}

console.log("passage-span: ok")
