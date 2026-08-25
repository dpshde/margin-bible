import { Controller } from "@hotwired/stimulus"
import {
  arrowBlockNav,
  backspaceAtStart,
  caretForNeighbor,
  indentSubtree,
  insertNewline,
  insertPastedLines,
  isEmptyBlocks,
  serializeBlocks,
  splitSibling
} from "../lib/outliner-blocks"

export default class extends Controller {
  static values = { slug: String }

  connect() {
    this.blocks = this.readRows()
    if (!this.blocks.length) {
      this.blocks = [{ id: this.element.dataset.emptyId || "b_empty", indent: 0, text: "" }]
      this.render()
    }
    this.onInput = this.onInput.bind(this)
    this.onKeydown = this.onKeydown.bind(this)
    this.onPaste = this.onPaste.bind(this)
    this.element.addEventListener("input", this.onInput)
    this.element.addEventListener("keydown", this.onKeydown)
    this.element.addEventListener("paste", this.onPaste)
  }

  disconnect() {
    this.element.removeEventListener("input", this.onInput)
    this.element.removeEventListener("keydown", this.onKeydown)
    this.element.removeEventListener("paste", this.onPaste)
  }

  payload() {
    this.syncFromDom()
    return {
      slug: this.slugValue || this.element.dataset.slug,
      text: serializeBlocks(this.blocks),
      blocks: this.blocks.map((block) => ({
        id: block.id,
        indent: block.indent,
        text: block.text
      }))
    }
  }

  isEmpty() {
    this.syncFromDom()
    return isEmptyBlocks(this.blocks)
  }

  focusLast() {
    const last = this.element.querySelector(".oblock:last-child .otext")
    last?.focus()
    if (last) this.setCaret(last, this.readEditableText(last).length)
  }

  onInput(event) {
    if (!event.target.closest(".otext")) return
    this.syncFromDom()
    this.emitChange()
  }

  onKeydown(event) {
    const textEl = event.target.closest(".otext")
    if (!textEl || event.isComposing || event.keyCode === 229) return

    this.syncFromDom()
    const index = this.indexOf(textEl)
    if (index < 0) return

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      const created = splitSibling(this.blocks, index, this.caretOffset(textEl))
      this.render(created.id, 0)
      this.emitChange()
      return
    }

    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault()
      const caret = insertNewline(this.blocks, index, this.caretOffset(textEl))
      this.render(this.blocks[index].id, caret)
      this.emitChange()
      return
    }

    if (event.key === "Tab") {
      event.preventDefault()
      if (indentSubtree(this.blocks, index, event.shiftKey ? -1 : 1)) {
        this.render(this.blocks[index].id, this.caretOffset(textEl))
        this.emitChange()
      }
      return
    }

    if (event.key === "Backspace" && this.caretOffset(textEl) === 0) {
      const result = backspaceAtStart(this.blocks, index)
      if (!result.changed) return
      event.preventDefault()
      this.render(result.focusId, result.caret)
      this.emitChange()
      return
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      this.handleArrow(event, textEl, index)
    }
  }

  handleArrow(event, textEl, index) {
    const nav = arrowBlockNav({
      key: event.key,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      index,
      length: this.blocks.length,
      atFirstVisualLine: this.atFirstVisualLine(textEl),
      atLastVisualLine: this.atLastVisualLine(textEl)
    })
    if (!nav || nav.action === "within") return

    event.preventDefault()
    event.stopPropagation()
    if (nav.action !== "leave") return

    const neighbor = this.blocks[nav.index]
    const caretX = this.caretLineRect()?.left
    const caret = caretForNeighbor(nav.direction, neighbor.text.length)
    this.focusBlock(neighbor.id, caret, caretX, nav.direction < 0 ? "end" : "start")
  }

  onPaste(event) {
    const textEl = event.target.closest(".otext")
    if (!textEl) return
    event.preventDefault()
    const paste = (event.clipboardData || window.clipboardData).getData("text") || ""
    this.syncFromDom()
    const index = this.indexOf(textEl)
    const result = insertPastedLines(this.blocks, index, this.caretOffset(textEl), paste)
    this.render(result.focusId, result.caret)
    this.emitChange()
  }

  emitChange() {
    this.dispatch("change")
  }

  readRows() {
    return [...this.element.querySelectorAll(".oblock")].map((row) => ({
      id: row.dataset.blockId,
      indent: Number.parseInt(row.style.getPropertyValue("--depth") || "0", 10) || 0,
      text: this.readEditableText(row.querySelector(".otext"))
    }))
  }

  syncFromDom() {
    const rows = this.readRows()
    if (rows.length) this.blocks = rows
  }

  indexOf(textEl) {
    const id = textEl.closest(".oblock")?.dataset.blockId
    return this.blocks.findIndex((block) => block.id === id)
  }

  render(focusId, caret) {
    const fragment = document.createDocumentFragment()
    this.blocks.forEach((block) => fragment.append(this.rowElement(block)))
    this.element.replaceChildren(fragment)
    if (!focusId) return
    this.focusBlock(focusId, caret)
  }

  focusBlock(focusId, caret, caretX, edge) {
    const textEl = this.element.querySelector(`[data-block-id="${CSS.escape(focusId)}"] .otext`)
    if (!textEl) return
    textEl.focus({ preventScroll: true })
    if (caretX != null && Number.isFinite(caretX)) {
      this.placeCaretAtColumn(textEl, caretX, edge || (caret === 0 ? "start" : "end"))
      return
    }
    if (caret != null) this.setCaret(textEl, caret)
  }

  rowElement(block) {
    const row = document.createElement("div")
    row.className = "oblock"
    row.dataset.blockId = block.id
    row.style.setProperty("--depth", String(block.indent))

    const bullet = document.createElement("span")
    bullet.className = "obullet"
    bullet.setAttribute("aria-hidden", "true")

    const text = document.createElement("div")
    text.className = "otext"
    text.contentEditable = "true"
    text.setAttribute("role", "textbox")
    text.setAttribute("aria-multiline", "true")
    text.spellcheck = true
    this.fillEditable(text, block.text)

    row.append(bullet, text)
    return row
  }

  editableNodes(element) {
    const nodes = []
    const visit = (node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) nodes.push(child)
        else if (child.nodeName === "BR") nodes.push(child)
        else visit(child)
      })
    }
    if (element) visit(element)
    return nodes
  }

  readEditableText(element) {
    return this.editableNodes(element).map((node) => (
      node.nodeName === "BR" ? "\n" : node.nodeValue
    )).join("")
  }

  fillEditable(element, text) {
    element.replaceChildren()
    const lines = String(text).split("\n")
    lines.forEach((line, i) => {
      element.append(document.createTextNode(line))
      if (i < lines.length - 1) element.append(document.createElement("br"))
    })
  }

  caretOffset(element) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !element.contains(selection.anchorNode)) {
      return this.readEditableText(element).length
    }
    const range = selection.getRangeAt(0)
    const prefix = range.cloneRange()
    prefix.selectNodeContents(element)
    prefix.setEnd(range.endContainer, range.endOffset)
    return prefix.toString().length + prefix.cloneContents().querySelectorAll("br").length
  }

  setCaret(element, offset) {
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    let remaining = Math.max(0, offset)
    for (const node of this.editableNodes(element)) {
      const length = node.nodeName === "BR" ? 1 : node.nodeValue.length
      if (remaining <= length) {
        if (node.nodeName === "BR") {
          if (remaining === 0) range.setStartBefore(node)
          else range.setStartAfter(node)
        } else {
          range.setStart(node, remaining)
        }
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        return
      }
      remaining -= length
    }
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  caretLineRect() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    let rect = range.getBoundingClientRect()
    if (rect.height === 0) {
      const first = range.getClientRects()[0]
      if (first) rect = first
    }
    return rect.height === 0 ? null : rect
  }

  atFirstVisualLine(element) {
    const rect = this.caretLineRect()
    if (!rect) return this.caretOffset(element) === 0
    return rect.top - element.getBoundingClientRect().top < rect.height / 2
  }

  atLastVisualLine(element) {
    const rect = this.caretLineRect()
    if (!rect) return this.caretOffset(element) === this.readEditableText(element).length
    return element.getBoundingClientRect().bottom - rect.bottom < rect.height / 2
  }

  placeCaretAtColumn(element, x, edge) {
    const text = this.readEditableText(element)
    if (!text) {
      this.setCaret(element, 0)
      return
    }
    this.setCaret(element, edge === "start" ? 0 : text.length)
    const lineTop = this.caretLineRect()?.top
    let lo = 0
    let hi = text.length
    let best = edge === "start" ? 0 : text.length
    let bestDist = Infinity
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      this.setCaret(element, mid)
      const rect = this.caretLineRect()
      if (!rect) {
        best = mid
        break
      }
      const onLine = lineTop == null || Math.abs(rect.top - lineTop) < rect.height / 2
      if (!onLine) {
        if (edge === "start") hi = mid - 1
        else lo = mid + 1
        continue
      }
      const dist = Math.abs(rect.left - x)
      if (dist < bestDist) {
        bestDist = dist
        best = mid
      }
      if (rect.left < x) lo = mid + 1
      else hi = mid - 1
    }
    this.setCaret(element, best)
  }
}
