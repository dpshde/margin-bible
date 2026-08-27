import assert from "node:assert/strict"
import { hrefForXref, parseXrefHref, sameChapterSlug, xrefKeepTarget } from "../../app/javascript/lib/xref-peek.js"

assert.equal(hrefForXref("jhn.3.16"), "/jhn.3.16?xref=1")
assert.equal(hrefForXref("jhn.1.3-7"), "/jhn.1.3-7?xref=1")
assert.equal(hrefForXref("jhn.1"), "/jhn.1")

{
  const parsed = parseXrefHref("/mat.4.18-22?xref=1")
  assert.equal(parsed.slug, "mat.4.18-22")
  assert.equal(parsed.kind, "range")
  assert.equal(parsed.verseStart, 18)
  assert.equal(parsed.verseEnd, 22)
  assert.equal(sameChapterSlug(parsed, "mat.4"), true)
  assert.equal(sameChapterSlug(parsed, "mat.5"), false)
}

{
  const chapter = parseXrefHref("/jhn.1")
  assert.equal(chapter.kind, "chapter")
  assert.equal(hrefForXref(chapter.slug), "/jhn.1")
}

{
  const press = { nodeType: 1, closest: (sel) => sel.includes(".verse-press") ? {} : null }
  const wiki = { nodeType: 1, closest: (sel) => sel.includes("a.wiki") ? {} : null }
  const chrome = { nodeType: 1, closest: () => null }
  assert.equal(xrefKeepTarget(press), true)
  assert.equal(xrefKeepTarget(wiki), true)
  assert.equal(xrefKeepTarget(chrome), false)
}

console.log("xref-peek: ok")
