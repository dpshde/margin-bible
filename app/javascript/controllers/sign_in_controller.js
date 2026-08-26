import { Controller } from "@hotwired/stimulus"
import { loadPack } from "../lib/guest-pack"

export default class extends Controller {
  connect() {
    this.element.addEventListener("passkey:success", this.attachPack)
  }

  disconnect() {
    this.element.removeEventListener("passkey:success", this.attachPack)
  }

  attachPack = (event) => {
    const form = event.target.form || event.target.closest("form")
    if (!form || form.querySelector('input[name="pack"]')) return

    const input = document.createElement("input")
    input.type = "hidden"
    input.name = "pack"
    input.value = JSON.stringify(loadPack())
    form.append(input)
  }
}
