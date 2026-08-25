import assert from "node:assert/strict"
import {
  normalizeSpan,
  passageLabel,
  rangeSlug,
  selectionFromDrag,
  selectionFromTap
} from "../../app/javascript/lib/passage-span.js"

{
  assert.deepEqual(selectionFromTap(8), { start: 8, end: 8 })
  const first = selectionFromTap(8)
  const second = selectionFromTap(14)
  assert.deepEqual(second, { start: 14, end: 14 })
  assert.notDeepEqual(second, normalizeSpan(first.start, 14))
  assert.deepEqual(selectionFromTap(8), { start: 8, end: 8 })
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

console.log("passage-span: ok")
