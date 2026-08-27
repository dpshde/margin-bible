import assert from "node:assert/strict"
import {
  blocksToHtml,
  formatBookShare,
  formatChapterHtml,
  formatChapterShare,
  formatNoteHtml,
  formatNoteShare,
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
  ], 0, true)
  assert.deepEqual(lines, [ "- The Logos.", "  - Nested." ])
}

{
  const lines = noteLines([
    { indent: 0, text: "Plain.", bullet: false },
    { indent: 0, text: "Listed.", bullet: true }
  ], 0, true)
  assert.deepEqual(lines, [ "Plain.", "- Listed." ])
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
    "John 1:1\nIn the beginning was the Word.\n\n- The Logos.\n\nhttps://route.bible/jhn.1.1\n"
  )
}

{
  const bulleted = formatChapterShare({
    label: "John 1",
    chapterNote: [ { indent: 0, text: "Chapter thought" }, { indent: 1, text: "Nested thought" } ],
    verses: [
      {
        n: 1,
        heading: "The Beginning",
        text: "In the beginning was the Word.",
        notes: [ { blocks: [ { indent: 0, text: "The Logos." }, { indent: 1, text: "Nested." } ] } ]
      },
      { n: 2, heading: "", text: "He was with God in the beginning.", notes: [] }
    ],
    bullets: true
  })
  assert.match(bulleted, /^John 1\n\n- Chapter thought\n  - Nested thought\n\nThe Beginning\n\n1\. In the beginning was the Word\.\n- The Logos\.\n  - Nested\.\n\n2\. He was with God in the beginning\.\n$/)
}

{
  const text = formatBookShare({
    label: "John",
    chapters: [
      {
        label: "John 1",
        chapterNote: [ { indent: 0, text: "Prologue." }, { indent: 1, text: "The Word." } ],
        verses: [
          {
            n: 1,
            heading: "The Beginning",
            text: "In the beginning was the Word.",
            notes: [ { blocks: [ { indent: 0, text: "The Logos." }, { indent: 1, text: "Nested." } ] } ]
          }
        ]
      }
    ]
  })
  assert.match(text, /^John\n\nJohn 1\n\n- Prologue\.\n  - The Word\.\n\nThe Beginning\n\n1\. In the beginning was the Word\.\n- The Logos\.\n  - Nested\.\n$/)
}

{
  const md = formatNoteShare({
    label: "John 3:16",
    blocks: [
      { indent: 0, text: "Love [[jhn.3.16]]." },
      { indent: 1, text: "Nested." }
    ]
  })
  assert.equal(md, "John 3:16\n\n- Love [[jhn.3.16]].\n  - Nested.\n")
  assert.equal(
    formatNoteHtml({ label: "John 3:16", blocks: [ { indent: 0, text: "Love [[jhn.3.16]]." }, { indent: 1, text: "Nested." } ] }),
    '<p><strong>John 3:16</strong></p><ul><li>Love <a href="https://route.bible/jhn.3.16">John 3:16</a>.<ul><li>Nested.</li></ul></li></ul>'
  )
  assert.equal(
    blocksToHtml([ { indent: 0, text: "A" }, { indent: 0, text: "B" } ]),
    "<ul><li>A</li><li>B</li></ul>"
  )
  const chapterHtml = formatChapterHtml({
    label: "John 1",
    chapterNote: [ { indent: 0, text: "Prologue." } ],
    verses: [ { n: 1, heading: "The Beginning", text: "In the beginning.", notes: [ { blocks: [ { indent: 0, text: "Logos." } ] } ] } ]
  })
  assert.match(chapterHtml, /<p><strong>John 1<\/strong><\/p>/)
  assert.match(chapterHtml, /<ul><li>Prologue\.<\/li><\/ul>/)
  assert.match(chapterHtml, /<p><strong>The Beginning<\/strong><\/p>/)
  assert.match(chapterHtml, /<p>1\. In the beginning\.<\/p>/)
  assert.match(chapterHtml, /<ul><li>Logos\.<\/li><\/ul>/)

  const notesOnly = formatChapterShare({
    label: "John 1",
    chapterNote: [ { indent: 0, text: "Prologue." } ],
    verses: [
      {
        n: 1,
        heading: "The Beginning",
        text: "In the beginning was the Word.",
        notes: [ { blocks: [ { indent: 0, text: "The Logos." }, { indent: 1, text: "Nested." } ] } ]
      },
      { n: 2, heading: "", text: "He was with God in the beginning.", notes: [] }
    ],
    bullets: true,
    notesOnly: true,
    url: "https://route.bible/jhn.1"
  })
  assert.equal(
    notesOnly,
    "John 1\n\n- Prologue.\n\nJohn 1:1\n- The Logos.\n  - Nested.\n"
  )
  const notesHtml = formatChapterHtml({
    label: "John 1",
    chapterNote: [ { indent: 0, text: "Prologue." } ],
    verses: [
      { n: 1, text: "In the beginning.", notes: [ { blocks: [ { indent: 0, text: "Logos." } ] } ] },
      { n: 2, text: "He was with God.", notes: [] }
    ],
    notesOnly: true
  })
  assert.equal(
    notesHtml,
    "<p><strong>John 1</strong></p><ul><li>Prologue.</li></ul><p><strong>John 1:1</strong></p><ul><li>Logos.</li></ul>"
  )
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
