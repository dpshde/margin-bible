import assert from "node:assert/strict"
import {
  formatChapterShare,
  formatVerseShare,
  noteLines,
  notesForVerse,
  wikiToPlain
} from "../../app/javascript/lib/share-text.js"

{
  assert.equal(wikiToPlain("See [[jhn.1.6|John]] here"), "See John here")
}

{
  const lines = noteLines([
    { indent: 0, text: "The Logos." },
    { indent: 1, text: "Nested." },
    { indent: 0, text: "   " }
  ], 1)
  assert.deepEqual(lines, [ "  The Logos.", "    Nested." ])
}

{
  const text = formatVerseShare({
    label: "John 1:1",
    text: "In the beginning was the Word.",
    notes: [ { blocks: [ { indent: 0, text: "The Logos." } ] } ],
    url: "https://route.bible/jhn.1.1"
  })
  assert.equal(
    text,
    "John 1:1\nIn the beginning was the Word.\n\n  The Logos.\n\nhttps://route.bible/jhn.1.1\n"
  )
}

{
  const text = formatChapterShare({
    label: "John 1",
    chapterNote: [ { indent: 0, text: "Chapter thought" } ],
    verses: [
      {
        n: 1,
        heading: "The Beginning",
        text: "In the beginning was the Word.",
        notes: [ { blocks: [ { indent: 0, text: "The Logos." }, { indent: 1, text: "Nested." } ] } ]
      },
      { n: 2, heading: "", text: "He was with God in the beginning.", notes: [] }
    ]
  })
  assert.match(text, /^John 1\n\nChapter thought\n\nThe Beginning\n\n1\. In the beginning was the Word\.\n  The Logos\.\n    Nested\.\n\n2\. He was with God in the beginning\.\n$/)
}

{
  const notes = [
    { slug: "jhn.1.1", blocks: [ { indent: 0, text: "Exact" } ] },
    { slug: "jhn.1.1-2", blocks: [ { indent: 0, text: "Range" } ] }
  ]
  assert.equal(notesForVerse(notes, "jhn.1", 1).length, 1)
  assert.equal(notesForVerse(notes, "jhn.1", 1)[0].blocks[0].text, "Exact")
  assert.equal(notesForVerse(notes, "jhn.1", 2)[0].blocks[0].text, "Range")
}
