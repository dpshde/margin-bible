export function chapterGridIsOpen(grid) {
  return Boolean(grid && !grid.hidden)
}

export function testamentGroups(codes) {
  const list = Array.isArray(codes) ? codes : []
  const i = list.indexOf("MAT")
  if (i < 0) return { ot: list, nt: [] }
  return { ot: list.slice(0, i), nt: list.slice(i) }
}

export function chapterPath(book, n) {
  return `/${String(book).toLowerCase()}.${n}`
}

export function chapterCellHtml(book, n, { currentBook, currentChapter } = {}) {
  const current = book === currentBook && Number(n) === Number(currentChapter)
  const attrs = current ? " is-current" : ""
  const aria = current ? ' aria-current="page"' : ""
  return `<a href="${chapterPath(book, n)}" class="chapter-grid-cell${attrs}"${aria} data-action="click->reader#pickChapter">${n}</a>`
}

export function chapterCellsHtml(book, count, current = {}) {
  const total = Number(count) || 0
  let html = ""
  for (let n = 1; n <= total; n += 1) html += chapterCellHtml(book, n, current)
  return html
}

export function applyChapterGridOpen(grid, title, open) {
  if (!grid) return false
  const next = Boolean(open)
  grid.hidden = !next
  grid.classList.toggle("is-open", next)
  title?.setAttribute("aria-expanded", next ? "true" : "false")
  return next
}

export function toggleChapterGridOpen(grid, title) {
  return applyChapterGridOpen(grid, title, !chapterGridIsOpen(grid))
}
