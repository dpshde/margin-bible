import { Controller } from "@hotwired/stimulus"
import {
  arrowBlockNav,
  backspaceAtStart,
  blockHasBullet,
  caretForNeighbor,
  consumeListMarker,
  indentSubtree,
  shouldBulletOnSpace,
  insertNewline,
  insertPastedLines,
  isEmptyBlocks,
  nextSelectScope,
  serializeBlocks,
  splitSibling
} from "../lib/outliner-blocks"
import { wikiTokens } from "../lib/wiki-markup"

export default class extends Controller {
  static values = { slug: String }

  connect() {
    this.blocks = this.readRows()
    if (!this.blocks.length) {
      this.blocks = [{ id: this.element.dataset.emptyId || "b_empty", indent: 0, text: "", bullet: true }]
    }
    this.onInput = this.onInput.bind(this)
    this.onBeforeInput = this.onBeforeInput.bind(this)
    this.onKeydown = this.onKeydown.bind(this)
    this.onPaste = this.onPaste.bind(this)
    this.onFocusIn = this.onFocusIn.bind(this)
    this.onFocusOut = this.onFocusOut.bind(this)
    this.onMouseDown = this.onMouseDown.bind(this)
    this.onCopy = this.onCopy.bind(this)
    this.selectScope = null
    this.element.addEventListener("input", this.onInput)
    this.element.addEventListener("beforeinput", this.onBeforeInput)
    this.element.addEventListener("keydown", this.onKeydown)
    this.element.addEventListener("paste", this.onPaste)
    this.element.addEventListener("copy", this.onCopy)
    this.element.addEventListener("focusin", this.onFocusIn)
    this.element.addEventListener("focusout", this.onFocusOut)
    this.element.addEventListener("mousedown", this.onMouseDown)
    if (this.blocks.length) this.render()
  }

  disconnect() {
    this.element.removeEventListener("input", this.onInput)
    this.element.removeEventListener("beforeinput", this.onBeforeInput)
    this.element.removeEventListener("keydown", this.onKeydown)
    this.element.removeEventListener("paste", this.onPaste)
    this.element.removeEventListener("copy", this.onCopy)
    this.element.removeEventListener("focusin", this.onFocusIn)
    this.element.removeEventListener("focusout", this.onFocusOut)
    this.element.removeEventListener("mousedown", this.onMouseDown)
  }

  payload() {
    this.syncFromDom()
    return {
      slug: this.slugValue || this.element.dataset.slug,
      text: serializeBlocks(this.blocks),
      blocks: this.blocks.map((block) => ({
        id: block.id,
        indent: block.indent,
        text: block.text,
        bullet: blockHasBullet(block)
      }))
    }
  }

  isEmpty() {
    this.syncFromDom()
    return isEmptyBlocks(this.blocks)
  }

  applyBlocks(blocks) {
    const incoming = Array.isArray(blocks) && blocks.length
      ? blocks.map((block) => ({
        id: block.id || this.element.dataset.emptyId || "b_empty",
        indent: Number(block.indent) || 0,
        text: String(block.text || ""),
        bullet: blockHasBullet(block)
      }))
      : [{ id: this.element.dataset.emptyId || "b_empty", indent: 0, text: "", bullet: true }]
    this.blocks = incoming
    this.render()
  }

  focusLast() {
    const last = this.element.querySelector(".oblock:last-child .otext")
    last?.focus()
    if (last) this.setCaret(last, this.readEditableText(last).length)
  }

  onMouseDown(event) {
    this.clearSelectScope()
    const bullet = event.target.closest(".obullet")
    if (bullet && this.element.contains(bullet)) {
      event.preventDefault()
      const row = bullet.closest(".oblock")
      const index = this.blocks.findIndex((block) => block.id === row?.dataset.blockId)
      if (index < 0) return
      this.syncFromDom()
      this.blocks[index].bullet = !blockHasBullet(this.blocks[index])
      this.render(this.blocks[index].id, this.caretOffset(row.querySelector(".otext")))
      this.emitChange()
      return
    }

    const link = event.target.closest("a.wiki")
    if (!link || !this.element.contains(link)) return
    event.preventDefault()
    event.stopPropagation()
    const href = link.getAttribute("href")
    if (!href) return
    if (window.Turbo) window.Turbo.visit(href)
    else window.location.assign(href)
  }

  onFocusIn(event) {
    const textEl = event.target.closest(".otext")
    if (!textEl || !this.element.contains(textEl) || textEl.dataset.editing === "1") return
    const index = this.indexOf(textEl)
    if (index < 0) return
    const offset = this.caretOffset(textEl, { fallback: "keep" })
    textEl.dataset.editing = "1"
    this.fillEditable(textEl, this.blocks[index].text, { decorate: false })
    if (offset != null) this.setCaret(textEl, offset)
  }

  onFocusOut(event) {
    const textEl = event.target.closest(".otext")
    if (!textEl || !this.element.contains(textEl)) return
    this.syncFromDom()
    delete textEl.dataset.editing
    const index = this.indexOf(textEl)
    if (index < 0) return
    this.fillEditable(textEl, this.blocks[index].text, { decorate: true })
  }

  onBeforeInput(event) {
    if (event.data !== " ") return
    const textEl = event.target.closest(".otext")
    if (!textEl) return
    this.syncFromDom()
    const index = this.indexOf(textEl)
    if (index < 0) return
    if (!shouldBulletOnSpace(this.blocks[index].text, this.caretOffset(textEl))) return
    event.preventDefault()
    this.blocks[index].bullet = true
    this.blocks[index].text = ""
    this.render(this.blocks[index].id, 0)
    this.emitChange()
  }

  onInput(event) {
    const textEl = event.target.closest(".otext")
    if (!textEl) return
    this.syncFromDom()
    const index = this.indexOf(textEl)
    if (index >= 0 && consumeListMarker(this.blocks[index])) {
      this.render(this.blocks[index].id, 0)
    }
    this.clearSelectScope()
    this.emitChange()
  }

  onCopy(event) {
    if (this.selectScope !== "all") return
    event.preventDefault()
    event.clipboardData.setData("text/plain", serializeBlocks(this.blocks))
  }

  onKeydown(event) {
    const textEl = event.target.closest(".otext")
    if (!textEl || event.isComposing || event.keyCode === 229) return

    const selectAll = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a" && !event.altKey
    if (selectAll) {
      event.preventDefault()
      event.stopPropagation()
      this.cycleSelect(textEl)
      return
    }

    this.clearSelectScope()
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

    if (event.key === "ArrowLeft" && !event.shiftKey && this.atBlockStart(textEl) && index > 0) {
      event.preventDefault()
      const previous = this.blocks[index - 1]
      this.focusBlock(previous.id, previous.text.length)
      return
    }

    if (event.key === "ArrowRight" && !event.shiftKey && this.atBlockEnd(textEl) && index < this.blocks.length - 1) {
      event.preventDefault()
      this.focusBlock(this.blocks[index + 1].id, 0)
      return
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      this.handleArrow(event, textEl, index)
    }
  }

  cycleSelect(textEl) {
    this.selectScope = nextSelectScope(this.selectScope)
    if (this.selectScope === "all") {
      this.selectAllBlocks()
      return
    }
    this.selectCurrentLine(textEl)
  }

  selectCurrentLine(textEl) {
    this.element.classList.remove("is-selecting-all")
    const range = document.createRange()
    range.selectNodeContents(textEl)
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    selection.addRange(range)
  }

  selectAllBlocks() {
    this.element.classList.add("is-selecting-all")
    const selection = window.getSelection()
    selection?.removeAllRanges()
    const texts = [...this.element.querySelectorAll(".otext")]
    if (texts.length < 2) {
      if (texts[0]) this.selectCurrentLine(texts[0])
      return
    }
    const range = document.createRange()
    range.setStartBefore(texts[0])
    range.setEndAfter(texts[texts.length - 1])
    try {
      selection?.addRange(range)
    } catch {
      this.selectCurrentLine(texts[0])
    }
  }

  clearSelectScope() {
    this.selectScope = null
    this.element.classList.remove("is-selecting-all")
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
      atLastVisualLine: this.atLastVisualLine(textEl),
      singleVisualLine: this.singleVisualLine(textEl)
    })
    if (!nav || nav.action !== "leave") return

    event.preventDefault()
    event.stopPropagation()
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
    this.blocks.forEach((block) => consumeListMarker(block))
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
      text: this.readEditableText(row.querySelector(".otext")),
      bullet: row.dataset.bullet !== "0"
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
    const index = this.indexOf(textEl)
    if (index >= 0 && textEl.dataset.editing !== "1") {
      textEl.dataset.editing = "1"
      this.fillEditable(textEl, this.blocks[index].text, { decorate: false })
    }
    textEl.focus({ preventScroll: true })
    const place = () => {
      if (caretX != null && Number.isFinite(caretX)) {
        this.placeCaretAtColumn(textEl, caretX, edge || (caret === 0 ? "start" : "end"))
        return
      }
      if (caret != null) this.setCaret(textEl, caret)
    }
    place()
    requestAnimationFrame(place)
  }

  rowElement(block) {
    const row = document.createElement("div")
    const bulletOn = blockHasBullet(block)
    row.className = bulletOn ? "oblock is-bullet" : "oblock"
    row.dataset.blockId = block.id
    row.dataset.bullet = bulletOn ? "1" : "0"
    row.style.setProperty("--depth", String(block.indent))

    const bullet = document.createElement("span")
    bullet.className = "obullet"
    bullet.setAttribute("aria-hidden", "true")
    bullet.title = bulletOn ? "Remove bullet" : "Add bullet"

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
    const chunks = []
    const visit = (node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          chunks.push(child.nodeValue)
        } else if (child.nodeName === "BR") {
          chunks.push("\n")
        } else if (child.nodeType === Node.ELEMENT_NODE && child.matches("a.wiki")) {
          chunks.push(child.dataset.wikiRaw || child.textContent)
        } else {
          visit(child)
        }
      })
    }
    if (element) visit(element)
    return chunks.join("")
  }

  fillEditable(element, text, { decorate = true } = {}) {
    element.replaceChildren()
    const lines = String(text).split("\n")
    lines.forEach((line, i) => {
      if (decorate) this.appendDecoratedLine(element, line)
      else element.append(document.createTextNode(line))
      if (i < lines.length - 1) element.append(document.createElement("br"))
    })
  }

  appendDecoratedLine(element, line) {
    wikiTokens(line).forEach((token) => {
      if (token.type === "wiki" && token.href) {
        const link = document.createElement("a")
        link.className = "wiki"
        link.href = token.href
        link.dataset.wikiRaw = token.raw
        link.contentEditable = "false"
        link.textContent = token.label
        element.append(link)
      } else {
        element.append(document.createTextNode(token.type === "wiki" ? token.raw : token.value))
      }
    })
  }

  caretOffset(element, { fallback = "end" } = {}) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !element.contains(selection.anchorNode)) {
      if (fallback === "keep") return null
      return fallback === "start" ? 0 : this.readEditableText(element).length
    }
    const range = selection.getRangeAt(0)
    const prefix = range.cloneRange()
    prefix.selectNodeContents(element)
    prefix.setEnd(range.startContainer, range.startOffset)
    return prefix.toString().length + prefix.cloneContents().querySelectorAll("br").length
  }

  atBlockStart(element) {
    return this.caretOffset(element, { fallback: "start" }) === 0
  }

  atBlockEnd(element) {
    const text = this.readEditableText(element)
    return this.caretOffset(element, { fallback: "end" }) >= text.length
  }

  rangeAtOffset(element, offset) {
    const range = document.createRange()
    let remaining = Math.max(0, offset)
    for (const node of this.editableNodes(element)) {
      const length = node.nodeName === "BR" ? 1 : (node.nodeValue?.length || 0)
      if (remaining <= length) {
        if (node.nodeName === "BR") {
          if (remaining === 0) range.setStartBefore(node)
          else range.setStartAfter(node)
        } else {
          range.setStart(node, remaining)
        }
        range.collapse(true)
        return range
      }
      remaining -= length
    }
    range.selectNodeContents(element)
    range.collapse(false)
    return range
  }

  setCaret(element, offset) {
    const selection = window.getSelection()
    if (!selection) return
    const range = this.rangeAtOffset(element, offset)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  rectFromRange(range) {
    if (!range) return null
    const rects = range.getClientRects()
    const rect = rects[0] || range.getBoundingClientRect()
    if (!rect) return null
    if (rect.width > 0 || rect.height > 0) return rect
    if (rect.top !== 0 || rect.left !== 0) return rect
    return null
  }

  caretLineRect() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0).cloneRange()
    range.collapse(true)
    const direct = this.rectFromRange(range)
    if (direct && (direct.height > 0 || direct.width > 0)) return direct

    const node = range.startContainer
    if (node.nodeType === Node.TEXT_NODE) {
      const offset = range.startOffset
      if (offset < node.length) {
        const probe = range.cloneRange()
        probe.setEnd(node, offset + 1)
        const rect = this.rectFromRange(probe)
        if (rect && (rect.height > 0 || rect.width > 0)) return rect
      }
      if (offset > 0) {
        const probe = range.cloneRange()
        probe.setStart(node, offset - 1)
        const rect = this.rectFromRange(probe)
        if (rect && (rect.height > 0 || rect.width > 0)) {
          return { top: rect.top, bottom: rect.bottom, left: rect.right, height: rect.height, width: 0 }
        }
      }
    }
    return direct
  }

  lineHeight(element) {
    const style = window.getComputedStyle(element)
    const parsed = Number.parseFloat(style.lineHeight)
    if (Number.isFinite(parsed) && style.lineHeight !== "normal") return parsed
    const size = Number.parseFloat(style.fontSize)
    return (Number.isFinite(size) ? size : 16) * 1.45
  }

  lineSlop(element, rect) {
    return Math.max(rect?.height || 0, this.lineHeight(element), 8) * 0.6
  }

  singleVisualLine(element) {
    return element.getBoundingClientRect().height <= this.lineHeight(element) * 1.65
  }

  atFirstVisualLine(element) {
    if (this.atBlockStart(element)) return true
    const text = this.readEditableText(element)
    if (!text.includes("\n") && this.singleVisualLine(element)) return true
    const rect = this.caretLineRect()
    if (!rect) return false
    const first = this.rectFromRange(this.rangeAtOffset(element, 0))
    if (!first) return false
    return Math.abs(rect.top - first.top) <= this.lineSlop(element, rect)
  }

  atLastVisualLine(element) {
    if (this.atBlockEnd(element)) return true
    const text = this.readEditableText(element)
    if (!text.includes("\n") && this.singleVisualLine(element)) return true
    const rect = this.caretLineRect()
    if (!rect) return false
    const last = this.rectFromRange(this.rangeAtOffset(element, text.length))
    if (!last) return false
    return Math.abs(rect.top - last.top) <= this.lineSlop(element, rect)
  }

  placeCaretAtColumn(element, x, edge) {
    const text = this.readEditableText(element)
    if (!text) {
      this.setCaret(element, 0)
      return
    }
    this.setCaret(element, edge === "start" ? 0 : text.length)
    const lineTop = this.caretLineRect()?.top
    if (lineTop == null) return
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
      const onLine = Math.abs(rect.top - lineTop) <= this.lineSlop(element, rect)
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
