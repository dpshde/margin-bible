import assert from "node:assert/strict"
import { verseNodes, verseTrayHost } from "../../app/javascript/lib/verse-host.js"

function node({ id = "", verse, tray = false }) {
  return {
    id,
    dataset: { verse: String(verse) },
    querySelector(sel) {
      if (sel === ".note-tray") return tray ? { composer: true } : null
      return null
    }
  }
}

function root(nodes) {
  return {
    querySelector(sel) {
      if (sel.startsWith("#")) return nodes.find((item) => item.id === sel.slice(1)) || null
      return null
    },
    querySelectorAll(sel) {
      const match = String(sel).match(/\[data-verse="(\d+)"\]/)
      if (!match) return []
      return nodes.filter((item) => item.dataset.verse === match[1])
    }
  }
}

const v5a = node({ id: "v5", verse: 5 })
const v5b = node({ verse: 5, tray: true })
const v6 = node({ id: "v6", verse: 6, tray: true })
const chapter = root([ v5a, v5b, v6 ])

assert.equal(verseNodes(chapter, 5).length, 2)
assert.equal(verseTrayHost(chapter, 5), v5b)
assert.notEqual(verseTrayHost(chapter, 5), v5a)
assert.equal(verseTrayHost(chapter, 6), v6)
assert.equal(verseTrayHost(chapter, 99), null)

console.log("verse-host: ok")
