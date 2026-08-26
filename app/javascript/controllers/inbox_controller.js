import { Controller } from "@hotwired/stimulus"
import { inboxSections, loadPack, previewText, shouldUseGuestPack } from "../lib/guest-pack"
import { hrefForSlug, slugLabel } from "../lib/passage-span"

export default class extends Controller {
  static targets = ["continue", "list"]
  static values = { signedIn: Boolean }

  connect() {
    if (!shouldUseGuestPack(this.signedInValue)) return
    const pack = loadPack()
    this.renderContinue(pack)
    if (Object.keys(pack.notes || {}).length) this.renderList(pack)
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
      section.notes.forEach((note) => nodes.push(this.cardFor(note)))
    })
    this.listTarget.replaceChildren(...nodes)
  }

  cardFor(note) {
    const card = document.createElement("a")
    card.className = "inbox-card"
    card.href = hrefForSlug(note.slug)

    if (note.bookmarked) card.classList.add("is-bookmarked")

    const title = document.createElement("p")
    title.className = "inbox-card-title"
    if (note.bookmarked) {
      const mark = document.createElement("span")
      mark.className = "inbox-mark"
      mark.setAttribute("aria-hidden", "true")
      mark.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M4 2.25h8v11.1L8 11.1 4 13.35z" /></svg>'
      title.append(mark)
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
