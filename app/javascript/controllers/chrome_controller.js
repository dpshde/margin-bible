import { Controller } from "@hotwired/stimulus"
import {
  applyReaderChromeTuck,
  chromeLocked,
  detectFineHover,
  documentMetrics,
  nearDocumentBottom,
  pointerOverPager,
  shouldShowChromeFromPointer,
  nextChromeHidden
} from "../lib/chrome-hide"

export default class extends Controller {
  static values = { edge: { type: String, default: "bottom" } }

  connect() {
    this.hidden = false
    this.lastY = window.scrollY
    this.ignoreScroll = false
    this.fineHover = detectFineHover()
    this.reader = this.edgeValue === "bottom" ? this.element.closest(".reader") : null
    this.onScroll = this.onScroll.bind(this)
    this.onMove = this.onMove.bind(this)
    this.onFocusIn = this.show.bind(this)
    this.onPointer = this.onMove.bind(this)
    window.addEventListener("scroll", this.onScroll, { passive: true })
    window.addEventListener("mousemove", this.onMove, { passive: true })
    window.addEventListener("pointerdown", this.onPointer, { passive: true })
    this.element.addEventListener("focusin", this.onFocusIn)
    this.sync()
  }

  disconnect() {
    window.removeEventListener("scroll", this.onScroll)
    window.removeEventListener("mousemove", this.onMove)
    window.removeEventListener("pointerdown", this.onPointer)
    this.element.removeEventListener("focusin", this.onFocusIn)
    applyReaderChromeTuck(this.reader, false)
  }

  onScroll() {
    const scrollY = window.scrollY
    if (this.ignoreScroll) {
      this.ignoreScroll = false
      this.lastY = scrollY
      return
    }
    if (!this.floats()) {
      this.lastY = scrollY
      return this.show()
    }
    const nextHidden = nextChromeHidden({
      hidden: this.hidden,
      scrollY,
      lastY: this.lastY,
      locked: this.locked(),
      nearBottom: this.atDocumentBottom(),
      minY: this.edgeValue === "top" ? 8 : 24
    })
    this.lastY = scrollY
    if (nextHidden !== this.hidden) this.ignoreScroll = true
    this.hidden = nextHidden
    this.sync()
  }

  atDocumentBottom() {
    if (this.edgeValue !== "bottom") return false
    return nearDocumentBottom(documentMetrics())
  }

  onMove(event) {
    if (!this.floats() || this.locked()) return
    if (shouldShowChromeFromPointer({
      clientY: event.clientY,
      innerHeight: window.innerHeight,
      edge: this.edgeValue,
      overPager: pointerOverPager(event.target),
      fineHover: this.fineHover,
      pointerType: event.pointerType
    })) this.show()
  }

  show() {
    this.hidden = false
    this.lastY = window.scrollY
    this.sync()
  }

  floats() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false
    if (this.edgeValue === "top") {
      return Boolean(this.element.closest(".is-quiet"))
    }
    return true
  }

  locked() {
    return chromeLocked({
      activeElement: document.activeElement,
      root: this.element,
      suggestOpen: Boolean(this.element.querySelector(".suggest:not([hidden])")),
      menuOpen: Boolean(this.element.querySelector("details[open]")),
      gridOpen: Boolean(document.querySelector(".chapter-grid.is-open"))
    })
  }

  sync() {
    const tucked = this.floats() && this.hidden
    this.element.classList.toggle("is-tucked", tucked)
    this.element.toggleAttribute("inert", tucked)
    applyReaderChromeTuck(this.reader, tucked)
  }
}
