import { Controller } from "@hotwired/stimulus"
import { applyTheme, loadTheme } from "../lib/theme"

export default class extends Controller {
  connect() {
    this.paint = this.paint.bind(this)
    this.onScheme = this.onScheme.bind(this)
    this.paint()
    window.addEventListener("margin:theme", this.paint)
    this.scheme = window.matchMedia("(prefers-color-scheme: dark)")
    this.scheme.addEventListener?.("change", this.onScheme)
  }

  disconnect() {
    window.removeEventListener("margin:theme", this.paint)
    this.scheme?.removeEventListener?.("change", this.onScheme)
  }

  choose(event) {
    const pref = event.currentTarget.getAttribute("data-theme-pref")
    applyTheme(pref)
    window.dispatchEvent(new Event("margin:theme"))
  }

  paint() {
    applyTheme(loadTheme())
  }

  onScheme() {
    if (loadTheme() === "system") applyTheme("system")
  }
}
