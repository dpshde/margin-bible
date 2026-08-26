import { Controller } from "@hotwired/stimulus"
import { parseToResolverPath, tryParseAnyPassage } from "grab-bcv"
import { canGo, insertTextFor, jumpState } from "../lib/jump-suggest"

export default class extends Controller {
  static targets = ["input", "list"]

  suggest() {
    const state = jumpState(this.inputTarget.value)
    this.hits = state.hits
    const open = state.hits.length > 0 || Boolean(state.hint)
    this.selected = open && state.hits.length ? 0 : -1
    this.listTarget.hidden = !open
    this.element.classList.toggle("is-open", open)
    this.inputTarget.setAttribute("aria-expanded", open ? "true" : "false")
    const hint = state.hint
      ? `<li class="suggest-hint" role="note">${this.escape(state.hint)}</li>`
      : ""
    const options = state.hits
      .map((hit, index) => {
        const id = `jump-opt-${index}`
        const selected = index === this.selected
        return `<li id="${id}" role="option" aria-selected="${selected ? "true" : "false"}"><button type="button" data-index="${index}" data-action="click->search#pick">${this.escape(hit.label)}</button></li>`
      })
      .join("")
    this.listTarget.innerHTML = options + hint
    this.syncActive()
  }

  keydown(event) {
    if (event.target !== this.inputTarget) return
    const items = this.optionItems()
    if (event.key === "ArrowDown") {
      if (this.listTarget.hidden || !items.length) return
      event.preventDefault()
      this.moveHighlight(1, items)
      return
    }
    if (event.key === "ArrowUp") {
      if (this.listTarget.hidden || !items.length) return
      event.preventDefault()
      this.moveHighlight(-1, items)
      return
    }
    if (event.key === "Enter") {
      if (this.selected >= 0 && items.length) {
        event.preventDefault()
        this.applyHit(this.hits[this.selected])
      } else if (!canGo(this.inputTarget.value)) {
        event.preventDefault()
      }
      return
    }
    if (event.key === "Tab" && this.selected >= 0 && items.length) {
      event.preventDefault()
      this.applyHit(this.hits[this.selected])
      return
    }
    if (event.key === "Escape") {
      this.close()
    }
  }

  moveHighlight(delta, items) {
    if (!items.length) return
    this.selected = (this.selected + delta + items.length) % items.length
    items.forEach((item, i) => item.setAttribute("aria-selected", i === this.selected ? "true" : "false"))
    this.syncActive()
  }

  pick(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (!Number.isFinite(index) || !this.hits?.[index]) return
    this.applyHit(this.hits[index])
  }

  applyHit(hit) {
    const next = insertTextFor(hit)
    const current = this.inputTarget.value
    if (this.sameEntry(current, next) && canGo(current)) {
      this.goToInput()
      return
    }
    this.inputTarget.value = next
    this.inputTarget.focus()
    this.inputTarget.setSelectionRange(next.length, next.length)
    this.suggest()
  }

  go(event) {
    event.preventDefault()
    this.goToInput()
  }

  goToInput() {
    const q = this.inputTarget.value.trim()
    if (!canGo(q)) return
    const parsed = tryParseAnyPassage(q)
    if (!parsed.ok) return
    const value = Array.isArray(parsed.value) ? parsed.value[0] : parsed.value
    window.location.href = parseToResolverPath(value.canonical)
  }

  close() {
    this.listTarget.hidden = true
    this.element.classList.remove("is-open")
    this.inputTarget.setAttribute("aria-expanded", "false")
    this.inputTarget.removeAttribute("aria-activedescendant")
    this.selected = -1
  }

  optionItems() {
    return [...this.listTarget.querySelectorAll("li[role='option']")]
  }

  syncActive() {
    const items = this.optionItems()
    const active = items[this.selected]
    if (active) this.inputTarget.setAttribute("aria-activedescendant", active.id)
    else this.inputTarget.removeAttribute("aria-activedescendant")
  }

  sameEntry(current, next) {
    return current.trim().toLowerCase() === String(next || "").trim().toLowerCase()
  }

  escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
  }
}
