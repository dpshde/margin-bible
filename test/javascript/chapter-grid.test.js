import assert from "node:assert/strict"
import {
  applyChapterGridOpen,
  chapterGridIsOpen,
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

console.log("chapter-grid: ok")
