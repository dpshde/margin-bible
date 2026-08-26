import { belongsToChapter } from "./passage-span.js"

export const GUEST_PACK_KEY = "margin.guest"

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
      text: String(block?.text || "")
    }))
    : []
}

export function shouldUseGuestPack(signedIn) {
  return signedIn !== true
}

export function persistNote({ signedIn, slug, blocks, storage, now, patch }) {
  if (!shouldUseGuestPack(signedIn)) {
    return patch({ slug, blocks })
  }
  return upsertNote(slug, blocks, { storage, now })
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
    if (parsed?.last_read) pack.last_read = String(parsed.last_read)
    return pack
  } catch {
    return { notes: {} }
  }
}

export function writePack(pack, storage = defaultStorage()) {
  const payload = { notes: pack.notes || {} }
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
    updated_at: iso
  }
  return true
}

export function upsertNote(slug, blocks, { storage = defaultStorage(), now = new Date() } = {}) {
  const pack = loadPack(storage)
  if (applyNoteToPack(pack, slug, blocks, now)) writePack(pack, storage)
  return pack
}

export function setLastRead(slug, storage = defaultStorage()) {
  const key = String(slug || "").trim()
  if (!key) return loadPack(storage)
  const pack = loadPack(storage)
  if (pack.last_read === key) return pack
  pack.last_read = key
  writePack(pack, storage)
  return pack
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
    .sort((left, right) => utcDate(right.created_at) - utcDate(left.created_at))
  const grouped = new Map()
  for (const note of notes) {
    const key = dateKey(utcDate(note.created_at))
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(note)
  }
  return [...grouped.entries()].map(([, dayNotes]) => ({
    label: dayLabel(utcDate(dayNotes[0].created_at), now),
    notes: dayNotes
  }))
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
