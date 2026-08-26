import assert from "node:assert/strict"
import { canGo, insertTextFor, jumpState, passageContext } from "../../app/javascript/lib/jump-suggest.js"

{
  const state = jumpState("de")
  assert.equal(state.hits[0].label, "Deuteronomy")
  assert.equal(state.hint, null)
  assert.equal(insertTextFor(state.hits[0]), "Deuteronomy ")
}

{
  const state = jumpState("Deuteronomy ")
  assert.equal(state.hits.length, 0)
  assert.equal(state.hint, "34 chapters")
  assert.equal(canGo("Deuteronomy "), false)
}

{
  const state = jumpState("Deuteronomy 3")
  assert.equal(state.hits[0].kind, "chapter")
  assert.equal(state.hint, "29 verses")
  assert.equal(canGo("Deuteronomy 3"), true)
  assert.equal(insertTextFor(state.hits[0]), "Deuteronomy 3")
}

{
  const state = jumpState("Deuteronomy 3:16")
  assert.equal(state.hint, null)
  assert.equal(canGo("Deuteronomy 3:16"), true)
}

{
  assert.deepEqual(passageContext("deut"), { book: "DEU" })
  assert.equal(passageContext("Deuteronomy 3").chapter, 3)
  assert.equal(passageContext("Deuteronomy 3:2").verse, 2)
}
