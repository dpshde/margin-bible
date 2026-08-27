import assert from "node:assert/strict"
import {
  applyContinueLink,
  continueSlugFromPack,
  HOUSE_SLUG,
  playContinueHaptic
} from "../../app/javascript/lib/inbox-continue.js"

{
  assert.equal(HOUSE_SLUG, "jhn.1")
  assert.equal(continueSlugFromPack({}), "jhn.1")
  assert.equal(continueSlugFromPack({ notes: {} }), "jhn.1")
  assert.equal(continueSlugFromPack({ last_read: "heb.11" }), "heb.11")
  assert.equal(continueSlugFromPack({ trail: [ "rom.8" ] }), "rom.8")
  assert.equal(continueSlugFromPack({ last_read: "jhn.3.16", trail: [ "rom.8" ] }), "jhn.3.16")
}

{
  const link = { href: "/jhn.1", title: "John 1" }
  applyContinueLink(link, { last_read: "heb.11" }, { labelFor: (slug) => slug === "heb.11" ? "Hebrews 11" : slug })
  assert.equal(link.href, "/heb.11")
  assert.equal(link.title, "Hebrews 11")
}

{
  const link = { href: "/jhn.1", title: "John 1" }
  applyContinueLink(link, { trail: [ "rom.8" ] }, { labelFor: () => "Romans 8" })
  assert.equal(link.href, "/rom.8")
  assert.equal(link.title, "Romans 8")
}

{
  const link = { href: "/jhn.1", title: "John 1" }
  applyContinueLink(link, {})
  assert.equal(link.href, "/jhn.1")
  assert.equal(link.title, "John 1")
}

{
  const calls = []
  globalThis.playHaptic = (kind) => calls.push(kind)
  playContinueHaptic()
  assert.deepEqual(calls, [ "nudge" ])
  delete globalThis.playHaptic
  playContinueHaptic()
  assert.deepEqual(calls, [ "nudge" ])
}
