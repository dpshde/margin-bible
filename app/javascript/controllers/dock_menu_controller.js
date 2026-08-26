import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["pane"]

  show(event) {
    this.openPane(event.params.pane || "root")
  }

  closed() {
    if (this.element.open) return
    this.openPane("root")
  }

  choose(event) {
    const item = event.target.closest(".dock-item")
    if (!item) return
    if (item.tagName === "A" || item.matches("[data-action*='reader#']")) {
      this.element.removeAttribute("open")
    }
  }

  openPane(name) {
    this.paneTargets.forEach((pane) => {
      pane.hidden = pane.dataset.pane !== name
    })
  }
}
