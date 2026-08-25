import { Controller } from "@hotwired/stimulus"
import { passageLabel, rangeSlug, selectionFromDrag, selectionFromTap } from "../lib/passage-span"

export default class extends Controller {
  static targets = ["tray", "preview", "chapterTray", "rangeTemplate", "title"]
  static values = {
    focus: Number,
    spanStart: Number,
    spanEnd: Number,
    chapterSlug: String,
    notesUrl: String,
    bookLabel: String,
    chapter: Number
  }

  connect() {
    this.selection = this.initialSelection()
    this.onPointerMove = this.onPointerMove.bind(this)
    this.onPointerUp = this.onPointerUp.bind(this)
    if (this.selection) {
      this.verseEl(this.selection.start)?.scrollIntoView({ block: "center" })
    }
  }

  disconnect() {
    this.teardownPointer()
  }

  initialSelection() {
    if (!this.hasSpanStartValue || !this.spanStartValue) return null
    const end = this.hasSpanEndValue && this.spanEndValue ? this.spanEndValue : this.spanStartValue
    return { start: this.spanStartValue, end }
  }

  pressStart(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return
    if (event.target.closest(".note-tray, .note-preview, .otext, a, input")) return
    const press = event.target.closest(".verse-press")
    if (!press) return
    const verse = press.closest("[data-verse]")
    if (!verse) return
    this.dragStart = Number(verse.dataset.verse)
    this.dragCurrent = this.dragStart
    this.dragging = false
    this.pointerId = event.pointerId
    press.setPointerCapture?.(event.pointerId)
    window.addEventListener("pointermove", this.onPointerMove, { passive: false })
    window.addEventListener("pointerup", this.onPointerUp)
    window.addEventListener("pointercancel", this.onPointerUp)
  }

  onPointerMove(event) {
    if (this.dragStart == null) return
    const n = this.verseAtPoint(event.clientX, event.clientY)
    if (!n) return
    if (n !== this.dragStart) {
      this.dragging = true
      event.preventDefault()
      this.element.classList.add("is-picking")
    }
    if (n !== this.dragCurrent) {
      this.dragCurrent = n
      if (this.dragging) this.previewSpan(this.dragStart, n)
    }
  }

  onPointerUp(event) {
    if (this.dragStart == null) return
    const hovered = this.verseAtPoint(event.clientX, event.clientY) || this.dragCurrent || this.dragStart
    const start = this.dragStart
    const wasDragging = this.dragging
    this.ignoreClick = true
    this.resetDrag()
    if (wasDragging && hovered !== start) {
      this.selection = selectionFromDrag(start, hovered)
    } else if (this.verseEl(start)?.classList.contains("is-open")) {
      this.selection = null
    } else {
      this.selection = selectionFromTap(start, this.selection)
    }
    this.applySelection({ replaceUrl: true })
  }

  openVerse(event) {
    if (this.ignoreClick) {
      this.ignoreClick = false
      event.preventDefault()
      return
    }
    const verse = event.currentTarget.closest("[data-verse]")
    if (!verse) return
    if (verse.classList.contains("is-open")) {
      this.selection = null
    } else {
      this.selection = selectionFromTap(verse.dataset.verse, this.selection)
    }
    this.applySelection({ replaceUrl: true })
  }

  applySelection({ replaceUrl }) {
    this.clearEphemeralRanges()
    this.element.classList.remove("is-picking")
    this.element.querySelectorAll(".verse").forEach((row) => {
      row.classList.remove("is-open", "is-span")
    })
    this.element.querySelectorAll(".note-tray").forEach((tray) => { tray.hidden = true })

    if (!this.selection) {
      this.updateTitle(null)
      this.refreshExpand()
      if (replaceUrl) this.replaceSlug(this.chapterSlugValue)
      return
    }

    const { start, end } = this.selection
    for (let n = start; n <= end; n += 1) this.verseEl(n)?.classList.add("is-span")

    if (start === end) this.openSingle(start)
    else this.openRange(start, end)

    this.updateTitle(this.selection)
    this.refreshExpand()
    if (replaceUrl) this.replaceSlug(rangeSlug(this.chapterSlugValue, start, end))
  }

  previewSpan(anchor, hovered) {
    const span = selectionFromDrag(anchor, hovered)
    if (!span) return
    this.element.querySelectorAll(".verse").forEach((row) => {
      const n = Number(row.dataset.verse)
      row.classList.toggle("is-span", n >= span.start && n <= span.end)
    })
    this.updateTitle(span)
  }

  openSingle(n) {
    const row = this.verseEl(n)
    if (!row) return
    row.classList.add("is-open")
    row.querySelectorAll(".note-tray").forEach((tray) => {
      tray.hidden = tray.hasAttribute("data-range-composer")
    })
    this.focusFirstVisible(row)
  }

  openRange(start, end) {
    const slug = rangeSlug(this.chapterSlugValue, start, end)
    const row = this.verseEl(end)
    if (!row) return
    row.classList.add("is-open")
    row.querySelectorAll(".note-tray").forEach((tray) => {
      if (tray.hasAttribute("data-verse-composer")) {
        tray.hidden = true
        return
      }
      tray.hidden = false
    })

    let rangeTray = this.rangeTrayFor(row, slug)
    if (!rangeTray && this.hasRangeTemplateTarget) {
      rangeTray = this.buildRangeTray(slug, start, end)
      row.append(rangeTray)
    }
    if (rangeTray) {
      rangeTray.hidden = false
      this.focusOutliner(rangeTray)
      return
    }
    this.focusFirstVisible(row)
  }

  rangeTrayFor(row, slug) {
    return row.querySelector(`[data-range-composer][data-range-slug="${CSS.escape(slug)}"]`)
      || row.querySelector(`.outliner[data-slug="${CSS.escape(slug)}"]`)?.closest(".note-tray")
  }

  buildRangeTray(slug, start, end) {
    const node = this.rangeTemplateTarget.content.cloneNode(true)
    const tray = node.querySelector(".note-tray")
    tray.dataset.rangeSlug = slug
    tray.dataset.ephemeral = "true"
    tray.hidden = false
    const label = passageLabel(this.bookLabelValue, this.chapterValue, start, end)
    const labelEl = tray.querySelector(".tray-label")
    if (labelEl) {
      labelEl.textContent = label
      labelEl.classList.remove("sr-only")
    }
    const outliner = tray.querySelector(".outliner")
    if (outliner) {
      outliner.dataset.slug = slug
      outliner.dataset.outlinerSlugValue = slug
    }
    const link = tray.querySelector(".tray-external")
    if (link) link.href = `https://route.bible/${slug}`
    tray.querySelectorAll("[data-block-id]").forEach((block) => {
      block.dataset.blockId = `b_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`
    })
    return tray
  }

  clearEphemeralRanges() {
    this.element.querySelectorAll("[data-range-composer][data-ephemeral]").forEach((tray) => {
      const host = tray.querySelector(".outliner")
      const controller = this.outlinerController(host)
      if (!controller || controller.isEmpty()) tray.remove()
    })
  }

  replaceSlug(slug) {
    if (!slug) return
    const next = `/${slug}`
    if (window.location.pathname === next) return
    const state = window.history.state && typeof window.history.state === "object" ? { ...window.history.state } : {}
    window.history.replaceState({ ...state, slug }, "", next)
  }

  updateTitle(span) {
    const text = span
      ? passageLabel(this.bookLabelValue, this.chapterValue, span.start, span.end)
      : `${this.bookLabelValue} ${this.chapterValue}`
    if (this.hasTitleTarget) this.titleTarget.textContent = text
    document.title = text
  }

  toggleChapter() {
    if (!this.hasChapterTrayTarget) return
    this.chapterTrayTarget.hidden = !this.chapterTrayTarget.hidden
    if (!this.chapterTrayTarget.hidden) this.focusOutliner(this.chapterTrayTarget)
  }

  toggleExpand() {
    this.element.classList.toggle("is-expanded", !this.element.classList.contains("is-expanded"))
    this.refreshExpand()
  }

  refreshExpand() {
    const expanding = this.element.classList.contains("is-expanded")
    this.element.querySelectorAll(".verse.has-note").forEach((row) => {
      const open = row.classList.contains("is-open")
      row.querySelectorAll(".note-preview").forEach((preview) => {
        preview.hidden = !expanding || open
      })
      if (expanding && !open) {
        this.traysIn(row).forEach((tray) => { tray.hidden = true })
      }
    })
  }

  async share(event) {
    const slug = this.currentSlug()
    const url = slug ? `https://route.bible/${slug}` : (event.params.routeBible || window.location.href)
    try {
      await navigator.clipboard.writeText(url)
      event.currentTarget.title = "Copied"
    } catch {
      window.prompt("Copy route.bible link", url)
    }
  }

  currentSlug() {
    if (!this.selection) return this.chapterSlugValue
    return rangeSlug(this.chapterSlugValue, this.selection.start, this.selection.end)
  }

  autosave(event) {
    const host = event.currentTarget.closest(".outliner")
    if (!host) return
    clearTimeout(host._kvTimer)
    host._kvTimer = setTimeout(() => this.save(host), 450)
  }

  async save(host) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content
    const payload = this.outlinerPayload(host)
    if (!payload) return
    const body = new URLSearchParams({
      slug: payload.slug,
      text: payload.text,
      blocks: JSON.stringify(payload.blocks)
    })
    const res = await fetch(this.notesUrlValue, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "X-CSRF-Token": token,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    })
    if (!res.ok) return
    await res.json()
    const verse = host.closest(".verse")
    if (!verse) return
    verse.classList.toggle("has-note", this.anyNoteText(verse))
  }

  traysIn(verse) {
    return verse.querySelectorAll(".note-tray")
  }

  anyNoteText(verse) {
    return [...verse.querySelectorAll(".outliner")].some((host) => {
      const controller = this.outlinerController(host)
      return controller ? !controller.isEmpty() : false
    })
  }

  verseEl(n) {
    return this.element.querySelector(`#v${n}`)
  }

  verseAtPoint(x, y) {
    const node = document.elementFromPoint(x, y)
    const verse = node?.closest?.("[data-verse]")
    if (!verse || !this.element.contains(verse)) return null
    return Number(verse.dataset.verse)
  }

  resetDrag() {
    this.dragStart = null
    this.dragCurrent = null
    this.dragging = false
    this.teardownPointer()
  }

  teardownPointer() {
    window.removeEventListener("pointermove", this.onPointerMove)
    window.removeEventListener("pointerup", this.onPointerUp)
    window.removeEventListener("pointercancel", this.onPointerUp)
    this.element.classList.remove("is-picking")
  }

  focusFirstVisible(row) {
    const tray = [...row.querySelectorAll(".note-tray")].find((item) => !item.hidden)
    this.focusOutliner(tray)
  }

  focusOutliner(root) {
    const host = root?.querySelector?.(".outliner") || root
    this.outlinerController(host)?.focusLast()
    host?.querySelector?.(".otext")?.focus()
  }

  outlinerPayload(host) {
    return this.outlinerController(host)?.payload()
  }

  outlinerController(host) {
    if (!host) return null
    return this.application.getControllerForElementAndIdentifier(host, "outliner")
  }
}
