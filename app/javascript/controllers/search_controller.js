import { Controller } from "@hotwired/stimulus"
import { autocompletePassage, tryParseAnyPassage, parseToResolverPath } from "grab-bcv"

export default class extends Controller {
  static targets = ["input", "list"]

  suggest() {
    const q = this.inputTarget.value.trim()
    const hits = q ? autocompletePassage(q, { limit: 8 }) : []
    this.selected = -1
    this.listTarget.hidden = hits.length === 0
    this.element.classList.toggle("is-open", hits.length > 0)
    this.inputTarget.setAttribute("aria-expanded", hits.length > 0 ? "true" : "false")
    this.listTarget.innerHTML = hits
      .map(
        (h) =>
          `<li role="option"><button type="button" data-canonical="${h.canonical}" data-action="click->search#pick">${this.escape(h.label)}</button></li>`
      )
      .join("")
  }

  keydown(event) {
    if (this.listTarget.hidden) return
    const items = [...this.listTarget.querySelectorAll("li")]
    if (!items.length) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      this.moveHighlight(1, items)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      this.moveHighlight(-1, items)
    } else if (event.key === "Enter" && this.selected >= 0) {
      event.preventDefault()
      items[this.selected]?.querySelector("button")?.click()
    } else if (event.key === "Escape") {
      this.listTarget.hidden = true
      this.element.classList.remove("is-open")
      this.inputTarget.setAttribute("aria-expanded", "false")
    }
  }

  moveHighlight(delta, items) {
    this.selected = (this.selected + delta + items.length) % items.length
    items.forEach((item, i) => item.toggleAttribute("aria-selected", i === this.selected))
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
