import { parseSlug } from "./passage-span.js"

export const SNAPSHOT_FORMAT = "margin.library-snapshot"
export const SNAPSHOT_VERSION = 1

export function snapshotFilename(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replaceAll("-", "")
  return `margin-notes-${stamp}.json`
}

export function osisFromParsed(parsed, slug) {
  if (!parsed) return String(slug || "").toUpperCase()
  const book = parsed.book.toUpperCase()
  if (parsed.kind === "chapter") return `${book}.${parsed.chapter}`
  if (parsed.kind === "range") return `${book}.${parsed.chapter}.${parsed.verseStart}-${parsed.verseEnd}`
  return `${book}.${parsed.chapter}.${parsed.verseStart}`
}

export function noteFromGuest(note) {
  const parsed = parseSlug(note?.slug)
  return {
    slug: String(note?.slug || ""),
    osis: osisFromParsed(parsed, note?.slug),
    kind: parsed?.kind || "verse",
    book: parsed ? parsed.book.toUpperCase() : "",
    chapter: parsed?.chapter ?? null,
    verse_start: parsed?.verseStart ?? null,
    verse_end: parsed?.kind === "range" ? parsed.verseEnd : (parsed?.verseStart ?? null),
    bookmarked: Boolean(note?.bookmarked),
    source: "human",
    agent_name: null,
    agent_color: null,
    blocks: Array.isArray(note?.blocks) ? note.blocks : [],
    attachments: Array.isArray(note?.attachments) ? note.attachments : [],
    created_at: note?.created_at || null,
    updated_at: note?.updated_at || null
  }
}

export function guestSnapshot(pack, now = new Date()) {
  return {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    exported_at: now.toISOString(),
    library: {
      last_read_slug: pack?.last_read || null,
      read_trail: Array.isArray(pack?.trail) ? pack.trail : []
    },
    notes: Object.values(pack?.notes || {}).map(noteFromGuest)
  }
}

export function downloadSnapshot(payload, filename = snapshotFilename(), io = globalThis.document) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = io.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return filename
}
