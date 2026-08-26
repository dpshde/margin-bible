import { parseSlug, passageLabel } from "./passage-span.js"
import { wikiTokens } from "./wiki-markup.js"

const LINK_BASE = "https://route.bible"

export function wikiToPlain(text) {
  return wikiTokens(text).map((token) => (
    token.type === "wiki" ? token.label : token.value
  )).join("")
}

export function noteLines(blocks, baseIndent = 0) {
  return (Array.isArray(blocks) ? blocks : [])
    .map((block) => {
      const text = wikiToPlain(block?.text || "").replace(/\s+$/g, "")
      if (!text.trim()) return null
      const indent = baseIndent + (Number(block.indent) || 0)
      return `${"  ".repeat(indent)}${text}`
    })
    .filter(Boolean)
}

export function formatVerseShare({ label, text, notes, url }) {
  const lines = [ label, wikiToPlain(text || "").trim() ]
  for (const note of Array.isArray(notes) ? notes : []) {
    const body = noteLines(note.blocks, 1)
    if (body.length) lines.push("", ...body)
  }
  if (url) lines.push("", url)
  return lines.join("\n").trim() + "\n"
}

export function formatChapterShare({ label, chapterNote, verses, url }) {
  const lines = [ label ]
  const chapterBody = noteLines(chapterNote, 0)
  if (chapterBody.length) lines.push("", ...chapterBody)

  for (const verse of Array.isArray(verses) ? verses : []) {
    if (verse.heading) lines.push("", verse.heading)
    lines.push("", `${verse.n}. ${wikiToPlain(verse.text || "").trim()}`)
    for (const note of Array.isArray(verse.notes) ? verse.notes : []) {
      const body = noteLines(note.blocks, 1)
      if (body.length) lines.push(...body)
    }
  }
  if (url) lines.push("", url)
  return lines.join("\n").trim() + "\n"
}

export function formatBookShare({ label, chapters, url }) {
  const parts = [ label ]
  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    parts.push("", formatChapterShare({
      label: chapter.label,
      chapterNote: chapter.chapterNote,
      verses: chapter.verses
    }).trimEnd())
  }
  if (url) parts.push("", url)
  return parts.join("\n").trim() + "\n"
}

export function passageUrl(slug) {
  return slug ? `${LINK_BASE}/${slug}` : ""
}

export function verseShareLabel(bookLabel, chapter, start, end) {
  return passageLabel(bookLabel, chapter, start, end)
}

export function notesForVerse(notes, chapterSlug, n) {
  const list = Array.isArray(notes) ? notes : []
  const exact = `${chapterSlug}.${n}`
  return list.filter((note) => {
    const parsed = parseSlug(note.slug)
    if (!parsed || parsed.kind === "chapter") return false
    if (note.slug === exact) return true
    return parsed.kind === "range" && parsed.verseEnd === n
  })
}
