import { defaultStorage } from "./guest-pack.js"

export const HIDE_VERSE_NUMS_KEY = "margin.hideVerseNums"

export function loadHideVerseNums(storage = defaultStorage()) {
  try {
    return storage.getItem(HIDE_VERSE_NUMS_KEY) === "1"
  } catch {
    return false
  }
}

export function saveHideVerseNums(hidden, storage = defaultStorage()) {
  try {
    if (hidden) storage.setItem(HIDE_VERSE_NUMS_KEY, "1")
    else storage.removeItem(HIDE_VERSE_NUMS_KEY)
  } catch {
    // Safari private mode / missing storage
  }
}
