export const HOUSE_SLUG = "jhn.1"

export function continueSlugFromPack(pack, fallback = HOUSE_SLUG) {
  return String(pack?.last_read || pack?.trail?.[0] || fallback)
}

export function applyContinueLink(link, pack, { fallback = HOUSE_SLUG, labelFor } = {}) {
  const slug = continueSlugFromPack(pack, fallback)
  if (!link) return slug
  link.href = `/${slug}`
  const latest = pack?.last_read || pack?.trail?.[0]
  if (latest) {
    const labelFn = typeof labelFor === "function" ? labelFor : (value) => value
    link.title = labelFn(slug)
  }
  return slug
}

export function playContinueHaptic() {
  const play = globalThis.playHaptic
  if (typeof play === "function") play("nudge")
}
