import assert from "node:assert/strict"
import {
  arrowBlockNav,
  arrowDirection,
  backspaceAtStart,
  caretForNeighbor,
  consumeListMarker,
  indentSubtree,
  shouldBulletOnSpace,
  insertNewline,
  insertPastedLines,
  isEmptyBlocks,
  neighborBlockIndex,
  nextSelectScope,
  serializeBlocks,
  shouldLeaveBlockOnArrow,
  splitSibling,
  subtreeEnd
} from "../../app/javascript/lib/outliner-blocks.js"

const parent = { id: "b_aa01", indent: 0, text: "Parent", bullet: false }
const child = { id: "b_bb02", indent: 1, text: "Child", bullet: true }
const uncle = { id: "b_cc03", indent: 0, text: "Uncle", bullet: false }

function clone(blocks) {
  return blocks.map((block) => ({ ...block }))
}

{
  const blocks = clone([parent, child, uncle])
  assert.equal(subtreeEnd(blocks, 0), 2)
  const created = splitSibling(blocks, 0, 6)
  assert.equal(blocks[0].text, "Parent")
  assert.equal(created.indent, 0)
  assert.equal(created.text, "")
  assert.equal(created.bullet, false)
  assert.equal(blocks[1].id, "b_bb02")
  assert.equal(blocks[2].id, created.id)
  assert.equal(blocks[3].id, "b_cc03")
}

{
  const blocks = clone([parent])
  const created = splitSibling(blocks, 0, 3)
  assert.equal(blocks[0].text, "Par")
  assert.equal(created.text, "ent")
  assert.equal(created.indent, 0)
}

{
  const blocks = clone([parent, child])
  assert.equal(indentSubtree(blocks, 1, 1), false)
  assert.equal(indentSubtree(blocks, 1, -1), true)
  assert.equal(blocks[1].indent, 0)
  assert.equal(indentSubtree(blocks, 1, 1), true)
  assert.equal(blocks[1].indent, 1)
}

{
  const blocks = clone([parent, child])
  assert.equal(indentSubtree(blocks, 0, 1), false)
  assert.equal(indentSubtree(blocks, 0, -1), false)
}

{
  const nested = { id: "b_dd04", indent: 2, text: "Nested" }
  const blocks = clone([parent, child, nested, uncle])
  assert.equal(indentSubtree(blocks, 1, -1), true)
  assert.equal(blocks[1].indent, 0)
  assert.equal(blocks[2].indent, 1)
}

{
  const blocks = clone([{ id: "b_ee05", indent: 0, text: "One line" }])
  const caret = insertNewline(blocks, 0, 3)
  assert.equal(blocks[0].text, "One\n line")
  assert.equal(caret, 4)
  assert.equal(blocks.length, 1)
}

{
  const blocks = clone([parent, { id: "b_ff06", indent: 0, text: "", bullet: false }])
  const result = backspaceAtStart(blocks, 1)
  assert.equal(result.changed, true)
  assert.equal(result.focusId, "b_aa01")
  assert.equal(result.caret, 6)
  assert.equal(blocks.length, 1)
}

{
  const blocks = clone([parent, { id: "b_gg07", indent: 0, text: "Tail", bullet: false }])
  const result = backspaceAtStart(blocks, 1)
  assert.equal(result.changed, true)
  assert.equal(blocks[0].text, "ParentTail")
  assert.equal(result.caret, 6)
  assert.equal(blocks.length, 1)
}

{
  const blocks = clone([{ id: "b_hh08", indent: 0, text: "", bullet: false }])
  const result = backspaceAtStart(blocks, 0)
  assert.equal(result.changed, false)
  assert.equal(blocks.length, 1)
}

{
  const emptyChild = { id: "b_ii09", indent: 1, text: "", bullet: false }
  const grandchild = { id: "b_jj0a", indent: 2, text: "Keep", bullet: false }
  const blocks = clone([parent, emptyChild, grandchild])
  backspaceAtStart(blocks, 1)
  assert.equal(blocks.length, 2)
  assert.equal(blocks[1].id, "b_jj0a")
  assert.equal(blocks[1].indent, 1)
}

{
  const blocks = clone([{ id: "b_bullet", indent: 0, text: "Keep the line", bullet: true }])
  const result = backspaceAtStart(blocks, 0)
  assert.equal(result.changed, true)
  assert.equal(result.focusId, "b_bullet")
  assert.equal(result.caret, 0)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].bullet, false)
  assert.equal(blocks[0].text, "Keep the line")
}

{
  const block = { id: "b_mark", indent: 0, text: "- Hello", bullet: false }
  assert.equal(consumeListMarker(block), 2)
  assert.equal(block.bullet, true)
  assert.equal(block.text, "Hello")
  assert.equal(consumeListMarker(block), 0)
}

{
  const leftover = { id: "b_left", indent: 0, text: "- ", bullet: true }
  assert.equal(consumeListMarker(leftover), 2)
  assert.equal(leftover.text, "")
  assert.equal(shouldBulletOnSpace("-", 1), true)
  assert.equal(shouldBulletOnSpace("*", 1), true)
  assert.equal(shouldBulletOnSpace("- Hello", 7), false)
  assert.equal(shouldBulletOnSpace("", 0), false)
}

{
  assert.equal(shouldLeaveBlockOnArrow({
    direction: 1, atFirstVisualLine: false, atLastVisualLine: false, singleVisualLine: true
  }), true)
}

{
  const blocks = clone([parent, child])
  assert.equal(serializeBlocks(blocks), "Parent\n  Child")
  assert.equal(isEmptyBlocks(blocks), false)
  assert.equal(isEmptyBlocks([{ id: "b_kk0b", indent: 0, text: "  " }]), true)
}

{
  const blocks = clone([parent])
  const result = insertPastedLines(blocks, 0, 6, "A\nB\nC")
  assert.equal(blocks[0].text, "ParentA")
  assert.equal(blocks[1].text, "B")
  assert.equal(blocks[2].text, "C")
  assert.equal(result.focusId, blocks[2].id)
  assert.equal(result.caret, 1)
}

{
  assert.equal(arrowDirection("ArrowUp"), -1)
  assert.equal(arrowDirection("ArrowDown"), 1)
  assert.equal(arrowDirection("ArrowLeft"), 0)
  assert.equal(neighborBlockIndex(0, -1, 3), -1)
  assert.equal(neighborBlockIndex(0, 1, 3), 1)
  assert.equal(neighborBlockIndex(2, 1, 3), -1)
  assert.equal(caretForNeighbor(-1, 12), 12)
  assert.equal(caretForNeighbor(1, 12), 0)
  assert.equal(shouldLeaveBlockOnArrow({ direction: -1, atFirstVisualLine: true, atLastVisualLine: false }), true)
  assert.equal(shouldLeaveBlockOnArrow({ direction: -1, atFirstVisualLine: false, atLastVisualLine: true }), false)
  assert.equal(shouldLeaveBlockOnArrow({ direction: 1, atFirstVisualLine: true, atLastVisualLine: true }), true)
  assert.equal(shouldLeaveBlockOnArrow({ direction: 1, atFirstVisualLine: true, atLastVisualLine: false }), false)
}

{
  const leaveDown = arrowBlockNav({
    key: "ArrowDown", index: 0, length: 3, atFirstVisualLine: true, atLastVisualLine: true
  })
  assert.deepEqual(leaveDown, { action: "leave", index: 1, direction: 1 })

  const within = arrowBlockNav({
    key: "ArrowDown", index: 0, length: 3, atFirstVisualLine: true, atLastVisualLine: false
  })
  assert.deepEqual(within, { action: "within" })

  const leaveUp = arrowBlockNav({
    key: "ArrowUp", index: 1, length: 3, atFirstVisualLine: true, atLastVisualLine: false
  })
  assert.deepEqual(leaveUp, { action: "leave", index: 0, direction: -1 })

  const edge = arrowBlockNav({
    key: "ArrowUp", index: 0, length: 3, atFirstVisualLine: true, atLastVisualLine: true
  })
  assert.deepEqual(edge, { action: "edge" })

  assert.equal(arrowBlockNav({
    key: "ArrowDown", shiftKey: true, index: 0, length: 3, atFirstVisualLine: true, atLastVisualLine: true
  }), null)
  assert.equal(arrowBlockNav({
    key: "Tab", index: 0, length: 3, atFirstVisualLine: true, atLastVisualLine: true
  }), null)
}

{
  assert.equal(nextSelectScope(null), "line")
  assert.equal(nextSelectScope("line"), "all")
  assert.equal(nextSelectScope("all"), "line")
}

console.log("outliner-blocks: ok")
