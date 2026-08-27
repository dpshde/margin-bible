import { Controller } from "@hotwired/stimulus"
import { paneIsOpen, shouldCloseDockMenu } from "../lib/dock-menu"
import { playHaptic } from "../lib/haptics"

export default class extends Controller {
  static targets = ["pane"]

  show(event) {
    playHaptic("nudge")
    this.openPane(event.params.pane || "root")
  }

  closed() {
    if (this.element.open) {
      playHaptic("nudge")
      return
    }
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
