import assert from "node:assert/strict"
import {
  applyChapterGridOpen,
  chapterCellHtml,
  chapterCellsHtml,
  chapterGridIsOpen,
  chapterPath,
  testamentGroups,
  toggleChapterGridOpen
} from "../../app/javascript/lib/chapter-grid.js"

function fakeGrid(hidden = true) {
  const classes = new Set()
  return {
    hidden,
    classList: {
      contains: (name) => classes.has(name),
      toggle(name, on) {
        if (on) classes.add(name)
        else classes.delete(name)
      }
    }
  }
}

function fakeTitle() {
  const attrs = { "aria-expanded": "false" }
  return {
    attrs,
    setAttribute(name, value) {
      attrs[name] = value
    }
  }
}

{
  const grid = fakeGrid(true)
  const title = fakeTitle()
  assert.equal(chapterGridIsOpen(grid), false)
  assert.equal(toggleChapterGridOpen(grid, title), true)
  assert.equal(chapterGridIsOpen(grid), true)
  assert.equal(grid.hidden, false)
  assert.equal(grid.classList.contains("is-open"), true)
  assert.equal(title.attrs["aria-expanded"], "true")
}

{
  const grid = fakeGrid(false)
  grid.classList.toggle("is-open", true)
  const title = fakeTitle()
  title.setAttribute("aria-expanded", "true")
  assert.equal(toggleChapterGridOpen(grid, title), false)
  assert.equal(chapterGridIsOpen(grid), false)
  assert.equal(title.attrs["aria-expanded"], "false")
}

{
  const title = fakeTitle()
  assert.equal(applyChapterGridOpen(null, title, true), false)
  assert.equal(title.attrs["aria-expanded"], "false")
}

{
  const groups = testamentGroups(["GEN", "MAL", "MAT", "REV"])
  assert.deepEqual(groups.ot, ["GEN", "MAL"])
  assert.deepEqual(groups.nt, ["MAT", "REV"])
  assert.equal(chapterPath("JHN", 2), "/jhn.2")
  assert.equal(chapterPath("MAT", 3), "/mat.3")
  assert.match(chapterCellHtml("JHN", 1, { currentBook: "JHN", currentChapter: 1 }), /is-current/)
  assert.match(chapterCellHtml("JHN", 1, { currentBook: "JHN", currentChapter: 1 }), /aria-current="page"/)
  assert.doesNotMatch(chapterCellHtml("MAT", 3, { currentBook: "JHN", currentChapter: 1 }), /is-current/)
  const html = chapterCellsHtml("JHN", 3, { currentBook: "JHN", currentChapter: 1 })
  assert.match(html, /href="\/jhn\.1"/)
  assert.match(html, /href="\/jhn\.3"/)
  assert.equal((html.match(/chapter-grid-cell/g) || []).length, 3)
}

console.log("chapter-grid: ok")
