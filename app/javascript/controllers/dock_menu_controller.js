import { Controller } from "@hotwired/stimulus"
import { paneIsOpen, shouldCloseDockMenu } from "../lib/dock-menu"

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
    if (!shouldCloseDockMenu(item)) return
    this.element.removeAttribute("open")
  }

  openPane(name) {
    this.paneTargets.forEach((pane) => {
      pane.hidden = !paneIsOpen(pane.dataset.pane, name)
    })
  }
}
