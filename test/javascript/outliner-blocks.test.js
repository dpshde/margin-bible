import assert from "node:assert/strict"
import {
  backspaceAtStart,
  indentSubtree,
  insertNewline,
  insertPastedLines,
  isEmptyBlocks,
  serializeBlocks,
  splitSibling,
  subtreeEnd
} from "../../app/javascript/lib/outliner-blocks.js"

const parent = { id: "b_aa01", indent: 0, text: "Parent" }
const child = { id: "b_bb02", indent: 1, text: "Child" }
const uncle = { id: "b_cc03", indent: 0, text: "Uncle" }

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
  const blocks = clone([parent, { id: "b_ff06", indent: 0, text: "" }])
  const result = backspaceAtStart(blocks, 1)
  assert.equal(result.changed, true)
  assert.equal(result.focusId, "b_aa01")
  assert.equal(result.caret, 6)
  assert.equal(blocks.length, 1)
}

{
  const blocks = clone([parent, { id: "b_gg07", indent: 0, text: "Tail" }])
  const result = backspaceAtStart(blocks, 1)
  assert.equal(result.changed, true)
  assert.equal(blocks[0].text, "ParentTail")
  assert.equal(result.caret, 6)
  assert.equal(blocks.length, 1)
}

{
  const blocks = clone([{ id: "b_hh08", indent: 0, text: "" }])
  const result = backspaceAtStart(blocks, 0)
  assert.equal(result.changed, false)
  assert.equal(blocks.length, 1)
}

{
  const emptyChild = { id: "b_ii09", indent: 1, text: "" }
  const grandchild = { id: "b_jj0a", indent: 2, text: "Keep" }
  const blocks = clone([parent, emptyChild, grandchild])
  backspaceAtStart(blocks, 1)
  assert.equal(blocks.length, 2)
  assert.equal(blocks[1].id, "b_jj0a")
  assert.equal(blocks[1].indent, 1)
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

console.log("outliner-blocks: ok")
