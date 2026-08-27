import { Controller } from "@hotwired/stimulus"
import { loadPack } from "../lib/guest-pack"
import { PASSKEY_SETTLED_COPY, passkeyWaitCopy } from "../lib/passkey-wait"

export default class extends Controller {
  static targets = [ "status" ]
  static values = { waitMs: { type: Number, default: 2500 } }

  connect() {
    this.element.addEventListener("passkey:success", this.attachPack)
    this.element.addEventListener("passkey:error", this.noteError)
    this.showWait(passkeyWaitCopy({ supported: !!window.PublicKeyCredential }))
    if (this.hasStatusTarget && this.statusTarget.textContent === PASSKEY_SETTLED_COPY) return
    this.settleTimer = setTimeout(this.settle, this.waitMsValue)
  }

  disconnect() {
    clearTimeout(this.settleTimer)
    this.element.removeEventListener("passkey:success", this.attachPack)
    this.element.removeEventListener("passkey:error", this.noteError)
  }

  noteError = (event) => {
    const type = event.detail?.type
    this.showWait(passkeyWaitCopy({ cancelled: type === "cancelled", failed: type !== "cancelled" }))
    clearTimeout(this.settleTimer)
  }

  settle = () => {
    this.showWait(passkeyWaitCopy({ timedOut: true }))
  }

  showWait(copy) {
    if (this.hasStatusTarget) this.statusTarget.textContent = copy
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
