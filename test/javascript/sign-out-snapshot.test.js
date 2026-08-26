import assert from "node:assert/strict"
import { loadPack, memoryStorage } from "../../app/javascript/lib/guest-pack.js"
import {
  isSignOutForm,
  snapshotNotesIntoPack
} from "../../app/javascript/lib/sign-out-snapshot.js"

{
  assert.equal(isSignOutForm(null), false)
  assert.equal(isSignOutForm({
    method: "post",
    querySelector: () => ({ value: "delete" }),
    getAttribute: () => "/session"
  }), true)
  assert.equal(isSignOutForm({
    method: "post",
    querySelector: () => ({ value: "delete" }),
    getAttribute: () => "/passkeys/1"
  }), false)
  assert.equal(isSignOutForm({
    method: "post",
    querySelector: () => null,
    getAttribute: () => "/session"
  }), false)
}

{
  const store = memoryStorage()
  const now = new Date("2026-08-26T12:00:00.000Z")
  const pack = snapshotNotesIntoPack([
    { slug: "heb.11.1", blocks: [ { id: "b_faith", indent: 0, text: "Faith is the assurance.", bullet: true } ] },
    { slug: "jhn.1.1", blocks: [ { id: "b_mark", indent: 0, text: "Logos.", bullet: true } ], bookmarked: true }
  ], store, now)
  assert.equal(pack.notes["heb.11.1"].blocks[0].text, "Faith is the assurance.")
  assert.equal(pack.notes["heb.11.1"].blocks[0].indent, 0)
  assert.equal(loadPack(store).notes["jhn.1.1"].bookmarked, true)
}

console.log("sign-out-snapshot: ok")
