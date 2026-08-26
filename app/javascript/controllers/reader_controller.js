import { Controller } from "@hotwired/stimulus"
import { chapterSwipe } from "../lib/chapter-swipe"
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
  formatChapterShare,
  formatVerseShare,
  notesForVerse,
  passageUrl
} from "../lib/share-text"

export default class extends Controller {
  static targets = ["tray", "preview", "chapterTray", "rangeTemplate", "title", "numsToggle", "copyButton"]
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
    if (event.target.closest(".note-tray, .note-preview, .otext, a, input, textarea, .jump, .topbar, .reader-dock")) return
    this.pointerOrigin = { x: event.clientX, y: event.clientY, t: event.timeStamp }
    const press = event.target.closest(".verse-press")
    const verse = press?.closest("[data-verse]")
    if (verse) {
      this.dragStart = Number(verse.dataset.verse)
      this.dragCurrent = this.dragStart
      press.setPointerCapture?.(event.pointerId)
    } else {
      this.dragStart = null
      this.dragCurrent = null
    }
    this.dragging = false
    this.pointerId = event.pointerId
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
    if (this.pointerOrigin == null && this.dragStart == null) return
    const hovered = this.verseAtPoint(event.clientX, event.clientY) || this.dragCurrent || this.dragStart
    const start = this.dragStart
    const wasDragging = this.dragging
    const origin = this.pointerOrigin
    this.ignoreClick = true
    this.resetDrag()
    if (wasDragging && start != null && hovered !== start) {
      this.selection = selectionFromDrag(start, hovered)
      this.applySelection({ replaceUrl: true })
      return
    }
    const swipe = origin && chapterSwipe({
      dx: event.clientX - origin.x,
      dy: event.clientY - origin.y,
      elapsedMs: event.timeStamp - origin.t,
      rangeDragging: wasDragging
    })
    if (swipe) {
      const url = swipe === "next" ? this.nextUrlValue : this.prevUrlValue
      if (url) {
        this.visitChapter(url)
        return
      }
    }
    if (start == null) return
    if (this.verseEl(start)?.classList.contains("is-open")) {
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

  toggleNums() {
    this.applyNums(!this.element.classList.contains("is-nums-hidden"))
  }

  applyNums(hidden) {
    this.element.classList.toggle("is-nums-hidden", hidden)
    if (this.hasNumsToggleTarget) {
      this.numsToggleTarget.classList.toggle("is-on", hidden)
      this.numsToggleTarget.setAttribute("aria-pressed", hidden ? "true" : "false")
    }
    saveHideVerseNums(hidden)
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

  async copyPassage(event) {
    this.flushPending()
    const text = this.shareTextFor(this.verseScope() ? "verse" : "chapter")
    const ok = await this.writeClipboard(text)
    this.markCopied(event.currentTarget, ok)
  }

  async sharePassage(event) {
    this.flushPending()
    const scope = event.params.scope === "verse" ? "verse" : "chapter"
    const text = this.shareTextFor(scope)
    const title = text.split("\n")[0] || "Margin"
    if (navigator.share) {
      try {
        await navigator.share({ title, text })
        return
      } catch (error) {
        if (error?.name === "AbortError") return
      }
    }
    const ok = await this.writeClipboard(text)
    this.markCopied(event.currentTarget, ok)
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
    const notes = this.liveNotes()
    const span = this.verseScope()
    if (scope === "verse" && span) {
      const verses = this.chapterVerses(notes, span.start, span.end)
      const slug = rangeSlug(this.chapterSlugValue, span.start, span.end)
      const label = this.shareLabel(span)
      const url = passageUrl(slug)
      if (span.start === span.end) {
        const row = verses[0]
        return formatVerseShare({
          label,
          text: row?.text || "",
          notes: row?.notes || [],
          url
        })
      }
      return formatChapterShare({ label, verses, url })
    }
    return formatChapterShare({
      label: `${this.bookLabelValue} ${this.chapterValue}`,
      chapterNote: notes.find((note) => note.slug === this.chapterSlugValue)?.blocks,
      verses: this.chapterVerses(notes),
      url: passageUrl(this.chapterSlugValue)
    })
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
        text: row.querySelector(".vtext")?.textContent || "",
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

  async writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      window.prompt("Copy", text)
      return false
    }
  }

  markCopied(button, ok) {
    if (!button || !ok) return
    const prior = button.getAttribute("title")
    button.title = "Copied"
    window.setTimeout(() => {
      if (prior) button.title = prior
      else button.removeAttribute("title")
    }, 1600)
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
    const expand = this.element.querySelector("[data-action='click->reader#toggleExpand']")
    if (expand) expand.disabled = false
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
    this.dragging = false
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
