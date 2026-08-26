import { Controller } from "@hotwired/stimulus"
import { applyFace, loadFace } from "../lib/read-face"

export default class extends Controller {
  connect() {
    this.paint = this.paint.bind(this)
    this.paint()
    window.addEventListener("margin:face", this.paint)
  }

  disconnect() {
    window.removeEventListener("margin:face", this.paint)
  }

  choose(event) {
    const pref = event.currentTarget.getAttribute("data-face-pref")
    applyFace(pref)
    window.dispatchEvent(new Event("margin:face"))
  }

  paint() {
    applyFace(loadFace())
  }
}
