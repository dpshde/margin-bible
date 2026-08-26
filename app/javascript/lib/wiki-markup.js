import { tryParseAnyPassage } from "grab-bcv"
import { slugLabel } from "./passage-span.js"

const WIKI_TOKEN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export function resolveWikiTarget(raw) {
  const input = String(raw || "").trim()
  if (!input) return null
  const parsed = tryParseAnyPassage(input)
  if (!parsed.ok) return null
  const slug = String(parsed.value.canonical || "").toLowerCase()
  if (!slug) return null
  return { slug, href: `/${slug}`, label: slugLabel(slug) }
}

export function wikiTokens(text) {
  const source = String(text || "")
  const tokens = []
  const pattern = new RegExp(WIKI_TOKEN.source, "g")
  let last = 0
  let match = pattern.exec(source)
  while (match) {
    if (match.index > last) tokens.push({ type: "text", value: source.slice(last, match.index) })
    const target = match[1]
    const customLabel = match[2]
    const resolved = resolveWikiTarget(target)
    tokens.push({
      type: "wiki",
      raw: match[0],
      target,
      label: customLabel || resolved?.label || target,
      slug: resolved?.slug || null,
      href: resolved ? `/${resolved.slug}` : null
    })
    last = match.index + match[0].length
    match = pattern.exec(source)
  }
  if (last < source.length) tokens.push({ type: "text", value: source.slice(last) })
  return tokens
}

export function wikiRaw(target, label) {
  return label ? `[[${target}|${label}]]` : `[[${target}]]`
}
