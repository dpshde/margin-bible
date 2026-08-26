import { Controller } from "@hotwired/stimulus"
import {
  applyImportResult,
  guestPackMirrored,
  inboxSections,
  loadPack,
  markGuestPackMirrored,
  previewText,
  shouldPostGuestPack,
  shouldUseGuestPack
} from "../lib/guest-pack"
import { hrefForSlug, slugLabel } from "../lib/passage-span"

export default class extends Controller {
  static targets = ["continue", "list"]
  static values = { signedIn: Boolean, importUrl: String }

  connect() {
    if (this.signedInValue) {
      this.importGuestPack()
      return
    }
    if (!shouldUseGuestPack(this.signedInValue)) return
    const pack = loadPack()
    this.renderContinue(pack)
    if (Object.keys(pack.notes || {}).length) this.renderList(pack)
  }

  async importGuestPack() {
    if (globalThis.__marginSigningOut) return
    const pack = loadPack()
    if (!shouldPostGuestPack({
      signedIn: this.signedInValue,
      mirrored: guestPackMirrored(),
      pack
    })) return

    const token = document.querySelector('meta[name="csrf-token"]')?.content
    const url = this.hasImportUrlValue ? this.importUrlValue : "/guest_pack"
    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "X-CSRF-Token": token,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ pack })
      })
      if (!response.ok) return
      if (globalThis.__marginSigningOut) return

      const data = await response.json()
      const result = applyImportResult(data)
      if (result.mirrored) markGuestPackMirrored()
      if (result.paintPack) this.renderList(pack)
    } catch {
      // Keep the guest pack for a later visit.
    }
  }

  renderContinue(pack) {
    const latest = pack.trail?.[0] || pack.last_read
    if (!this.hasContinueTarget || !latest) return
    const link = this.continueTarget.querySelector("a")
    if (!link) return
    link.href = `/${latest}`
    link.textContent = `Continue ${slugLabel(latest)}`
    this.continueTarget.hidden = false
  }

  renderList(pack) {
    if (!this.hasListTarget) return
    const sections = inboxSections(pack)
    if (!sections.length) {
      const empty = document.createElement("p")
      empty.className = "inbox-empty"
      empty.textContent = "No notes yet. Open a passage and write under a verse — they’ll show up here newest first."
      this.listTarget.replaceChildren(empty)
      return
    }
    const nodes = []
    sections.forEach((section) => {
      const heading = document.createElement("h2")
      heading.className = section.kind === "bookmarks" ? "inbox-day is-bookmarks" : "inbox-day"
      heading.textContent = section.label
      nodes.push(heading)
      if (section.kind === "bookmarks") {
        (section.groups || []).forEach((group) => nodes.push(this.bookGroupFor(group)))
      } else {
        section.notes.forEach((note) => nodes.push(this.cardFor(note)))
      }
    })
    this.listTarget.replaceChildren(...nodes)
  }

  bookGroupFor(group) {
    const wrap = document.createElement("details")
    wrap.className = "inbox-book"
    const summary = document.createElement("summary")
    summary.className = "inbox-book-summary"
    const mark = document.createElement("span")
    mark.className = "inbox-mark"
    mark.setAttribute("aria-hidden", "true")
    mark.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M4 2.25h8v11.1L8 11.1 4 13.35z" /></svg>'
    const name = document.createElement("span")
    name.className = "inbox-book-name"
    name.textContent = group.label
    const count = document.createElement("span")
    count.className = "inbox-book-count"
    count.textContent = String(group.notes.length)
    summary.append(mark, name, count)
    summary.insertAdjacentHTML("beforeend", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="m181.66 133.66l-80 80a8 8 0 0 1-11.32-11.32L164.69 128L90.34 53.66a8 8 0 0 1 11.32-11.32l80 80a8 8 0 0 1 0 11.32"/></svg>')
    wrap.append(summary)
    group.notes.forEach((note) => wrap.append(this.cardFor(note, { mark: false })))
    return wrap
  }

  cardFor(note, { mark = Boolean(note.bookmarked) } = {}) {
    const card = document.createElement("a")
    card.className = "inbox-card"
    card.href = hrefForSlug(note.slug)

    if (note.bookmarked) card.classList.add("is-bookmarked")

    const title = document.createElement("p")
    title.className = "inbox-card-title"
    if (mark) {
      const icon = document.createElement("span")
      icon.className = "inbox-mark"
      icon.setAttribute("aria-hidden", "true")
      icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M4 2.25h8v11.1L8 11.1 4 13.35z" /></svg>'
      title.append(icon)
    }
    title.append(document.createTextNode(slugLabel(note.slug)))
    card.append(title)

    const preview = previewText(note.blocks)
    if (!preview) {
      const empty = document.createElement("p")
      empty.className = "inbox-card-empty"
      empty.textContent = "Empty note"
      card.append(empty)
      return card
    }

    const body = document.createElement("div")
    body.className = "inbox-preview"
    note.blocks.forEach((block) => {
      if (!String(block.text || "").trim()) return
      const line = document.createElement("p")
      line.className = "preview-line"
      line.style.setProperty("--depth", String(Number(block.indent) || 0))
      line.textContent = block.text
      body.append(line)
    })
    card.append(body)
    return card
  }
}
