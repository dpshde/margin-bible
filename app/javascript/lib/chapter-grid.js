export function chapterGridIsOpen(grid) {
  return Boolean(grid && !grid.hidden)
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
