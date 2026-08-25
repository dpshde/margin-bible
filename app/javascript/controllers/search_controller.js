import { Controller } from "@hotwired/stimulus"
import { autocompletePassage, tryParseAnyPassage, parseToResolverPath } from "grab-bcv"

export default class extends Controller {
  static targets = ["input", "list"]

  suggest() {
    const q = this.inputTarget.value.trim()
    const hits = q ? autocompletePassage(q, { limit: 8 }) : []
    this.listTarget.hidden = hits.length === 0
    this.listTarget.innerHTML = hits
      .map(
        (h) =>
          `<li><button type="button" data-canonical="${h.canonical}" data-action="click->search#pick">${this.escape(h.label)}</button></li>`
      )
      .join("")
  }

  pick(event) {
    const canonical = event.currentTarget.dataset.canonical
    this.goTo(canonical)
  }

  go(event) {
    event.preventDefault()
    const q = this.inputTarget.value.trim()
    if (!q) return
    const parsed = tryParseAnyPassage(q)
    if (parsed.ok) {
      this.goTo(parsed.value.canonical)
      return
    }
    window.location.href = `/resolve?q=${encodeURIComponent(q)}`
  }

  goTo(canonical) {
    const path = parseToResolverPath(canonical)
    window.location.href = path
  }

  escape(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
  }
}
