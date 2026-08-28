import { tryParseAnyPassage } from "grab-bcv"
import { slugLabel } from "./passage-span.js"
import { hrefForXref } from "./xref-peek.js"
import { wikiTokens } from "./wiki-markup.js"

const ATT_ID = /^att_[A-Za-z0-9]{4,16}$/

export function emptyAttachments(list) {
  return normalizeAttachments(list).length === 0
}

export function noteIsEmpty(blocks, attachments) {
  const noText = !Array.isArray(blocks) || blocks.every((block) => !String(block?.text || "").trim())
  return noText && emptyAttachments(attachments)
}

export function parseAttachmentInput(raw) {
  const text = String(raw || "").trim()
  if (!text) return null
  const passage = parsePassageValue(text)
  if (passage) return passage
  const fromUrl = parsePassageFromUrl(text)
  if (fromUrl) return fromUrl
  const url = absoluteHttpUrl(text)
  if (url) return { kind: "url", url, title: urlTitle(url) }
  return null
}

export function normalizeAttachments(raw) {
  const rows = Array.isArray(raw) ? raw : parseJsonList(raw)
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const normalized = normalizeAttachment(row)
    if (!normalized) continue
    const key = normalized.kind === "xref" ? `xref:${normalized.slug}` : `url:${normalized.url}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

export function addAttachment(list, incoming) {
  const current = normalizeAttachments(list)
  const parsed = incoming?.kind ? normalizeAttachment(incoming) : taggedAttachment(parseAttachmentInput(incoming), incoming)
  if (!parsed) return { list: current, added: null }
  const key = attachmentKey(parsed)
  if (current.some((row) => attachmentKey(row) === key)) return { list: current, added: null }
  const next = normalizeAttachments([ ...current, parsed ])
  const added = next.find((row) => attachmentKey(row) === key) || null
  return { list: next, added }
}

export function parsedXrefsFromBlocks(blocks) {
  const found = []
  const seen = new Set()
  for (const block of Array.isArray(blocks) ? blocks : []) {
    for (const token of wikiTokens(block?.text || "")) {
      if (token.type !== "wiki" || !token.slug || seen.has(token.slug)) continue
      seen.add(token.slug)
      found.push({ kind: "xref", slug: token.slug, title: slugLabel(token.slug) })
    }
  }
  return found
}

export function mergeParsedXrefs(list, blocks) {
  const current = normalizeAttachments(list)
  const parsed = parsedXrefsFromBlocks(blocks)
  const parsedSlugs = new Set(parsed.map((row) => row.slug))
  const kept = current.filter((row) => keepAttachment(row, parsedSlugs)).map((row) => {
    if (row.kind !== "xref" || !parsedSlugs.has(row.slug)) return row
    const title = parsed.find((item) => item.slug === row.slug)?.title || row.title
    const source = row.source === "manual" ? "manual" : "scan"
    if (title === row.title && row.source === source) return row
    return { ...row, title, source }
  })
  const present = new Set(kept.filter((row) => row.kind === "xref").map((row) => row.slug))
  const added = []
  let next = kept
  for (const xref of parsed) {
    if (present.has(xref.slug)) continue
    const result = addAttachment(next, { ...xref, source: "scan" })
    if (result.added) {
      added.push(result.added)
      present.add(xref.slug)
    }
    next = result.list
  }
  return { list: next, added, changed: !sameAttachmentSnapshot(current, next) }
}

function taggedAttachment(parsed, incoming) {
  if (!parsed) return null
  const source = incoming && typeof incoming === "object" ? incoming.source : parsed.source
  return source ? { ...parsed, source } : parsed
}

function keepAttachment(row, parsedSlugs) {
  if (row.kind !== "xref") return true
  if (row.source === "manual") return true
  return parsedSlugs.has(row.slug)
}

function sameAttachmentSnapshot(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function attachmentKey(row) {
  return row?.kind === "xref" ? `xref:${row.slug}` : `url:${row.url}`
}

export function removeAttachment(list, id) {
  return normalizeAttachments(list).filter((row) => row.id !== id)
}

export function attachmentHref(row) {
  if (row?.kind === "xref") return hrefForXref(row.slug)
  return row?.url || ""
}

function normalizeAttachment(row) {
  if (!row || typeof row !== "object") return parseAttachmentInput(row)
  if (row.kind === "xref" || row.slug) {
    const parsed = parsePassageValue(row.slug || row.title || "")
    if (!parsed) return null
    return withSource({
      id: sanitizeId(row.id) || newAttachmentId(),
      kind: "xref",
      slug: parsed.slug,
      title: String(row.title || parsed.title)
    }, row.source)
  }
  if (row.kind === "url" || row.url) {
    const url = absoluteHttpUrl(row.url || row.href || "")
    if (!url) return null
    return withSource({
      id: sanitizeId(row.id) || newAttachmentId(),
      kind: "url",
      url,
      title: String(row.title || urlTitle(url))
    }, "manual")
  }
  return parseAttachmentInput(row.title || row.target || "")
}

function parsePassageValue(input) {
  const parsed = tryParseAnyPassage(String(input || "").trim())
  if (!parsed.ok) return null
  const value = Array.isArray(parsed.value) ? parsed.value[0] : parsed.value
  const slug = String(value?.canonical || "").toLowerCase()
  if (!slug) return null
  const text = String(input || "").trim()
  if (!/\d/.test(text) && !/^https?:\/\//i.test(text)) return null
  return { kind: "xref", slug, title: slugLabel(slug) }
}

function parsePassageFromUrl(input) {
  const url = absoluteHttpUrl(input)
  if (!url) return null
  let path = ""
  try {
    path = new URL(url).pathname.replace(/^\/+/, "")
  } catch {
    return null
  }
  return parsePassageValue(path)
}

function absoluteHttpUrl(value) {
  const text = String(value || "").trim()
  if (!text) return null
  const candidate = /^www\./i.test(text) ? `https://${text}` : text
  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (!url.hostname) return null
    return url.toString()
  } catch {
    return null
  }
}

function urlTitle(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || url
  } catch {
    return url
  }
}

function parseJsonList(raw) {
  if (typeof raw !== "string" || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function sanitizeId(id) {
  const value = String(id || "")
  return ATT_ID.test(value) ? value : null
}

function withSource(row, source) {
  if (row.kind === "url") return { ...row, source: "manual" }
  if (source === "manual" || source === "scan") return { ...row, source }
  return row
}

function newAttachmentId() {
  const bytes = new Uint8Array(4)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256) })
  return `att_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`
}
