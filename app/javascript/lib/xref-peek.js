import { parseSlug } from "./passage-span.js"

export function hrefForXref(slug) {
  const parsed = parseSlug(slug)
  if (!parsed) {
    const path = String(slug || "").replace(/^\//, "")
    return path ? `/${path}` : "/"
  }
  const base = `/${parsed.book}.${parsed.chapter}`
  if (parsed.kind === "chapter") return base
  if (parsed.kind === "range") return `${base}.${parsed.verseStart}-${parsed.verseEnd}?xref=1`
  return `${base}.${parsed.verseStart}?xref=1`
}

export function parseXrefHref(href) {
  if (!href) return null
  let url
  try {
    url = new URL(href, "https://margin.bible")
  } catch {
    return null
  }
  const slug = url.pathname.replace(/^\//, "").toLowerCase()
  const parsed = parseSlug(slug)
  if (!parsed) return null
  return { ...parsed, slug }
}

export function sameChapterSlug(parsed, chapterSlug) {
  if (!parsed || !chapterSlug) return false
  return `${parsed.book}.${parsed.chapter}` === String(chapterSlug)
}

export function xrefKeepTarget(node) {
  const el = node?.nodeType === 1 ? node : node?.parentElement
  return Boolean(el?.closest?.(".verse-press, a.wiki, a.pub-ref, .att-chip, .att-remove"))
}
