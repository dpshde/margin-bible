import { Controller } from "@hotwired/stimulus"
import { rangeDragIntent, versePointerDecision } from "../lib/chapter-swipe"
import {
  applyChapterGridOpen,
  chapterCellsHtml,
  chapterGridIsOpen,
  toggleChapterGridOpen
} from "../lib/chapter-grid"
import {
  applyClearedNoteTray,
  expandControlDisabled,
  shouldHideClearedTray,
  shouldShowExpandedTray,
  trayHasNoteContent
} from "../lib/expand-notes"
import {
  applyNoteToPack,
  loadPack,
  notesForChapter,
  rememberRead,
  setNoteBookmarked,
  shouldUseGuestPack,
  writePack
} from "../lib/guest-pack"
import {
  parseSlug,
  passageLabel,
  rangeSlug,
  selectionFromDrag,
  selectionFromTap
} from "../lib/passage-span"
import { parseXrefHref, sameChapterSlug, xrefKeepTarget } from "../lib/xref-peek.js"
import { verseNodes, verseTrayHost } from "../lib/verse-host.js"
import { loadHideVerseNums, saveHideVerseNums } from "../lib/reader-prefs"
import { markCopied, writeClipboard } from "../lib/clipboard-copy"
import {
  formatChapterHtml,
  formatChapterShare,
  formatNoteHtml,
  formatNoteShare,
  formatVerseShare,
  notesForVerse,
  passageUrl
} from "../lib/share-text"

export default class extends Controller {
  static targets = ["tray", "chapterTray", "rangeTemplate", "title", "numsToggle", "copyButton", "quietToggle", "chapterGrid", "gridHeading", "bookList", "chapterCells"]
  static values = {
    focus: Number,
    spanStart: Number,
    spanEnd: Number,
    chapterSlug: String,
    passageSlug: String,
    notesUrl: String,
    bookLabel: String,
    chapter: Number,
    prevUrl: String,
    nextUrl: String,
    signedIn: Boolean,
    exportUrl: String,
    book: String,
    bookNames: Object,
    chapterCounts: Object,
    xref: Boolean
  }

  connect() {
    this.selection = this.initialSelection()
    this.xrefSpan = null
    this.collapsedNotes = new Set()
    this.onPointerMove = this.onPointerMove.bind(this)
    this.onPointerUp = this.onPointerUp.bind(this)
    this.flushPending = this.flushPending.bind(this)
    this.onVisibility = this.onVisibility.bind(this)
    this.dismissXref = this.dismissXref.bind(this)
    this.followXrefClick = this.followXrefClick.bind(this)
    document.addEventListener("turbo:before-visit", this.flushPending)
    window.addEventListener("pagehide", this.flushPending)
    document.addEventListener("visibilitychange", this.onVisibility)
    window.addEventListener("pointerdown", this.dismissXref)
    window.addEventListener("click", this.followXrefClick, true)
    this.applyNums(loadHideVerseNums())
    if (this.xrefValue && this.hasSpanStartValue && this.spanStartValue) {
      const end = this.hasSpanEndValue && this.spanEndValue ? this.spanEndValue : this.spanStartValue
      this.applyXref({ start: this.spanStartValue, end }, { replaceUrl: false })
      this.verseEl(this.spanStartValue)?.scrollIntoView({ block: "center" })
    } else if (this.selection) {
      this.applySelection({ replaceUrl: false })
      const row = this.verseHost(this.selection.end)
      row?.scrollIntoView({ block: "center" })
      queueMicrotask(() => this.focusFirstVisible(row))
    }
    if (this.guestSession) {
      rememberRead(this.passageSlugValue || this.chapterSlugValue)
      queueMicrotask(() => this.hydrateGuestNotes())
    } else {
      queueMicrotask(() => this.mirrorSignedInNotes())
    }
  }

  disconnect() {
    this.flushPending()
    document.removeEventListener("turbo:before-visit", this.flushPending)
    window.removeEventListener("pagehide", this.flushPending)
    document.removeEventListener("visibilitychange", this.onVisibility)
    window.removeEventListener("pointerdown", this.dismissXref)
    window.removeEventListener("click", this.followXrefClick, true)
    this.teardownPointer()
  }

  get guestSession() {
    return shouldUseGuestPack(this.signedInValue)
  }

  onVisibility() {
    if (document.visibilityState === "hidden") this.flushPending()
  }

  initialSelection() {
    if (this.xrefValue) return null
    if (!this.hasSpanStartValue || !this.spanStartValue) return null
    const end = this.hasSpanEndValue && this.spanEndValue ? this.spanEndValue : this.spanStartValue
    return { start: this.spanStartValue, end }
  }

  pressStart(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return
    if (event.target.closest(".note-tray, .chapter-tray, .otext, a, input, textarea, .jump, .topbar, .reader-dock, .reader-chrome, .chapter-grid")) return
    this.pointerOrigin = { x: event.clientX, y: event.clientY, t: event.timeStamp }
    const press = event.target.closest(".verse-press")
    const verse = press?.closest("[data-verse]")
    this.pressEl = press
    if (verse) {
      this.dragStart = Number(verse.dataset.verse)
      this.dragCurrent = this.dragStart
    } else {
      this.dragStart = null
      this.dragCurrent = null
    }
    this.dragging = false
    this.swipeAxis = null
    this.dragStartTop = verse ? this.verseBox(verse).top : null
    this.pointerId = event.pointerId
    window.addEventListener("pointermove", this.onPointerMove, { passive: false })
    window.addEventListener("pointerup", this.onPointerUp)
    window.addEventListener("pointercancel", this.onPointerUp)
  }

  onPointerMove(event) {
    if (this.pointerOrigin == null) return
    const dx = event.clientX - this.pointerOrigin.x
    const dy = event.clientY - this.pointerOrigin.y
    if (this.dragStart == null) return
    const n = this.verseAtPoint(event.clientX, event.clientY)
    const startEl = this.verseEl(this.dragStart)
    const startRange = rangeDragIntent({
      startVerse: this.dragStart,
      currentVerse: n,
      startVerseTop: this.dragStartTop,
      currentStartVerseTop: startEl ? this.verseBox(startEl).top : null,
      dx,
      dy
    })
    if (!startRange && !this.dragging) return
    this.dragging = true
    this.swipeAxis = null
    this.ignoreClick = true
    event.preventDefault()
    const box = this.pressEl?.querySelector?.(".vtext") || this.pressEl
    box?.setPointerCapture?.(event.pointerId)
    this.element.classList.add("is-picking")
    if (n && n !== this.dragCurrent) {
      this.dragCurrent = n
      this.previewSpan(this.dragStart, n)
    }
  }

  onPointerUp(event) {
    if (this.pointerOrigin == null && this.dragStart == null) return
    const hovered = this.verseAtPoint(event.clientX, event.clientY) || this.dragCurrent || this.dragStart
    const start = this.dragStart
    const wasDragging = this.dragging
    const origin = this.pointerOrigin
    const dx = origin ? event.clientX - origin.x : 0
    const dy = origin ? event.clientY - origin.y : 0
    const elapsedMs = origin ? event.timeStamp - origin.t : 0
    this.ignoreClick = true
    this.resetDrag()
    const decision = versePointerDecision({
      dx,
      dy,
      elapsedMs,
      startVerse: start,
      endVerse: hovered,
      dragging: wasDragging
    })
    if (decision.type === "chapter") {
      const url = decision.direction === "next" ? this.nextUrlValue : this.prevUrlValue
      if (url) this.visitChapter(url)
      return
    }
    if (decision.type === "range") {
      this.selection = selectionFromDrag(decision.start, decision.end)
      this.applySelection({ replaceUrl: true, focus: true })
      return
    }
    if (decision.type !== "tap" || start == null) return
    if (this.verseEl(start)?.classList.contains("is-open")) {
      this.selection = null
    } else {
      this.selection = selectionFromTap(start, this.selection)
    }
    this.applySelection({ replaceUrl: true, focus: true })
  }

  openVerse(event) {
    if (this.ignoreClick) {
      this.ignoreClick = false
      event.preventDefault()
      return
    }
    const verse = event.currentTarget.closest("[data-verse]")
    if (!verse) return
    const n = Number(verse.dataset.verse)
    const expanding = this.element.classList.contains("is-expanded")
    const notesOpen = [ ...verse.querySelectorAll(".note-tray[data-note-slug]") ].some((tray) => !tray.hidden)

    if (expanding && notesOpen) {
      this.collapsedNotes.add(n)
      if (verse.classList.contains("is-open")) this.selection = null
      this.applySelection({ replaceUrl: true })
      return
    }

    this.collapsedNotes.delete(n)
    if (verse.classList.contains("is-open")) {
      this.selection = null
    } else {
      this.selection = selectionFromTap(verse.dataset.verse, this.selection)
    }
    this.applySelection({ replaceUrl: true })
  }

  applySelection({ replaceUrl, focus = true }) {
    this.xrefSpan = null
    this.clearEphemeralRanges()
    this.element.classList.remove("is-picking")
    this.element.querySelectorAll(".verse").forEach((row) => {
      row.classList.remove("is-open", "is-span", "is-span-start", "is-span-end", "is-xref")
    })
    this.element.querySelectorAll(".note-tray").forEach((tray) => { tray.hidden = true })

    if (!this.selection) {
      this.updateTitle(null)
      this.refreshExpand()
      if (replaceUrl) this.replaceSlug(this.chapterSlugValue)
      return
    }

    const { start, end } = this.selection
    this.element.querySelectorAll(".verse").forEach((row) => {
      const n = Number(row.dataset.verse)
      const inSpan = n >= start && n <= end
      row.classList.toggle("is-span", inSpan)
      row.classList.toggle("is-span-start", inSpan && n === start)
      row.classList.toggle("is-span-end", inSpan && n === end)
    })

    if (start === end) this.openSingle(start, { focus })
    else this.openRange(start, end, { focus })

    this.updateTitle(this.selection)
    this.refreshExpand()
    if (replaceUrl) this.replaceSlug(rangeSlug(this.chapterSlugValue, start, end))
  }

  previewSpan(anchor, hovered) {
    const span = selectionFromDrag(anchor, hovered)
    if (!span) return
    this.element.querySelectorAll(".verse").forEach((row) => {
      const n = Number(row.dataset.verse)
      const inSpan = n >= span.start && n <= span.end
      row.classList.toggle("is-span", inSpan)
      row.classList.toggle("is-span-start", inSpan && n === span.start)
      row.classList.toggle("is-span-end", inSpan && n === span.end)
    })
    this.updateTitle(span)
  }

  openSingle(n, { focus = true } = {}) {
    const rows = verseNodes(this.element, n)
    if (!rows.length) return
    rows.forEach((row) => row.classList.add("is-open"))
    const host = this.verseHost(n)
    host?.querySelectorAll(".note-tray").forEach((tray) => {
      tray.hidden = tray.hasAttribute("data-range-composer")
    })
    if (focus) this.focusFirstVisible(host)
  }

  openRange(start, end, { focus = true } = {}) {
    const slug = rangeSlug(this.chapterSlugValue, start, end)
    const rows = verseNodes(this.element, end)
    const host = this.verseHost(end)
    if (!host) return
    rows.forEach((row) => row.classList.add("is-open"))
    host.querySelectorAll(".note-tray").forEach((tray) => {
      if (tray.hasAttribute("data-verse-composer")) {
        tray.hidden = true
        return
      }
      tray.hidden = false
    })

    let rangeTray = this.rangeTrayFor(host, slug)
    if (!rangeTray && this.hasRangeTemplateTarget) {
      rangeTray = this.buildRangeTray(slug, start, end)
      host.append(rangeTray)
    }
    if (rangeTray) {
      rangeTray.hidden = false
      if (focus) this.focusOutliner(rangeTray)
      return
    }
    if (focus) this.focusFirstVisible(host)
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

  jumpSection(event) {
    const href = event.currentTarget?.getAttribute?.("href") || ""
    const id = href.startsWith("#") ? href.slice(1) : ""
    if (!id) return
    const heading = this.element.querySelector(`#${CSS.escape(id)}`)
    if (!heading) return
    event.preventDefault()
    requestAnimationFrame(() => {
      heading.scrollIntoView({ block: "start", behavior: "smooth" })
    })
  }

  followXrefClick(event) {
    const node = event.target?.nodeType === 1 ? event.target : event.target?.parentElement
    const link = node?.closest?.("a.wiki, a.pub-ref")
    if (!link || !this.element.contains(link)) return
    const parsed = parseXrefHref(link.getAttribute("href"))
    if (!parsed || parsed.kind === "chapter") return
    if (!sameChapterSlug(parsed, this.chapterSlugValue)) return
    event.preventDefault()
    event.stopPropagation()
    this.applyXref({ start: parsed.verseStart, end: parsed.verseEnd }, { replaceUrl: true })
    this.verseEl(parsed.verseStart)?.scrollIntoView({ block: "center" })
  }

  applyXref(span, { replaceUrl = true } = {}) {
    if (!span?.start) return
    this.selection = null
    this.xrefSpan = { start: span.start, end: span.end || span.start }
    this.clearEphemeralRanges()
    this.element.classList.remove("is-picking")
    this.element.querySelectorAll(".note-tray").forEach((tray) => { tray.hidden = true })
    this.element.querySelectorAll(".verse").forEach((row) => {
      const n = Number(row.dataset.verse)
      const inSpan = n >= this.xrefSpan.start && n <= this.xrefSpan.end
      row.classList.remove("is-open", "is-span", "is-span-start", "is-span-end")
      row.classList.toggle("is-xref", inSpan)
    })
    this.updateTitle(this.xrefSpan)
    this.refreshExpand()
    if (replaceUrl) {
      this.replaceSlug(rangeSlug(this.chapterSlugValue, this.xrefSpan.start, this.xrefSpan.end), { query: "xref=1" })
    }
  }

  dismissXref(event) {
    if (!this.xrefSpan) return
    if (xrefKeepTarget(event.target)) return
    this.clearXref({ replaceUrl: true })
  }

  clearXref({ replaceUrl = true } = {}) {
    if (!this.xrefSpan) return
    this.xrefSpan = null
    this.element.querySelectorAll(".verse.is-xref").forEach((row) => row.classList.remove("is-xref"))
    this.updateTitle(null)
    if (replaceUrl) this.replaceSlug(this.chapterSlugValue)
  }

  replaceSlug(slug, { query = "" } = {}) {
    if (!slug) return
    const next = query ? `/${slug}?${query}` : `/${slug}`
    const current = `${window.location.pathname}${window.location.search}`
    if (current === next) return
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

  toggleQuiet() {
    this.applyQuiet(!this.element.classList.contains("is-quiet"))
  }

  applyQuiet(quiet) {
    this.element.classList.toggle("is-quiet", quiet)
    this.quietToggleTargets.forEach((button) => {
      button.classList.toggle("is-on", quiet)
      button.setAttribute("aria-pressed", quiet ? "true" : "false")
      button.setAttribute("aria-label", quiet ? "Exit focus" : "Focus")
      button.title = quiet ? "Exit focus" : "Focus"
    })
    this.revealChrome()
    if (!quiet) return
    this.flushPending()
    if (this.hasChapterTrayTarget) {
      this.chapterTrayTarget.hidden = true
      this.element.querySelectorAll("[data-action='click->reader#toggleChapter']").forEach((button) => {
        button.classList.remove("is-on")
        button.setAttribute("aria-pressed", "false")
      })
    }
    this.element.classList.remove("is-expanded")
    this.collapsedNotes = new Set()
    this.element.querySelectorAll("[data-action='click->reader#toggleExpand']").forEach((button) => {
      button.classList.remove("is-on")
      button.setAttribute("aria-pressed", "false")
    })
    this.clearXref({ replaceUrl: false })
  }

  toggleChapterGrid() {
    const open = toggleChapterGridOpen(
      this.hasChapterGridTarget ? this.chapterGridTarget : null,
      this.hasTitleTarget ? this.titleTarget : null
    )
    this.element.classList.toggle("is-grid-open", open)
    if (open) {
      this.showChapterPane(this.bookValue)
      this.revealChrome()
    }
  }

  closeChapterGrid(event) {
    if (event?.type === "click" && event.target !== this.chapterGridTarget) return
    if (!this.hasChapterGridTarget || !chapterGridIsOpen(this.chapterGridTarget)) return
    applyChapterGridOpen(this.chapterGridTarget, this.hasTitleTarget ? this.titleTarget : null, false)
    this.element.classList.remove("is-grid-open")
    this.showChapterPane(this.bookValue)
  }

  keepChapterGrid(event) {
    event.stopPropagation()
  }

  toggleBookPicker() {
    if (!this.hasBookListTarget) return
    if (!this.bookListTarget.hidden) {
      this.showChapterPane(this.gridBook || this.bookValue)
      return
    }
    this.showBookPane()
  }

  pickGridBook(event) {
    const book = event.currentTarget.dataset.book
    if (!book) return
    this.showChapterPane(book)
  }

  showBookPane() {
    if (this.hasBookListTarget) this.bookListTarget.hidden = false
    if (this.hasChapterCellsTarget) this.chapterCellsTarget.hidden = true
    if (this.hasGridHeadingTarget) {
      this.gridHeadingTarget.textContent = "Books"
      this.gridHeadingTarget.setAttribute("aria-expanded", "true")
    }
  }

  showChapterPane(book) {
    this.gridBook = book
    if (this.hasBookListTarget) this.bookListTarget.hidden = true
    if (this.hasChapterCellsTarget) {
      this.chapterCellsTarget.hidden = false
      this.chapterCellsTarget.innerHTML = chapterCellsHtml(book, this.chapterCountsValue[book], {
        currentBook: this.bookValue,
        currentChapter: this.chapterValue
      })
    }
    if (this.hasGridHeadingTarget) {
      this.gridHeadingTarget.textContent = this.bookNamesValue[book] || book
      this.gridHeadingTarget.setAttribute("aria-expanded", "false")
    }
  }

  revealChrome() {
    this.element.querySelectorAll("[data-controller~='chrome']").forEach((el) => {
      el.dispatchEvent(new Event("chrome:reveal"))
    })
  }

  toggleChapter() {
    if (!this.hasChapterTrayTarget) return
    if (this.chapterTrayTarget.hidden) this.openChapter()
    else this.closeChapter()
  }

  openChapter() {
    if (!this.hasChapterTrayTarget) return
    this.chapterTrayTarget.hidden = false
    this.syncChapterToggle(true)
    this.focusOutliner(this.chapterTrayTarget)
  }

  closeChapter(event) {
    if (!this.hasChapterTrayTarget || this.chapterTrayTarget.hidden) return
    event?.preventDefault?.()
    event?.stopPropagation?.()
    this.flushPending()
    this.chapterTrayTarget.hidden = true
    this.syncChapterToggle(false)
  }

  closeChapterOnEscape(event) {
    if (event.key !== "Escape") return
    this.closeChapter(event)
  }

  syncChapterToggle(open) {
    this.element.querySelectorAll("[data-action='click->reader#toggleChapter']").forEach((button) => {
      button.classList.toggle("is-on", open)
      button.setAttribute("aria-pressed", open ? "true" : "false")
    })
  }

  toggleExpand() {
    const expanding = !this.element.classList.contains("is-expanded")
    this.element.classList.toggle("is-expanded", expanding)
    this.collapsedNotes = new Set()
    this.element.querySelectorAll("[data-action='click->reader#toggleExpand']").forEach((button) => {
      button.classList.toggle("is-on", expanding)
      button.setAttribute("aria-pressed", expanding ? "true" : "false")
    })
    this.refreshExpand()
  }

  toggleNums() {
    this.applyNums(!this.element.classList.contains("is-nums-hidden"))
  }

  applyNums(hidden) {
    this.element.classList.toggle("is-nums-hidden", hidden)
    this.numsToggleTargets.forEach((toggle) => {
      toggle.classList.toggle("is-on", hidden)
      toggle.setAttribute("aria-pressed", hidden ? "true" : "false")
    })
    saveHideVerseNums(hidden)
  }

  refreshExpand() {
    const expanding = this.element.classList.contains("is-expanded")
    this.element.querySelectorAll(".note-tray[data-note-slug]").forEach((tray) => {
      const row = tray.closest(".verse")
      const n = Number(row?.dataset.verse)
      const show = shouldShowExpandedTray({
        expanding,
        selected: row?.classList.contains("is-open"),
        collapsed: this.collapsedNotes.has(n),
        hasContent: this.trayHasContent(tray)
      })
      tray.hidden = !show
    })
  }

  async copyPassage(event) {
    const button = event.currentTarget
    this.flushPending()
    const notes = this.liveNotes()
    const label = `${this.bookLabelValue} ${this.chapterValue}`
    const chapterNote = notes.find((note) => note.slug === this.chapterSlugValue)?.blocks
    const verses = this.chapterVerses(notes)
    const text = formatChapterShare({ label, chapterNote, verses, bullets: true, notesOnly: true })
    const html = formatChapterHtml({ label, chapterNote, verses, notesOnly: true })
    const ok = await writeClipboard(text, html)
    markCopied(button, ok)
  }

  async copyNote(event) {
    event.preventDefault()
    event.stopPropagation()
    const button = event.currentTarget
    this.flushPending()
    const tray = button?.closest(".note-tray, .chapter-tray")
    const host = tray?.querySelector(".outliner")
    const controller = this.outlinerController(host)
    const blocks = controller && !controller.isEmpty() ? controller.payload().blocks : []
    const label = tray?.querySelector(".tray-label")?.textContent?.trim() || ""
    const text = formatNoteShare({ label, blocks })
    const html = formatNoteHtml({ label, blocks })
    const ok = await writeClipboard(text, html)
    markCopied(button, ok)
  }

  async sharePassage(event) {
    const button = event.currentTarget
    this.flushPending()
    const scope = event.params.scope === "verse" ? "verse" : "chapter"
    const payload = this.sharePayload(scope)
    const copied = await writeClipboard(payload.text, payload.html)
    if (navigator.share) {
      try {
        // text-only: passing title/url makes some desktop sheets drop the body.
        await navigator.share({ text: payload.text })
        return
      } catch (error) {
        if (error?.name === "AbortError") return
      }
    }
    markCopied(button, copied)
  }

  async exportDocument(event) {
    this.flushPending()
    const scope = event.params.scope === "bible" ? "bible" : "book"
    const withNotes = event.params.notes === true
    const body = new URLSearchParams({
      scope,
      notes: withNotes ? "1" : "0",
      book: this.bookValue || this.chapterSlugValue.split(".")[0]
    })
    if (this.guestSession && withNotes) {
      body.set("pack", JSON.stringify(loadPack().notes || {}))
    }
    const token = document.querySelector('meta[name="csrf-token"]')?.content
    const res = await fetch(this.exportUrlValue || "/export", {
      method: "POST",
      headers: {
        Accept: "text/markdown",
        "X-CSRF-Token": token,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    })
    if (!res.ok) return
    const blob = await res.blob()
    const header = res.headers.get("Content-Disposition") || ""
    const match = header.match(/filename="([^"]+)"/)
    const name = match?.[1] || `${scope}${withNotes ? "-notes" : ""}.md`
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  shareTextFor(scope) {
    return this.sharePayload(scope).text
  }

  shareHtmlFor(scope) {
    return this.sharePayload(scope).html
  }

  sharePayload(scope) {
    const notes = this.liveNotes()
    if (scope === "verse") {
      const span = this.verseShareSpan()
      const verses = this.chapterVerses(notes, span.start, span.end)
      const slug = rangeSlug(this.chapterSlugValue, span.start, span.end)
      const label = this.shareLabel(span)
      const url = passageUrl(slug)
      if (span.start === span.end) {
        const row = verses[0]
        const text = formatVerseShare({
          label,
          text: row?.text || "",
          notes: row?.notes || [],
          url
        })
        return {
          text,
          html: formatChapterHtml({
            label,
            verses: verses.length ? verses : [ { n: span.start, heading: "", text: "", notes: [] } ]
          })
        }
      }
      return {
        text: formatChapterShare({ label, verses, url, bullets: true }),
        html: formatChapterHtml({ label, verses })
      }
    }

    const label = `${this.bookLabelValue} ${this.chapterValue}`
    const chapterNote = notes.find((note) => note.slug === this.chapterSlugValue)?.blocks
    const verses = this.chapterVerses(notes)
    return {
      text: formatChapterShare({
        label,
        chapterNote,
        verses,
        url: passageUrl(this.chapterSlugValue),
        bullets: true
      }),
      html: formatChapterHtml({ label, chapterNote, verses })
    }
  }

  verseShareSpan() {
    const selected = this.verseScope()
    if (selected) return selected
    const focus = Number(this.focusValue)
    if (Number.isFinite(focus) && focus >= 1) return { start: focus, end: focus }
    const first = Number(this.element.querySelector(".verse[data-verse]")?.dataset.verse)
    if (Number.isFinite(first) && first >= 1) return { start: first, end: first }
    return { start: 1, end: 1 }
  }

  liveNotes() {
    return [...this.element.querySelectorAll(".outliner")].flatMap((host) => {
      const controller = this.outlinerController(host)
      if (!controller || controller.isEmpty()) return []
      const payload = controller.payload()
      return payload?.slug ? [ { slug: payload.slug, blocks: payload.blocks } ] : []
    })
  }

  chapterVerses(notes, from, to) {
    return [...this.element.querySelectorAll(".verse")].flatMap((row) => {
      const n = Number(row.dataset.verse)
      if (!Number.isFinite(n)) return []
      if (from != null && n < from) return []
      if (to != null && n > to) return []
      return [ {
        n,
        heading: row.querySelector(".section-head")?.textContent?.trim() || "",
        text: row.querySelector(".vtext")?.textContent?.trim() || "",
        notes: notesForVerse(notes, this.chapterSlugValue, n)
      } ]
    })
  }

  verseScope() {
    return this.selection || this.initialSelection()
  }

  shareLabel(span) {
    return passageLabel(this.bookLabelValue, this.chapterValue, span.start, span.end)
  }

  currentSlug() {
    if (!this.selection) return this.chapterSlugValue
    return rangeSlug(this.chapterSlugValue, this.selection.start, this.selection.end)
  }

  autosave(event) {
    const host = event.currentTarget.closest(".outliner")
    if (!host) return
    host._dirty = true
    this.saveGuest(host)
    if (this.guestSession) return
    clearTimeout(host._kvTimer)
    host._kvTimer = setTimeout(() => {
      host._kvTimer = null
      this.save(host)
      host._dirty = false
    }, 450)
  }

  flushPending() {
    this.flushGuestPack()
    if (this.guestSession) return
    this.element.querySelectorAll(".outliner").forEach((host) => {
      if (host._kvTimer) {
        clearTimeout(host._kvTimer)
        host._kvTimer = null
      }
      if (!host._dirty) return
      this.save(host)
      host._dirty = false
    })
  }

  flushGuestPack() {
    const pack = loadPack()
    let changed = false
    this.element.querySelectorAll(".outliner").forEach((host) => {
      const payload = this.outlinerPayload(host)
      if (!payload) return
      if (applyNoteToPack(pack, payload.slug, payload.blocks)) changed = true
    })
    if (changed) writePack(pack)
  }

  saveGuest(host) {
    const payload = this.outlinerPayload(host)
    if (!payload) return
    const pack = loadPack()
    if (applyNoteToPack(pack, payload.slug, payload.blocks)) writePack(pack)
    this.markHostNote(host)
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
      keepalive: true,
      headers: {
        Accept: "application/json",
        "X-CSRF-Token": token,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    })
    if (!res.ok) return
    await res.json()
    this.markHostNote(host)
  }

  markHostNote(host) {
    const tray = host.closest(".note-tray")
    if (tray) {
      this.syncNoteTray(tray)
      return
    }
    const verse = host.closest(".verse")
    const n = Number(verse?.dataset.verse)
    const primary = Number.isFinite(n) ? this.verseEl(n) : verse
    if (primary) primary.classList.toggle("has-note", this.anyNoteText(this.verseHost(n) || verse))
  }

  hydrateGuestNotes() {
    const pack = loadPack()
    const notes = notesForChapter(this.chapterSlugValue, pack)
    notes.forEach((note) => this.applyGuestNote(note))
  }

  mirrorSignedInNotes() {
    this.flushGuestPack()
  }

  applyGuestNote(note) {
    const parsed = parseSlug(note.slug)
    let tray = this.trayForSlug(note.slug)
    if (!tray && parsed?.kind === "range") tray = this.materializeRangeTray(parsed, note.slug)
    if (!tray && parsed?.kind === "chapter" && this.hasChapterTrayTarget) tray = this.chapterTrayTarget
    if (!tray) return
    this.syncBookmarkButton(tray, note.bookmarked)
    this.applyBlocksWhenReady(tray, note)
  }

  clearNote(event) {
    event.preventDefault()
    event.stopPropagation()
    const tray = event.currentTarget.closest(".note-tray, .chapter-tray")
    const host = tray?.querySelector(".outliner")
    const controller = this.outlinerController(host)
    if (!controller) return
    controller.applyBlocks([])
    this.syncBookmarkButton(tray, false)
    host._dirty = true
    this.saveGuest(host)
    if (!this.guestSession) this.save(host)
    host._dirty = false
    if (tray.classList.contains("note-tray")) this.syncNoteTray(tray)
  }

  toggleBookmark(event) {
    event.preventDefault()
    event.stopPropagation()
    const button = event.currentTarget
    const tray = button.closest(".note-tray, .chapter-tray")
    const host = tray?.querySelector(".outliner")
    const controller = this.outlinerController(host)
    if (!controller || controller.isEmpty()) return
    const next = !button.classList.contains("is-on")
    this.syncBookmarkButton(tray, next)
    const payload = controller.payload()
    setNoteBookmarked(payload.slug, next)
    if (!this.guestSession) this.saveBookmark(host, next)
  }

  async saveBookmark(host, bookmarked) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content
    const payload = this.outlinerPayload(host)
    if (!payload) return
    const body = new URLSearchParams({
      slug: payload.slug,
      text: payload.text,
      blocks: JSON.stringify(payload.blocks),
      bookmarked: bookmarked ? "1" : "0"
    })
    await fetch(this.notesUrlValue, {
      method: "PATCH",
      keepalive: true,
      headers: {
        Accept: "application/json",
        "X-CSRF-Token": token,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    })
  }

  syncBookmarkButton(root, on) {
    const button = root?.querySelector?.(".tray-bookmark")
    if (!button) return
    button.classList.toggle("is-on", Boolean(on))
    button.setAttribute("aria-pressed", on ? "true" : "false")
  }

  applyBlocksWhenReady(tray, note, attempt = 0) {
    const host = tray.querySelector(".outliner")
    const controller = this.outlinerController(host)
    if (!controller) {
      if (attempt < 8) requestAnimationFrame(() => this.applyBlocksWhenReady(tray, note, attempt + 1))
      return
    }
    controller.applyBlocks(note.blocks)
    this.syncNoteTray(tray)
  }

  trayHasContent(tray) {
    return trayHasNoteContent(tray, (host) => {
      const controller = this.outlinerController(host)
      return controller ? controller.isEmpty() : true
    })
  }

  syncNoteTray(tray) {
    if (!tray?.classList.contains("note-tray")) return
    const host = tray.querySelector(".outliner")
    const empty = !this.trayHasContent(tray)
    const slug = host?.dataset.slug || tray.dataset.noteSlug || tray.dataset.rangeSlug
    if (shouldHideClearedTray({ empty, selected: this.noteTraySelected(tray) })) {
      applyClearedNoteTray(tray)
    } else if (empty) {
      delete tray.dataset.noteSlug
      tray.removeAttribute("data-note-slug")
      tray.hidden = false
    } else if (slug) {
      tray.dataset.noteSlug = slug
    }
    this.syncCoverageForSlug(slug)
    this.syncExpandControl()
    this.refreshExpand()
  }

  syncCoverageForSlug(slug) {
    const parsed = parseSlug(slug)
    if (!parsed || parsed.kind === "chapter") return
    const start = parsed.verseStart
    const end = parsed.verseEnd || parsed.verseStart
    for (let n = start; n <= end; n += 1) {
      const on = this.verseHasCoveringNote(n)
      verseNodes(this.element, n).forEach((verse) => {
        verse.classList.toggle("has-note", on && !verse.classList.contains("is-continuation"))
      })
    }
  }

  verseHasCoveringNote(n) {
    return [ ...this.element.querySelectorAll(".note-tray") ].some((tray) => {
      if (!this.trayHasContent(tray)) return false
      const slug = tray.dataset.noteSlug || tray.querySelector(".outliner")?.dataset.slug
      const parsed = parseSlug(slug)
      if (!parsed || parsed.kind === "chapter") return false
      const start = parsed.verseStart
      const end = parsed.verseEnd || parsed.verseStart
      return n >= start && n <= end
    })
  }

  syncExpandControl() {
    const hasNotes = [ ...this.element.querySelectorAll(".note-tray") ].some((tray) => this.trayHasContent(tray))
    if (expandControlDisabled(hasNotes)) this.element.classList.remove("is-expanded")
    this.element.querySelectorAll("[data-action='click->reader#toggleExpand']").forEach((button) => {
      button.disabled = expandControlDisabled(hasNotes)
      if (!hasNotes) {
        button.classList.remove("is-on")
        button.setAttribute("aria-pressed", "false")
      }
    })
  }

  trayForSlug(slug) {
    const escaped = CSS.escape(slug)
    return this.element.querySelector(`[data-note-slug="${escaped}"]`)
      || this.element.querySelector(`[data-range-slug="${escaped}"]`)
      || this.element.querySelector(`.outliner[data-slug="${escaped}"]`)?.closest(".note-tray, .chapter-tray")
  }

  materializeRangeTray(parsed, slug) {
    const host = this.verseHost(parsed.verseEnd)
    if (!host || !this.hasRangeTemplateTarget) return null
    let tray = this.rangeTrayFor(host, slug)
    if (tray) return tray
    tray = this.buildRangeTray(slug, parsed.verseStart, parsed.verseEnd)
    delete tray.dataset.ephemeral
    tray.removeAttribute("data-ephemeral")
    tray.dataset.noteSlug = slug
    host.append(tray)
    return tray
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

  verseHost(n) {
    return verseTrayHost(this.element, n)
  }

  noteTraySelected(tray) {
    const verse = tray.closest("[data-verse]")
    if (!verse) return false
    if (verse.classList.contains("is-open") || verse.classList.contains("is-span")) return true
    const n = Number(verse.dataset.verse)
    if (!this.selection || !Number.isFinite(n)) return false
    return n >= this.selection.start && n <= this.selection.end
  }

  verseBox(verse) {
    const node = verse?.querySelector?.(".vtext") || verse
    return node.getBoundingClientRect()
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
    this.dragStartTop = null
    this.dragging = false
    this.swipeAxis = null
    this.pressEl = null
    this.pointerOrigin = null
    this.teardownPointer()
  }

  visitChapter(url) {
    if (!url) return
    this.flushPending()
    if (window.Turbo?.visit) window.Turbo.visit(url, { action: "advance" })
    else window.location.assign(url)
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
