import assert from "node:assert/strict"
import { memoryStorage } from "../../app/javascript/lib/guest-pack.js"
import {
  HIDE_VERSE_NUMS_KEY,
  loadHideVerseNums,
  saveHideVerseNums
} from "../../app/javascript/lib/reader-prefs.js"

{
  const store = memoryStorage()
  assert.equal(loadHideVerseNums(store), false)
  saveHideVerseNums(true, store)
  assert.equal(store.getItem(HIDE_VERSE_NUMS_KEY), "1")
  assert.equal(loadHideVerseNums(store), true)
  saveHideVerseNums(false, store)
  assert.equal(store.getItem(HIDE_VERSE_NUMS_KEY), null)
  assert.equal(loadHideVerseNums(store), false)
}
