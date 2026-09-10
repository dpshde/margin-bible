import assert from "node:assert/strict"
import {
  SNAPSHOT_FORMAT,
  SNAPSHOT_VERSION,
  guestSnapshot,
  noteFromGuest,
  osisFromParsed,
  snapshotFilename
} from "../../app/javascript/lib/library-snapshot.js"
import { parseSlug } from "../../app/javascript/lib/passage-span.js"

{
  assert.equal(SNAPSHOT_FORMAT, "margin.library-snapshot")
  assert.equal(SNAPSHOT_VERSION, 1)
  assert.equal(snapshotFilename(new Date("2026-09-10T15:04:05Z")), "margin-notes-20260910.json")
}

{
  assert.equal(osisFromParsed(parseSlug("jhn.1"), "jhn.1"), "JHN.1")
  assert.equal(osisFromParsed(parseSlug("jhn.1.1"), "jhn.1.1"), "JHN.1.1")
  assert.equal(osisFromParsed(parseSlug("jhn.3.16-18"), "jhn.3.16-18"), "JHN.3.16-18")
}

{
  const row = noteFromGuest({
    slug: "jhn.1.1",
    blocks: [{ id: "b_word", indent: 0, text: "Logos.", bullet: true }],
    attachments: [{ id: "att_abcd", kind: "xref", slug: "jhn.1.6" }],
    bookmarked: true,
    created_at: "2026-09-10T12:00:00.000Z",
    updated_at: "2026-09-10T12:00:00.000Z"
  })
  assert.equal(row.osis, "JHN.1.1")
  assert.equal(row.kind, "verse")
  assert.equal(row.book, "JHN")
  assert.equal(row.chapter, 1)
  assert.equal(row.verse_start, 1)
  assert.equal(row.verse_end, 1)
  assert.equal(row.bookmarked, true)
  assert.equal(row.blocks[0].text, "Logos.")
}

{
  const now = new Date("2026-09-10T15:04:05.000Z")
  const snapshot = guestSnapshot({
    last_read: "heb.11",
    trail: ["heb.11", "jhn.1"],
    notes: {
      "jhn.1.1": {
        slug: "jhn.1.1",
        blocks: [{ id: "b_word", indent: 0, text: "Logos.", bullet: true }],
        created_at: "2026-09-09T12:00:00.000Z",
        updated_at: "2026-09-09T12:00:00.000Z"
      }
    }
  }, now)
  assert.equal(snapshot.format, SNAPSHOT_FORMAT)
  assert.equal(snapshot.version, 1)
  assert.equal(snapshot.exported_at, now.toISOString())
  assert.equal(snapshot.library.last_read_slug, "heb.11")
  assert.deepEqual(snapshot.library.read_trail, ["heb.11", "jhn.1"])
  assert.equal(snapshot.notes.length, 1)
  assert.equal(snapshot.notes[0].slug, "jhn.1.1")
}

console.log("library-snapshot: ok")
