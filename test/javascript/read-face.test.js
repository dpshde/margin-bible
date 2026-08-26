import assert from "node:assert/strict"
import { memoryStorage } from "../../app/javascript/lib/guest-pack.js"
import { FACE_KEY, applyFace, loadFace, parseFace, saveFace } from "../../app/javascript/lib/read-face.js"

{
  assert.equal(parseFace("deca"), "deca")
  assert.equal(parseFace("serif"), "serif")
  assert.equal(parseFace("lexend"), "serif")
  assert.equal(parseFace(null), "serif")
}

{
  const store = memoryStorage()
  assert.equal(loadFace(store), "serif")
  saveFace("deca", store)
  assert.equal(store.getItem(FACE_KEY), "deca")
  assert.equal(loadFace(store), "deca")
  const root = { dataset: {} }
  assert.equal(applyFace("deca", { storage: store, root }), "deca")
  assert.equal(root.dataset.face, "deca")
  assert.equal(applyFace("nope", { storage: store, root }), "serif")
  assert.equal(root.dataset.face, "serif")
}

console.log("read-face: ok")
