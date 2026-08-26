import { Controller } from "@hotwired/stimulus"
import { nearBottomEdge, nextChromeHidden } from "../lib/chrome-hide"

export default class extends Controller {
  connect() {
    this.hidden = false
    this.lastY = window.scrollY
    this.onScroll = this.onScroll.bind(this)
    this.onMove = this.onMove.bind(this)
    this.onFocusIn = this.show.bind(this)
    window.addEventListener("scroll", this.onScroll, { passive: true })
    window.addEventListener("mousemove", this.onMove, { passive: true })
    this.element.addEventListener("focusin", this.onFocusIn)
    this.sync()
  }

  disconnect() {
    window.removeEventListener("scroll", this.onScroll)
    window.removeEventListener("mousemove", this.onMove)
    this.element.removeEventListener("focusin", this.onFocusIn)
  }

  onScroll() {
    if (!this.floats()) return this.show()
    const scrollY = window.scrollY
    this.hidden = nextChromeHidden({
      hidden: this.hidden,
      scrollY,
      lastY: this.lastY,
      locked: this.locked()
    })
    this.lastY = scrollY
    this.sync()
  }

  onMove(event) {
    if (!this.floats() || this.locked()) return
    if (nearBottomEdge(event.clientY, window.innerHeight)) this.show()
  }

  show() {
    this.hidden = false
    this.sync()
  }

  floats() {
    return window.matchMedia("(min-width: 641px)").matches
      && !document.documentElement.classList.contains("hotwire-native")
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }

  locked() {
    return this.element.contains(document.activeElement)
      || Boolean(this.element.querySelector(".suggest:not([hidden])"))
  }

  sync() {
    const tucked = this.floats() && this.hidden
    this.element.classList.toggle("is-tucked", tucked)
    this.element.toggleAttribute("inert", tucked)
  }
}
