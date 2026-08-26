import { defaultStorage } from "./guest-pack.js"

export const THEME_KEY = "margin.theme"
export const THEME_PREFS = [ "light", "system", "dark" ]
export const PAPER = { light: "#f6f5f2", dark: "#121211" }

export function parseTheme(raw) {
  return THEME_PREFS.includes(raw) ? raw : "light"
}

export function systemDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  } catch {
    return false
  }
}

export function resolveTheme(pref, dark = systemDark()) {
  const mode = parseTheme(pref)
  if (mode === "system") return dark ? "dark" : "light"
  return mode
}

export function nextTheme(pref) {
  const current = parseTheme(pref)
  return THEME_PREFS[(THEME_PREFS.indexOf(current) + 1) % THEME_PREFS.length]
}

export function loadTheme(storage = defaultStorage()) {
  try {
    return parseTheme(storage.getItem(THEME_KEY))
  } catch {
    return "light"
  }
}

export function saveTheme(pref, storage = defaultStorage()) {
  const mode = parseTheme(pref)
  try {
    storage.setItem(THEME_KEY, mode)
  } catch {
    // Safari private mode / missing storage
  }
  return mode
}

export function applyTheme(pref, { storage = defaultStorage(), root } = {}) {
  const mode = saveTheme(pref, storage)
  const resolved = resolveTheme(mode)
  const el = root || (typeof document === "undefined" ? null : document.documentElement)
  if (el?.dataset) {
    el.dataset.theme = mode
    if (el.style) el.style.colorScheme = resolved
  }
  if (typeof document === "undefined") return { pref: mode, resolved }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute("content", PAPER[resolved])
  document.querySelectorAll("[data-theme-pref]").forEach((button) => {
    const on = button.getAttribute("data-theme-pref") === mode
    button.classList.toggle("is-on", on)
    button.setAttribute("aria-pressed", on ? "true" : "false")
  })
  return { pref: mode, resolved }
}
