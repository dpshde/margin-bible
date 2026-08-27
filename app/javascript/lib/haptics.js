import { WebHaptics as DefaultWebHaptics } from "web-haptics"

const PRESETS = {
  nudge: "nudge",
  light: "nudge",
  success: "success",
  error: "error",
  warning: "warning",
  selection: "selection",
  buzz: "buzz"
}

let nativePlayer = null
let webClient = null

export function setNativeHapticPlayer(fn) {
  nativePlayer = typeof fn === "function" ? fn : null
}

export function resetHapticsForTests() {
  nativePlayer = null
  webClient = null
}

export function playHaptic(kind, deps = {}) {
  try {
    if (prefersReducedMotion(deps)) return false
    const type = PRESETS[String(kind || "").trim()]
    if (!type) return false
    if (playNative(type, deps)) return true
    return playWeb(type, deps)
  } catch {
    return false
  }
}

function playNative(type, deps) {
  if (!hasNativeBridge(deps)) return false
  if (typeof nativePlayer === "function") {
    nativePlayer(type)
    return true
  }
  const send = nativeSend(deps)
  if (!send) return false
  send({ component: "haptic", event: "play", data: { type } })
  return true
}

function playWeb(type, deps) {
  const Ctor = webHapticsCtor(deps)
  if (!Ctor) return false
  if (Ctor.isSupported === false && !deps.client) return false
  const client = deps.client || (webClient ||= new Ctor({ debug: false, showSwitch: false }))
  if (typeof client?.trigger !== "function") return false
  client.trigger(type)
  return true
}

function prefersReducedMotion(deps) {
  const matchMedia = deps.matchMedia || globalThis.matchMedia
  if (typeof matchMedia !== "function") return false
  return Boolean(matchMedia.call(globalThis, "(prefers-reduced-motion: reduce)")?.matches)
}

function hasNativeBridge(deps) {
  if (deps.strada) return true
  const g = deps.global || globalThis
  const bridge = g.HotwireNative?.web || g.Strada?.web
  if (bridge && typeof bridge.supportsComponent === "function") {
    return bridge.supportsComponent("haptic")
  }
  return false
}

function nativeSend(deps) {
  const strada = deps.strada || (deps.global || globalThis).Strada || (deps.global || globalThis).HotwireNative
  if (typeof strada?.web?.send === "function") return strada.web.send.bind(strada.web)
  if (typeof strada?.send === "function") return strada.send.bind(strada)
  return null
}

function webHapticsCtor(deps) {
  if (Object.hasOwn(deps, "WebHaptics")) return deps.WebHaptics
  return DefaultWebHaptics
}
