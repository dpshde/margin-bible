import assert from "node:assert/strict"
import {
  applyNoteToPack,
  dayLabel,
  emptyContent,
  GUEST_PACK_KEY,
  inboxSections,
  loadPack,
  memoryStorage,
  notesForChapter,
  persistNote,
  setLastRead,
  shouldUseGuestPack,
  upsertNote
} from "../../app/javascript/lib/guest-pack.js"
import {
  belongsToChapter,
  hrefForSlug,
  parseSlug,
  slugLabel
} from "../../app/javascript/lib/passage-span.js"

function storage() {
  return memoryStorage()
}

function blocks(text, id = "b_aa01") {
  return [{ id, indent: 0, text }]
}

{
  assert.equal(shouldUseGuestPack(false), true)
  assert.equal(shouldUseGuestPack(undefined), true)
  assert.equal(shouldUseGuestPack(true), false)
}

{
  const store = storage()
  const now = new Date("2026-08-25T12:00:00.000Z")
  upsertNote("jhn.1.16", blocks("The Word."), { storage: store, now })
  const pack = loadPack(store)
  assert.deepEqual(pack.notes["jhn.1.16"].blocks, blocks("The Word."))
  assert.equal(pack.notes["jhn.1.16"].created_at, now.toISOString())
  assert.equal(JSON.parse(store.getItem(GUEST_PACK_KEY)).notes["jhn.1.16"].slug, "jhn.1.16")
}

{
  const store = storage()
  const created = new Date("2026-08-25T12:00:00.000Z")
  const updated = new Date("2026-08-25T18:00:00.000Z")
  upsertNote("jhn.1.16", blocks("First."), { storage: store, now: created })
  upsertNote("jhn.1.16", blocks("Second."), { storage: store, now: updated })
  const note = loadPack(store).notes["jhn.1.16"]
  assert.equal(note.created_at, created.toISOString())
  assert.equal(note.updated_at, updated.toISOString())
  assert.equal(note.blocks[0].text, "Second.")
}

{
  const store = storage()
  upsertNote("jhn.1.16", blocks("Keep."), { storage: store })
  upsertNote("jhn.1.3-7", blocks("Range."), { storage: store })
  upsertNote("jhn.1", blocks("Chapter."), { storage: store })
  const pack = loadPack(store)
  assert.equal(Object.keys(pack.notes).sort().join(" "), "jhn.1 jhn.1.16 jhn.1.3-7")
}

{
  const store = storage()
  upsertNote("jhn.1.16", blocks("Gone."), { storage: store })
  upsertNote("jhn.1.16", [{ id: "b_empty", indent: 0, text: "   " }], { storage: store })
  assert.equal(emptyContent([{ text: "   " }]), true)
  assert.equal(loadPack(store).notes["jhn.1.16"], undefined)
}

{
  const store = storage()
  const first = upsertNote("jhn.1.16", blocks("Same."), { storage: store })
  const before = store.getItem(GUEST_PACK_KEY)
  const second = upsertNote("jhn.1.16", blocks("Same."), { storage: store, now: new Date("2026-08-26T00:00:00.000Z") })
  assert.equal(store.getItem(GUEST_PACK_KEY), before)
  assert.equal(second.notes["jhn.1.16"].updated_at, first.notes["jhn.1.16"].updated_at)
}

{
  const store = storage()
  upsertNote("jhn.1.16", blocks("A."), { storage: store })
  upsertNote("jhn.10.1", blocks("B."), { storage: store })
  upsertNote("jhn.1", blocks("C."), { storage: store })
  const chapter = notesForChapter("jhn.1", loadPack(store)).map((note) => note.slug).sort()
  assert.deepEqual(chapter, ["jhn.1", "jhn.1.16"])
  assert.equal(belongsToChapter("jhn.10.1", "jhn.1"), false)
  assert.equal(belongsToChapter("jhn.1.16", "jhn.1"), true)
}

{
  const store = storage()
  const pack = setLastRead("jhn.1", store)
  assert.equal(pack.last_read, "jhn.1")
  const again = store.getItem(GUEST_PACK_KEY)
  setLastRead("jhn.1", store)
  assert.equal(store.getItem(GUEST_PACK_KEY), again)
}

{
  const today = new Date("2026-08-25T12:00:00.000Z")
  assert.equal(dayLabel(today, today), "Today")
  assert.equal(dayLabel(new Date("2026-08-24T09:00:00.000Z"), today), "Yesterday")
  assert.equal(dayLabel(new Date("2026-08-04T09:00:00.000Z"), today), "Tuesday · Aug 4")
  assert.equal(dayLabel(new Date("2025-08-04T09:00:00.000Z"), today), "Monday · Aug 4, 2025")
}

{
  const pack = { notes: {} }
  applyNoteToPack(pack, "jhn.3", blocks("Chapter", "c"), new Date("2026-08-25T18:00:00.000Z"))
  applyNoteToPack(pack, "jhn.3.16-18", blocks("Range", "b"), new Date("2026-08-25T15:00:00.000Z"))
  applyNoteToPack(pack, "jhn.3.16", blocks("Old", "a"), new Date("2026-08-04T09:00:00.000Z"))
  applyNoteToPack(pack, "jhn.1.1", blocks("Updated later", "d"), new Date("2026-08-04T08:00:00.000Z"))
  const sections = inboxSections(pack, { now: new Date("2026-08-25T20:00:00.000Z") })
  assert.deepEqual(sections.map((section) => section.label), ["Today", "Tuesday · Aug 4"])
  assert.deepEqual(sections[0].notes.map((note) => note.slug), ["jhn.3", "jhn.3.16-18"])
  assert.deepEqual(sections[1].notes.map((note) => note.slug), ["jhn.3.16", "jhn.1.1"])
}

{
  assert.equal(slugLabel("jhn.1.16"), "John 1:16")
  assert.equal(slugLabel("jhn.1.3-7"), "John 1:3–7")
  assert.equal(slugLabel("jhn.1"), "John 1")
  assert.equal(hrefForSlug("jhn.1"), "/jhn.1?chapter_note=1")
  assert.equal(hrefForSlug("jhn.1.16"), "/jhn.1.16")
  assert.equal(hrefForSlug("jhn.1.3-7"), "/jhn.1.3-7")
  assert.equal(parseSlug("jhn.1.3-7").kind, "range")
}

{
  const store = storage()
  let patched = 0
  persistNote({
    signedIn: true,
    slug: "jhn.1.16",
    blocks: blocks("Server."),
    storage: store,
    patch: ({ slug }) => {
      patched += 1
      assert.equal(slug, "jhn.1.16")
    }
  })
  assert.equal(patched, 1)
  assert.deepEqual(loadPack(store).notes, {})

  persistNote({
    signedIn: false,
    slug: "jhn.1.16",
    blocks: blocks("Local."),
    storage: store,
    patch: () => {
      throw new Error("guests must not PATCH")
    }
  })
  assert.equal(loadPack(store).notes["jhn.1.16"].blocks[0].text, "Local.")
}

console.log("guest-pack: ok")
