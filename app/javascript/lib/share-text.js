import { parseSlug, passageLabel } from "./passage-span.js"
import { wikiTokens } from "./wiki-markup.js"

const LINK_BASE = "https://route.bible"

export function wikiToPlain(text) {
  return wikiTokens(text).map((token) => (
    token.type === "wiki" ? token.label : token.value
  )).join("")
}

export function noteLines(blocks, baseIndent = 0, bullets = false) {
  return (Array.isArray(blocks) ? blocks : [])
    .map((block) => {
      const text = String(block?.text || "").replace(/\s+$/g, "")
      if (!text.trim()) return null
      const indent = baseIndent + (Number(block.indent) || 0)
      const prefix = "  ".repeat(indent)
      const mark = bullets && block.bullet !== false ? "- " : ""
      return `${prefix}${mark}${text}`
    })
    .filter(Boolean)
}

export function formatNoteShare({ label, blocks }) {
  const lines = []
  if (label) lines.push(String(label).trim())
  const body = noteLines(blocks, 0, true)
  if (body.length) {
    if (lines.length) lines.push("")
    lines.push(...body)
  }
  return `${lines.join("\n").trim()}\n`
}

export function formatVerseShare({ label, text, notes, url }) {
  const lines = [ label, wikiToPlain(text || "").trim() ]
  for (const note of Array.isArray(notes) ? notes : []) {
    const body = noteLines(note.blocks, 0, true)
    if (body.length) lines.push("", ...body)
  }
  if (url) lines.push("", url)
  return lines.join("\n").trim() + "\n"
}

export function formatChapterShare({ label, chapterNote, verses, url, bullets = false }) {
  const lines = [ label ]
  const chapterBody = noteLines(chapterNote, 0, bullets)
  if (chapterBody.length) lines.push("", ...chapterBody)

  for (const verse of Array.isArray(verses) ? verses : []) {
    if (verse.heading) lines.push("", verse.heading)
    lines.push("", `${verse.n}. ${wikiToPlain(verse.text || "").trim()}`)
    for (const note of Array.isArray(verse.notes) ? verse.notes : []) {
      const body = noteLines(note.blocks, 0, bullets)
      if (body.length) lines.push(...body)
    }
  }
  if (url) lines.push("", url)
  return lines.join("\n").trim() + "\n"
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function inlineToHtml(text) {
  return wikiTokens(text).map((token) => {
    if (token.type !== "wiki") {
      return escapeHtml(token.value).replace(/\n/g, "<br>")
    }
    const label = escapeHtml(token.label)
    if (!token.slug) return label
    return `<a href="${escapeHtml(`${LINK_BASE}/${token.slug}`)}">${label}</a>`
  }).join("")
}

export function blocksToHtml(blocks, baseIndent = 0) {
  const items = (Array.isArray(blocks) ? blocks : [])
    .map((block) => {
      const text = String(block?.text || "").replace(/\s+$/g, "")
      if (!text.trim()) return null
      return {
        indent: baseIndent + (Number(block.indent) || 0),
        html: inlineToHtml(text)
      }
    })
    .filter(Boolean)
  if (!items.length) return ""

  let html = ""
  let level = -1
  for (const item of items) {
    if (item.indent > level) {
      html += "<ul>"
      level = item.indent
    } else if (item.indent === level) {
      html += "</li>"
    } else {
      while (level > item.indent) {
        html += "</li></ul>"
        level -= 1
      }
      html += "</li>"
    }
    html += `<li>${item.html}`
  }
  while (level >= 0) {
    html += "</li></ul>"
    level -= 1
  }
  return html
}

export function formatNoteHtml({ label, blocks }) {
  const parts = []
  if (label) parts.push(`<p><strong>${escapeHtml(String(label).trim())}</strong></p>`)
  const list = blocksToHtml(blocks)
  if (list) parts.push(list)
  return parts.join("")
}

export function formatChapterHtml({ label, chapterNote, verses }) {
  const parts = []
  if (label) parts.push(`<p><strong>${escapeHtml(label)}</strong></p>`)
  const chapterList = blocksToHtml(chapterNote)
  if (chapterList) parts.push(chapterList)
  for (const verse of Array.isArray(verses) ? verses : []) {
    if (verse.heading) parts.push(`<p><strong>${escapeHtml(verse.heading)}</strong></p>`)
    parts.push(`<p>${verse.n}. ${escapeHtml(wikiToPlain(verse.text || "").trim())}</p>`)
    for (const note of Array.isArray(verse.notes) ? verse.notes : []) {
      const list = blocksToHtml(note.blocks)
      if (list) parts.push(list)
    }
  }
  return parts.join("")
}

export function formatBookShare({ label, chapters, url }) {
  const parts = [ label ]
  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    parts.push("", formatChapterShare({
      label: chapter.label,
      chapterNote: chapter.chapterNote,
      verses: chapter.verses,
      bullets: true
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
