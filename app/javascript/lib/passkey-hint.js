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
