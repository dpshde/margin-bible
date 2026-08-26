import { bookName } from "./book-names.js"
import { belongsToChapter, parseSlug } from "./passage-span.js"

export const GUEST_PACK_KEY = "margin.guest"
export const GUEST_MIRROR_KEY = "margin.guest.mirrored"

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function memoryStorage() {
  const data = {}
  return {
    getItem(key) {
      return Object.hasOwn(data, key) ? data[key] : null
    },
    setItem(key, value) {
      data[key] = String(value)
    },
    removeItem(key) {
      delete data[key]
    }
  }
}

export function defaultStorage() {
  try {
    if (globalThis.localStorage) return globalThis.localStorage
  } catch {
    // Safari private mode / missing window
  }
  if (!globalThis.__marginGuestMemory) globalThis.__marginGuestMemory = memoryStorage()
  return globalThis.__marginGuestMemory
}

export function emptyContent(blocks) {
  return !Array.isArray(blocks) || blocks.every((block) => !String(block?.text || "").trim())
}

export function normalizeBlocks(blocks) {
  return Array.isArray(blocks)
    ? blocks.map((block) => ({
      id: String(block?.id || ""),
      indent: Number(block?.indent) || 0,
      text: String(block?.text || ""),
      bullet: block?.bullet !== false
    }))
    : []
}

export function shouldUseGuestPack(signedIn) {
  return signedIn !== true
}

export function packHasImportableNotes(pack) {
  return Object.values(pack?.notes || {}).some((note) => !emptyContent(note?.blocks))
}

export function clearGuestNotes(storage = defaultStorage()) {
  const pack = loadPack(storage)
  pack.notes = {}
  return writePack(pack, storage)
}

export function persistNote({ signedIn, slug, blocks, storage, now, patch }) {
  const pack = upsertNote(slug, blocks, { storage, now })
  if (!shouldUseGuestPack(signedIn)) {
    patch({ slug, blocks })
  }
  return pack
}

export function sessionStore() {
  try {
    if (globalThis.sessionStorage) return globalThis.sessionStorage
  } catch {
    // Safari private mode / missing window
  }
  return defaultStorage()
}

export function guestPackMirrored(storage = sessionStore()) {
  try {
    return Boolean(storage.getItem(GUEST_MIRROR_KEY))
  } catch {
    return false
  }
}

export function markGuestPackMirrored(storage = sessionStore()) {
  try {
    storage.setItem(GUEST_MIRROR_KEY, "1")
  } catch {
    // Safari private mode / missing storage
  }
}

export function clearGuestPackMirrored(storage = sessionStore()) {
  try {
    storage.removeItem(GUEST_MIRROR_KEY)
  } catch {
    // Safari private mode / missing storage
  }
}

export function shouldPostGuestPack({ signedIn, mirrored, pack }) {
  return signedIn === true && !mirrored && packHasImportableNotes(pack)
}

export function applyImportResult({ imported } = {}) {
  return {
    clearPack: false,
    reload: false,
    mirrored: true,
    paintPack: Number(imported) > 0
  }
}

export function loadPack(storage = defaultStorage()) {
  try {
    const raw = storage.getItem(GUEST_PACK_KEY)
    if (!raw) return { notes: {} }
    const parsed = JSON.parse(raw)
    const notes = parsed?.notes && typeof parsed.notes === "object" && !Array.isArray(parsed.notes)
      ? parsed.notes
      : {}
    const pack = { notes }
    if (Array.isArray(parsed?.trail)) {
      pack.trail = parsed.trail.map((item) => String(item)).filter(Boolean).slice(0, 3)
    }
    if (parsed?.last_read) pack.last_read = String(parsed.last_read)
    if (!pack.trail?.length && pack.last_read) pack.trail = [ pack.last_read ]
    return pack
  } catch {
    return { notes: {} }
  }
}

export function writePack(pack, storage = defaultStorage()) {
  const payload = { notes: pack.notes || {} }
  const trail = Array.isArray(pack.trail) ? pack.trail.filter(Boolean).slice(0, 3) : []
  if (trail.length) payload.trail = trail
  if (pack.last_read) payload.last_read = pack.last_read
  storage.setItem(GUEST_PACK_KEY, JSON.stringify(payload))
  return pack
}

export function applyNoteToPack(pack, slug, blocks, now = new Date()) {
  const key = String(slug || "").trim()
  if (!key) return false
  const normalized = normalizeBlocks(blocks)
  if (emptyContent(normalized)) {
    if (!pack.notes[key]) return false
    delete pack.notes[key]
    return true
  }
  const existing = pack.notes[key]
  if (existing && sameBlocks(existing.blocks, normalized)) return false
  const iso = now.toISOString()
  pack.notes[key] = {
    slug: key,
    blocks: normalized,
    created_at: existing?.created_at || iso,
    updated_at: iso,
    bookmarked: existing?.bookmarked === true
  }
  return true
}

export function setNoteBookmarked(slug, bookmarked, storage = defaultStorage(), now = new Date()) {
  const key = String(slug || "").trim()
  const pack = loadPack(storage)
  const note = pack.notes[key]
  if (!note || emptyContent(note.blocks)) return pack
  const next = Boolean(bookmarked)
  if (note.bookmarked === next) return pack
  note.bookmarked = next
  note.updated_at = now.toISOString()
  writePack(pack, storage)
  return pack
}

export function upsertNote(slug, blocks, { storage = defaultStorage(), now = new Date() } = {}) {
  const pack = loadPack(storage)
  if (applyNoteToPack(pack, slug, blocks, now)) writePack(pack, storage)
  return pack
}

export function rememberRead(slug, storage = defaultStorage()) {
  const key = String(slug || "").trim()
  if (!key) return loadPack(storage)
  const pack = loadPack(storage)
  const trail = Array.isArray(pack.trail) ? pack.trail.filter(Boolean) : []
  if (pack.last_read && !trail.includes(pack.last_read)) trail.push(pack.last_read)
  const next = [ key, ...trail.filter((item) => item !== key) ].slice(0, 3)
  if (pack.last_read === key && JSON.stringify(pack.trail || []) === JSON.stringify(next)) return pack
  pack.trail = next
  pack.last_read = key
  writePack(pack, storage)
  return pack
}

export function setLastRead(slug, storage = defaultStorage()) {
  return rememberRead(slug, storage)
}

export function notesForChapter(chapterSlug, pack) {
  return Object.values(pack?.notes || {}).filter((note) => belongsToChapter(note.slug, chapterSlug))
}

export function previewText(blocks) {
  return normalizeBlocks(blocks)
    .map((block) => block.text)
    .filter((text) => text.trim())
    .join(" ")
    .trim()
}

export function utcDate(value) {
  if (value instanceof Date) return value
  return new Date(value)
}

export function dayLabel(date, today) {
  const day = utcDate(date)
  const now = utcDate(today)
  const dayKey = dateKey(day)
  const todayKey = dateKey(now)
  if (dayKey === todayKey) return "Today"
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  if (dayKey === dateKey(yesterday)) return "Yesterday"
  const weekday = WEEKDAYS[day.getUTCDay()]
  const rest = `${MONTHS[day.getUTCMonth()]} ${day.getUTCDate()}`
  if (day.getUTCFullYear() !== now.getUTCFullYear()) return `${weekday} · ${rest}, ${day.getUTCFullYear()}`
  return `${weekday} · ${rest}`
}

export function inboxSections(pack, { now = new Date() } = {}) {
  const notes = Object.values(pack?.notes || {})
    .filter((note) => !emptyContent(note.blocks))
  const bookmarked = notes
    .filter((note) => note.bookmarked)
    .sort((left, right) => utcDate(right.updated_at || right.created_at) - utcDate(left.updated_at || left.created_at))
  const rest = notes
    .filter((note) => !note.bookmarked)
    .sort((left, right) => utcDate(right.created_at) - utcDate(left.created_at))
  const sections = []
  if (bookmarked.length) {
    const groups = bookmarkGroups(bookmarked)
    sections.push({
      label: "Bookmarks",
      notes: groups.flatMap((group) => group.notes),
      groups,
      kind: "bookmarks"
    })
  }
  const grouped = new Map()
  for (const note of rest) {
    const key = dateKey(utcDate(note.created_at))
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(note)
  }
  for (const [, dayNotes] of grouped) {
    sections.push({
      label: dayLabel(utcDate(dayNotes[0].created_at), now),
      notes: dayNotes,
      kind: "day"
    })
  }
  return sections
}

function bookmarkGroups(notes) {
  const grouped = new Map()
  for (const note of notes) {
    const book = parseSlug(note.slug)?.book || ""
    if (!grouped.has(book)) grouped.set(book, [])
    grouped.get(book).push(note)
  }
  return [ ...grouped.entries() ]
    .map(([ book, groupNotes ]) => ({
      book,
      label: bookName(book) || book,
      notes: groupNotes
    }))
    .sort((left, right) => groupTime(right.notes) - groupTime(left.notes))
}

function groupTime(notes) {
  return Math.max(...notes.map((note) => utcDate(note.updated_at || note.created_at).getTime()))
}

function dateKey(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function sameBlocks(left, right) {
  return JSON.stringify(normalizeBlocks(left)) === JSON.stringify(normalizeBlocks(right))
}
