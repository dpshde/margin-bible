import { defaultStorage } from "./guest-pack.js"

export const PASSKEY_HINT_KEY = "margin.passkey"

export function hasPasskeyHint(storage = defaultStorage()) {
  try {
    return Boolean(storage.getItem(PASSKEY_HINT_KEY))
  } catch {
    return false
  }
}

export function rememberPasskeyHint(storage = defaultStorage()) {
  try {
    storage.setItem(PASSKEY_HINT_KEY, "1")
  } catch {
    // Safari private mode / missing storage
  }
}

export function passkeyPrimaryMode(_hasHint = hasPasskeyHint()) {
  return "use"
}

export function passkeyAutoStartKind({
  passkeysSupported = true,
  hasOptions = true,
  immediateAvailable = false,
  userActivated = false
} = {}) {
  if (!passkeysSupported || !hasOptions) return null
  if (immediateAvailable && userActivated) return "immediate"
  return "conditional"
}

export function passkeyAutoStartSteps(options = {}) {
  const kind = passkeyAutoStartKind(options)
  if (kind === "immediate") return [ "immediate", "conditional" ]
  if (kind === "conditional") return [ "conditional" ]
  return []
}

export function refocusPasskeyUsername(input) {
  if (!input || typeof input.focus !== "function") return false
  if (typeof input.blur === "function" && globalThis.document?.activeElement === input) {
    input.blur()
  }
  input.focus()
  return true
}
