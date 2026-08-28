import assert from "node:assert/strict"
import {
  addAttachment,
  attachmentHref,
  emptyAttachments,
  mergeParsedXrefs,
  noteIsEmpty,
  normalizeAttachments,
  parseAttachmentInput,
  parsedXrefsFromBlocks,
  removeAttachment
} from "../../app/javascript/lib/note-attachments.js"

{
  const xref = parseAttachmentInput("John 3:16")
  assert.equal(xref.kind, "xref")
  assert.equal(xref.slug, "jhn.3.16")
  assert.equal(xref.title, "John 3:16")
  assert.equal(attachmentHref(xref), "/jhn.3.16?xref=1")
}

{
  const fromRoute = parseAttachmentInput("https://route.bible/rom.8.28")
  assert.equal(fromRoute.kind, "xref")
  assert.equal(fromRoute.slug, "rom.8.28")
}

{
  const url = parseAttachmentInput("https://example.com/essay")
  assert.equal(url.kind, "url")
  assert.equal(url.url, "https://example.com/essay")
  assert.equal(url.title, "example.com")
  assert.equal(attachmentHref(url), "https://example.com/essay")
}

{
  assert.equal(parseAttachmentInput("John"), null)
  assert.equal(parseAttachmentInput("not a link"), null)
}

{
  const { list, added } = addAttachment([], "John 1:6")
  assert.equal(list.length, 1)
  assert.equal(added.slug, "jhn.1.6")
  const again = addAttachment(list, "jhn.1.6")
  assert.equal(again.list.length, 1)
  assert.equal(again.added, null)
  const withUrl = addAttachment(list, "https://example.com")
  assert.equal(withUrl.list.length, 2)
  const trimmed = removeAttachment(withUrl.list, withUrl.list[0].id)
  assert.equal(trimmed.length, 1)
  assert.equal(trimmed[0].kind, "url")
}

{
  assert.equal(noteIsEmpty([ { text: "  " } ], []), true)
  assert.equal(noteIsEmpty([ { text: "  " } ], [ { kind: "xref", slug: "jhn.1.6" } ]), false)
  assert.equal(emptyAttachments([]), true)
  assert.equal(normalizeAttachments([ { kind: "xref", slug: "John 3:16" } ])[0].slug, "jhn.3.16")
}

{
  const found = parsedXrefsFromBlocks([
    { text: "See John 3:16 and [[jhn.1.6|John]] plus `Romans 8:28`" }
  ])
  assert.deepEqual(found.map((row) => row.slug), [ "jhn.3.16", "jhn.1.6" ])
  const { list, added } = mergeParsedXrefs([ { kind: "xref", slug: "jhn.3.16" } ], [
    { text: "See John 3:16 and John 1:6" }
  ])
  assert.equal(list.length, 2)
  assert.equal(added.length, 1)
  assert.equal(added[0].slug, "jhn.1.6")
}

{
  const first = mergeParsedXrefs([], [ { text: "See John 3:16" } ])
  assert.equal(first.list[0].slug, "jhn.3.16")
  assert.equal(first.list[0].source, "scan")
  const renamed = mergeParsedXrefs(first.list, [ { text: "See John 3:17 instead" } ])
  assert.equal(renamed.list.length, 1)
  assert.equal(renamed.list[0].slug, "jhn.3.17")
  assert.equal(renamed.added[0].slug, "jhn.3.17")
  assert.equal(renamed.changed, true)
  const cleared = mergeParsedXrefs(renamed.list, [ { text: "No refs here" } ])
  assert.equal(cleared.list.length, 0)
  const leftover = mergeParsedXrefs(
    [ { kind: "xref", slug: "rom.5.3-6" }, { kind: "xref", slug: "rom.5.3-5" } ],
    [ { text: "Romans 5:3-5" } ]
  )
  assert.deepEqual(leftover.list.map((row) => row.slug), [ "rom.5.3-5" ])
  assert.equal(leftover.list[0].source, "scan")
  const manuals = mergeParsedXrefs(
    [ { kind: "xref", slug: "rom.8.28", source: "manual" }, { kind: "url", url: "https://example.com" } ],
    [ { text: "See John 3:16" } ]
  )
  assert.deepEqual(manuals.list.map((row) => row.kind + ":" + (row.slug || row.url)).sort(), [
    "url:https://example.com/",
    "xref:jhn.3.16",
    "xref:rom.8.28"
  ])
}

console.log("note-attachments: ok")
