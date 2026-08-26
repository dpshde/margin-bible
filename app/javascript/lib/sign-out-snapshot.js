import {
  applyNoteToPack,
  clearGuestPackMirrored,
  loadPack,
  setNoteBookmarked,
  writePack
} from "./guest-pack.js"

export function isSignOutForm(form) {
  if (!form || typeof form !== "object") return false
  const methodInput = form.querySelector?.('input[name="_method"]')
  const method = String(methodInput?.value || form.method || "").toLowerCase()
  if (method !== "delete") return false
  const action = String(form.getAttribute?.("action") || form.action || "")
  return /\/session\/?$/.test(action)
}

export function collectPageNotes(root = globalThis.document) {
  const notes = []
  const dump = root?.querySelector?.("#inbox-pack-mirror")
  if (dump?.textContent) {
    try {
      const parsed = JSON.parse(dump.textContent)
      if (Array.isArray(parsed)) notes.push(...parsed)
    } catch {
      // Ignore a broken mirror dump.
    }
  }
  root?.querySelectorAll?.(".outliner").forEach((host) => {
    const slug = host.dataset?.slug
    if (!slug) return
    const blocks = [ ...host.querySelectorAll(".oblock") ].map((row) => ({
      id: row.dataset.blockId,
      indent: Number.parseInt(row.style.getPropertyValue("--depth") || "0", 10) || 0,
      text: row.querySelector(".otext")?.textContent || "",
      bullet: row.dataset.bullet !== "0"
    }))
    const bookmarked = host.closest(".note-tray, .chapter-tray")
      ?.querySelector(".tray-bookmark")
      ?.classList.contains("is-on")
    notes.push({ slug, blocks, bookmarked })
  })
  return notes
}

export function snapshotNotesIntoPack(notes, storage, now = new Date()) {
  const pack = loadPack(storage)
  let changed = false
  for (const note of notes || []) {
    if (applyNoteToPack(pack, note.slug, note.blocks, now)) changed = true
  }
  if (changed) writePack(pack, storage)
  for (const note of notes || []) {
    if (note.bookmarked) setNoteBookmarked(note.slug, true, storage, now)
  }
  return loadPack(storage)
}

export function snapshotGuestPackFromPage(root = globalThis.document, storage) {
  return snapshotNotesIntoPack(collectPageNotes(root), storage)
}

export function markSigningOut() {
  globalThis.__marginSigningOut = true
}

export function installSignOutSnapshot(root = globalThis.document) {
  if (!root?.addEventListener || root.__marginSignOutSnapshot) return
  root.__marginSignOutSnapshot = true
  root.addEventListener("submit", (event) => {
    if (!isSignOutForm(event.target)) return
    snapshotGuestPackFromPage(root)
    clearGuestPackMirrored()
    markSigningOut()
  })
}
