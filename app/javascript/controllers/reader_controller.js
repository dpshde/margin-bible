import { Controller } from "@hotwired/stimulus"
import { rangeDragIntent, versePointerDecision } from "../lib/chapter-swipe"
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
import { loadHideVerseNums, saveHideVerseNums } from "../lib/reader-prefs"
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
  static targets = ["tray", "chapterTray", "rangeTemplate", "title", "numsToggle", "copyButton", "quietToggle"]
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
    book: String
  }

  connect() {
    this.selection = this.initialSelection()
    this.collapsedNotes = new Set()
    this.onPointerMove = this.onPointerMove.bind(this)
    this.onPointerUp = this.onPointerUp.bind(this)
    this.flushPending = this.flushPending.bind(this)
    this.onVisibility = this.onVisibility.bind(this)
    document.addEventListener("turbo:before-visit", this.flushPending)
    window.addEventListener("pagehide", this.flushPending)
    document.addEventListener("visibilitychange", this.onVisibility)
    this.applyNums(loadHideVerseNums())
    if (this.selection) {
      this.applySelection({ replaceUrl: false })
      const row = this.verseEl(this.selection.end)
      row?.scrollIntoView({ block: "center" })
      queueMicrotask(() => this.focusFirstVisible(row))
    }
    if (this.guestSession) {
      rememberRead(this.passageSlugValue || this.chapterSlugValue)
      queueMicrotask(() => this.hydrateGuestNotes())
    }
  }

  disconnect() {
    this.flushPending()
    document.removeEventListener("turbo:before-visit", this.flushPending)
    window.removeEventListener("pagehide", this.flushPending)
    document.removeEventListener("visibilitychange", this.onVisibility)
    this.teardownPointer()
  }

  get guestSession() {
    return shouldUseGuestPack(this.signedInValue)
  }

  onVisibility() {
    if (document.visibilityState === "hidden") this.flushPending()
  }

  initialSelection() {
    if (!this.hasSpanStartValue || !this.spanStartValue) return null
    const end = this.hasSpanEndValue && this.spanEndValue ? this.spanEndValue : this.spanStartValue
    return { start: this.spanStartValue, end }
  }

  pressStart(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return
    if (event.target.closest(".note-tray, .chapter-tray, .otext, a, input, textarea, .jump, .topbar, .reader-dock, .reader-chrome")) return
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
    this.dragStartTop = verse ? verse.getBoundingClientRect().top : null
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
      currentStartVerseTop: startEl?.getBoundingClientRect().top,
      dx,
      dy
    })
    if (!startRange && !this.dragging) return
    this.dragging = true
    this.swipeAxis = null
    this.ignoreClick = true
    event.preventDefault()
    this.pressEl?.setPointerCapture?.(event.pointerId)
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
      row.classList.toggle("is-span", n >= span.start && n <= span.end)
    })
    this.updateTitle(span)
  }

  openSingle(n, { focus = true } = {}) {
    const row = this.verseEl(n)
    if (!row) return
    row.classList.add("is-open")
    row.querySelectorAll(".note-tray").forEach((tray) => {
      tray.hidden = tray.hasAttribute("data-range-composer")
    })
    if (focus) this.focusFirstVisible(row)
  }

  openRange(start, end, { focus = true } = {}) {
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
      if (focus) this.focusOutliner(rangeTray)
      return
    }
    if (focus) this.focusFirstVisible(row)
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
    this.element.querySelectorAll("[data-controller~='chrome']").forEach((el) => {
      el.dispatchEvent(new Event("chrome:reveal"))
    })
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
    this.selection = null
    this.applySelection({ replaceUrl: true })
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
      const selected = row?.classList.contains("is-open")
      const collapsed = this.collapsedNotes.has(n)
      tray.hidden = collapsed || !(expanding || selected)
    })
  }

  async copyPassage(event) {
    this.flushPending()
    const text = this.shareTextFor("chapter")
    const html = this.shareHtmlFor("chapter")
    const ok = await this.writeClipboard(text, html)
    this.markCopied(event.currentTarget, ok)
  }

  async copyNote(event) {
    event.preventDefault()
    event.stopPropagation()
    this.flushPending()
    const tray = event.currentTarget.closest(".note-tray, .chapter-tray")
    const host = tray?.querySelector(".outliner")
    const controller = this.outlinerController(host)
    const blocks = controller && !controller.isEmpty() ? controller.payload().blocks : []
    const label = tray?.querySelector(".tray-label")?.textContent?.trim() || ""
    const text = formatNoteShare({ label, blocks })
    const html = formatNoteHtml({ label, blocks })
    const ok = await this.writeClipboard(text, html)
    this.markCopied(event.currentTarget, ok)
  }

  async sharePassage(event) {
    this.flushPending()
    const scope = event.params.scope === "verse" ? "verse" : "chapter"
    const payload = this.sharePayload(scope)
    const copied = await this.writeClipboard(payload.text, payload.html)
    if (navigator.share) {
      try {
        // text-only: passing title/url makes some desktop sheets drop the body.
        await navigator.share({ text: payload.text })
        return
      } catch (error) {
        if (error?.name === "AbortError") return
      }
    }
    this.markCopied(event.currentTarget, copied)
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

  async writeClipboard(text, html) {
    try {
      if (html && window.ClipboardItem && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([ text ], { type: "text/plain" }),
            "text/html": new Blob([ html ], { type: "text/html" })
          })
        ])
        return true
      }
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        window.prompt("Copy", text)
        return false
      }
    }
  }

  markCopied(button, ok) {
    if (!button || !ok) return
    const priorTitle = button.getAttribute("title")
    const priorLabel = button.getAttribute("aria-label")
    button.classList.add("is-copied")
    button.setAttribute("title", "Copied")
    button.setAttribute("aria-label", "Copied")
    window.clearTimeout(button._copiedTimer)
    button._copiedTimer = window.setTimeout(() => {
      button.classList.remove("is-copied")
      if (priorTitle) button.setAttribute("title", priorTitle)
      else button.removeAttribute("title")
      if (priorLabel) button.setAttribute("aria-label", priorLabel)
    }, 1400)
  }

  currentSlug() {
    if (!this.selection) return this.chapterSlugValue
    return rangeSlug(this.chapterSlugValue, this.selection.start, this.selection.end)
  }

  autosave(event) {
    const host = event.currentTarget.closest(".outliner")
    if (!host) return
    host._dirty = true
    if (this.guestSession) {
      this.saveGuest(host)
      return
    }
    clearTimeout(host._kvTimer)
    host._kvTimer = setTimeout(() => {
      host._kvTimer = null
      this.save(host)
      host._dirty = false
    }, 450)
  }

  flushPending() {
    if (this.guestSession) {
      this.flushGuestPack()
      return
    }
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
    const verse = host.closest(".verse")
    if (verse) verse.classList.toggle("has-note", this.anyNoteText(verse))
  }

  hydrateGuestNotes() {
    const pack = loadPack()
    const notes = notesForChapter(this.chapterSlugValue, pack)
    notes.forEach((note) => this.applyGuestNote(note))
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
    if (this.guestSession) this.saveGuest(host)
    else this.save(host)
    host._dirty = false
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
    if (this.guestSession) {
      setNoteBookmarked(payload.slug, next)
      return
    }
    this.saveBookmark(host, next)
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
    this.markGuestCoverage(note.slug)
  }

  markGuestCoverage(slug) {
    const parsed = parseSlug(slug)
    if (!parsed || parsed.kind === "chapter") return
    const start = parsed.verseStart
    const end = parsed.verseEnd || parsed.verseStart
    for (let n = start; n <= end; n += 1) this.verseEl(n)?.classList.add("has-note")
    this.element.querySelectorAll("[data-action='click->reader#toggleExpand']").forEach((expand) => {
      expand.disabled = false
    })
    if (this.element.classList.contains("is-expanded")) this.refreshExpand()
  }

  trayForSlug(slug) {
    const escaped = CSS.escape(slug)
    return this.element.querySelector(`[data-note-slug="${escaped}"]`)
      || this.element.querySelector(`[data-range-slug="${escaped}"]`)
      || this.element.querySelector(`.outliner[data-slug="${escaped}"]`)?.closest(".note-tray, .chapter-tray")
  }

  materializeRangeTray(parsed, slug) {
    const row = this.verseEl(parsed.verseEnd)
    if (!row || !this.hasRangeTemplateTarget) return null
    let tray = this.rangeTrayFor(row, slug)
    if (tray) return tray
    tray = this.buildRangeTray(slug, parsed.verseStart, parsed.verseEnd)
    delete tray.dataset.ephemeral
    tray.removeAttribute("data-ephemeral")
    tray.dataset.noteSlug = slug
    row.append(tray)
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
