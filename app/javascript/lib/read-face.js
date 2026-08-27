import { defaultStorage } from "./guest-pack.js"

export const FACE_KEY = "margin.face"
export const FACE_PREFS = [ "serif" ]

export function parseFace(raw) {
  return FACE_PREFS.includes(raw) ? raw : "serif"
}

export function loadFace(storage = defaultStorage()) {
  try {
    return parseFace(storage.getItem(FACE_KEY))
  } catch {
    return "serif"
  }
}

export function saveFace(pref, storage = defaultStorage()) {
  const mode = parseFace(pref)
  try {
    storage.setItem(FACE_KEY, mode)
  } catch {
    // Safari private mode / missing storage
  }
  return mode
}

export function applyFace(pref, { storage = defaultStorage(), root } = {}) {
  const mode = saveFace(pref, storage)
  const el = root || (typeof document === "undefined" ? null : document.documentElement)
  if (el?.dataset) el.dataset.face = mode
  if (typeof document === "undefined") return mode
  document.querySelectorAll("[data-face-pref]").forEach((button) => {
    const on = button.getAttribute("data-face-pref") === mode
    button.classList.toggle("is-on", on)
    button.setAttribute("aria-pressed", on ? "true" : "false")
  })
  return mode
}
