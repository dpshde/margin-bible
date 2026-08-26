export function newBlockId() {
  const bytes = new Uint8Array(4)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return `b_${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`
}

export function newBlock(indent = 0, text = "", id = newBlockId(), { bullet = true } = {}) {
  return { id, indent, text, bullet }
}

export function blockHasBullet(block) {
  return block?.bullet !== false
}

export function subtreeEnd(blocks, index) {
  const base = blocks[index].indent
  let cursor = index + 1
  while (cursor < blocks.length && blocks[cursor].indent > base) cursor += 1
  return cursor
}

export function clampIndent(blocks) {
  for (let i = 0; i < blocks.length; i += 1) {
    if (i === 0) {
      blocks[i].indent = 0
    } else {
      blocks[i].indent = Math.max(0, Math.min(blocks[i].indent, blocks[i - 1].indent + 1))
    }
  }
  return blocks
}

export function indentSubtree(blocks, index, delta) {
  if (delta > 0) {
    if (index === 0) return false
    if (blocks[index].indent >= blocks[index - 1].indent + 1) return false
  } else if (blocks[index].indent <= 0) {
    return false
  }

  const end = subtreeEnd(blocks, index)
  for (let cursor = index; cursor < end; cursor += 1) {
    blocks[cursor].indent += delta
  }
  clampIndent(blocks)
  return true
}

export function splitSibling(blocks, index, offset) {
  const current = blocks[index]
  const left = current.text.slice(0, offset)
  const right = current.text.slice(offset)
  current.text = left
  const created = newBlock(current.indent, right)
  blocks.splice(subtreeEnd(blocks, index), 0, created)
  return created
}

const LIST_MARKER = /^[-–—*+•]\s+/

export function consumeListMarker(block) {
  const text = String(block.text || "")
  const match = text.match(LIST_MARKER)
  if (!match) return 0
  block.bullet = true
  block.text = text.slice(match[0].length)
  return match[0].length
}

export function shouldBulletOnSpace(text, offset) {
  const value = String(text || "")
  return offset === value.length && /^[-–—*+]$/.test(value)
}

export function insertNewline(blocks, index, offset) {
  const current = blocks[index]
  current.text = `${current.text.slice(0, offset)}\n${current.text.slice(offset)}`
  return offset + 1
}

export function backspaceAtStart(blocks, index) {
  const current = blocks[index]
  if (blockHasBullet(current)) {
    current.bullet = false
    return { changed: true, focusId: current.id, caret: 0 }
  }

  if (index <= 0) {
    return { changed: false, focusId: current.id, caret: 0 }
  }

  const previous = blocks[index - 1]
  const caret = previous.text.length

  if (!current.text) {
    const end = subtreeEnd(blocks, index)
    for (let cursor = index + 1; cursor < end; cursor += 1) {
      blocks[cursor].indent = Math.max(0, blocks[cursor].indent - 1)
    }
  } else {
    previous.text += current.text
  }

  blocks.splice(index, 1)
  if (!blocks.length) blocks.push(newBlock(0, ""))
  clampIndent(blocks)
  return { changed: true, focusId: previous.id, caret }
}

export function serializeBlocks(blocks) {
  return blocks.map((block) => `${"  ".repeat(block.indent)}${block.text}`).join("\n")
}

export function isEmptyBlocks(blocks) {
  return blocks.every((block) => !String(block.text).trim())
}

export function arrowDirection(key) {
  if (key === "ArrowUp") return -1
  if (key === "ArrowDown") return 1
  return 0
}

export function neighborBlockIndex(index, direction, length) {
  const next = index + direction
  if (next < 0 || next >= length) return -1
  return next
}

export function shouldLeaveBlockOnArrow({
  direction,
  atFirstVisualLine,
  atLastVisualLine,
  singleVisualLine = false
}) {
  if (singleVisualLine) return true
  if (direction < 0) return Boolean(atFirstVisualLine)
  if (direction > 0) return Boolean(atLastVisualLine)
  return false
}

export function caretForNeighbor(direction, neighborTextLength) {
  return direction < 0 ? neighborTextLength : 0
}

export function arrowBlockNav({
  key,
  shiftKey = false,
  altKey = false,
  metaKey = false,
  ctrlKey = false,
  index,
  length,
  atFirstVisualLine,
  atLastVisualLine,
  singleVisualLine = false
}) {
  if (shiftKey || altKey || metaKey || ctrlKey) return null
  const direction = arrowDirection(key)
  if (!direction) return null
  if (!shouldLeaveBlockOnArrow({ direction, atFirstVisualLine, atLastVisualLine, singleVisualLine })) {
    return { action: "within" }
  }
  const next = neighborBlockIndex(index, direction, length)
  if (next < 0) return { action: "edge" }
  return { action: "leave", index: next, direction }
}

export function nextSelectScope(scope) {
  return scope === "line" ? "all" : "line"
}

export function insertPastedLines(blocks, index, offset, paste) {
  const lines = paste.replace(/\r\n/g, "\n").split("\n")
  const current = blocks[index]
  if (lines.length === 1) {
    current.text = current.text.slice(0, offset) + lines[0] + current.text.slice(offset)
    return { focusId: current.id, caret: offset + lines[0].length }
  }

  const after = current.text.slice(offset)
  current.text = current.text.slice(0, offset) + lines[0]
  const created = lines.slice(1).map((line, lineIndex, list) => {
    const isLast = lineIndex === list.length - 1
    return newBlock(current.indent, line + (isLast ? after : ""))
  })
  blocks.splice(index + 1, 0, ...created)
  const last = created[created.length - 1]
  return { focusId: last.id, caret: lines[lines.length - 1].length }
}
