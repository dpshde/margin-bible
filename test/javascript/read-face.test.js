import assert from "node:assert/strict"
import { memoryStorage } from "../../app/javascript/lib/guest-pack.js"
import { FACE_KEY, applyFace, loadFace, parseFace, saveFace } from "../../app/javascript/lib/read-face.js"

{
  assert.equal(parseFace("deca"), "serif")
  assert.equal(parseFace("serif"), "serif")
  assert.equal(parseFace("lexend"), "serif")
  assert.equal(parseFace(null), "serif")
}

{
  const store = memoryStorage()
  assert.equal(loadFace(store), "serif")
  saveFace("deca", store)
  assert.equal(store.getItem(FACE_KEY), "serif")
  assert.equal(loadFace(store), "serif")
  const root = { dataset: {} }
  assert.equal(applyFace("deca", { storage: store, root }), "serif")
  assert.equal(root.dataset.face, "serif")
  assert.equal(applyFace("nope", { storage: store, root }), "serif")
  assert.equal(root.dataset.face, "serif")
}

console.log("read-face: ok")
