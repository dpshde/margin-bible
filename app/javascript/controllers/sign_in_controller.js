import { Controller } from "@hotwired/stimulus"
import { loadPack } from "../lib/guest-pack"
import { passkeyPrimaryMode } from "../lib/passkey-hint"
import { playHaptic } from "../lib/haptics"

export default class extends Controller {
  static targets = [ "use", "create", "register" ]

  connect() {
    this.element.addEventListener("passkey:success", this.attachPack)
    this.element.addEventListener("passkey:error", this.onPasskeyError)
    this.element.addEventListener("click", this.onActivate)
    this.applyMode(passkeyPrimaryMode())
  }

  disconnect() {
    this.element.removeEventListener("passkey:success", this.attachPack)
    this.element.removeEventListener("passkey:error", this.onPasskeyError)
    this.element.removeEventListener("click", this.onActivate)
  }

  applyMode(_mode = "use") {
    if (this.hasUseTarget) this.useTarget.hidden = false
    if (this.hasCreateTarget) this.createTarget.hidden = false
  }

  startRegistration() {
    if (!this.hasRegisterTarget) return
    this.registerTarget.querySelector("[data-passkey='register']")?.click()
  }

  onActivate = (event) => {
    const target = event.target?.closest?.(".primary, [data-passkey]")
    if (!target || !this.element.contains(target)) return
    playHaptic("nudge")
  }

  onPasskeyError = (event) => {
    if (event.detail?.type === "cancelled") return
    playHaptic("error")
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
