import { tryParseAnyPassage } from "grab-bcv"
import { slugLabel } from "./passage-span.js"
import { hrefForXref } from "./xref-peek.js"

const WIKI_TOKEN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export function resolveWikiTarget(raw) {
  const input = String(raw || "").trim()
  if (!input) return null
  const parsed = tryParseAnyPassage(input)
  if (!parsed.ok) return null
  const slug = String(parsed.value.canonical || "").toLowerCase()
  if (!slug) return null
  return { slug, href: hrefForXref(slug), label: slugLabel(slug) }
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
      href: resolved?.href || null
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

function isWordChar(ch) {
  return ch != null && /[A-Za-z0-9]/.test(ch)
}

export function inlineMdTokens(text) {
  const source = String(text || "")
  const tokens = []
  let i = 0
  while (i < source.length) {
    if (source[i] === "`") {
      const end = source.indexOf("`", i + 1)
      if (end > i + 1 && source.slice(i + 1, end).indexOf("\n") < 0) {
        tokens.push({ type: "code", value: source.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    if (source[i] === "*" && source[i + 1] === "*") {
      const end = source.indexOf("**", i + 2)
      if (end > i + 2 && source.slice(i + 2, end).indexOf("\n") < 0) {
        tokens.push({ type: "strong", value: source.slice(i + 2, end) })
        i = end + 2
        continue
      }
    }
    if (source[i] === "*" && source[i + 1] !== "*") {
      const end = source.indexOf("*", i + 1)
      if (end > i + 1 && source[end + 1] !== "*" && source.slice(i + 1, end).indexOf("\n") < 0) {
        tokens.push({ type: "em", value: source.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    if (source[i] === "_" && !isWordChar(source[i - 1])) {
      const end = source.indexOf("_", i + 1)
      if (end > i + 1 && !isWordChar(source[end + 1]) && source.slice(i + 1, end).indexOf("\n") < 0) {
        tokens.push({ type: "em", value: source.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    const start = i
    i += 1
    while (i < source.length && source[i] !== "*" && source[i] !== "`" && source[i] !== "_") i += 1
    tokens.push({ type: "text", value: source.slice(start, i) })
  }
  return tokens
}

export function displayTokens(text) {
  return wikiTokens(text).flatMap((token) => {
    if (token.type !== "text") return [token]
    return inlineMdTokens(token.value)
  })
}
