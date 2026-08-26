import assert from "node:assert/strict"
import { memoryStorage } from "../../app/javascript/lib/guest-pack.js"
import {
  PAPER,
  THEME_KEY,
  applyTheme,
  loadTheme,
  nextTheme,
  parseTheme,
  resolveTheme,
  saveTheme
} from "../../app/javascript/lib/theme.js"

{
  assert.equal(parseTheme("dark"), "dark")
  assert.equal(parseTheme("system"), "system")
  assert.equal(parseTheme("nope"), "light")
  assert.equal(parseTheme(null), "light")
  assert.equal(resolveTheme("light", true), "light")
  assert.equal(resolveTheme("dark", false), "dark")
  assert.equal(resolveTheme("system", true), "dark")
  assert.equal(resolveTheme("system", false), "light")
  assert.equal(nextTheme("light"), "system")
  assert.equal(nextTheme("system"), "dark")
  assert.equal(nextTheme("dark"), "light")
}

{
  const store = memoryStorage()
  assert.equal(loadTheme(store), "light")
  saveTheme("dark", store)
  assert.equal(store.getItem(THEME_KEY), "dark")
  assert.equal(loadTheme(store), "dark")
  const root = { dataset: {}, style: {} }
  const applied = applyTheme("system", { storage: store, root })
  assert.equal(applied.pref, "system")
  assert.equal(root.dataset.theme, "system")
  assert.equal(PAPER.light, "#f6f5f2")
  assert.equal(PAPER.dark, "#121211")
}

console.log("theme: ok")
