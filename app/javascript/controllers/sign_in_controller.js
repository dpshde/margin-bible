import { Controller } from "@hotwired/stimulus"
import { loadPack } from "../lib/guest-pack"
import { hasPasskeyHint, passkeyPrimaryMode } from "../lib/passkey-hint"

export default class extends Controller {
  static targets = [ "use", "create", "useSwitch", "createSwitch" ]

  connect() {
    this.element.addEventListener("passkey:success", this.attachPack)
    this.applyMode(passkeyPrimaryMode(hasPasskeyHint()))
  }

  disconnect() {
    this.element.removeEventListener("passkey:success", this.attachPack)
  }

  preferUse() {
    this.applyMode("use")
  }

  preferCreate() {
    this.applyMode("create")
  }

  applyMode(mode) {
    const use = mode === "use"
    if (this.hasUseTarget) this.useTarget.hidden = !use
    if (this.hasCreateTarget) this.createTarget.hidden = use
    if (this.hasUseSwitchTarget) this.useSwitchTarget.hidden = use
    if (this.hasCreateSwitchTarget) this.createSwitchTarget.hidden = !use
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
