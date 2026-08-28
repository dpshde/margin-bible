export function trayHasNoteContent(tray, isEmpty = defaultOutlinerEmpty) {
  if (!tray) return false
  if (tray.querySelector?.(".tray-bookmark.is-on")) return true
  if (tray.querySelector?.(".att-chip")) return true
  const host = tray.querySelector?.(".outliner")
  if (!host) return false
  return !isEmpty(host)
}

export function shouldShowExpandedTray({
  expanding = false,
  selected = false,
  collapsed = false,
  hasContent = false
} = {}) {
  if (collapsed) return false
  if (selected) return true
  if (!hasContent) return false
  return expanding
}

export function applyClearedNoteTray(tray) {
  if (!tray) return tray
  delete tray.dataset?.noteSlug
  tray.removeAttribute?.("data-note-slug")
  tray.hidden = true
  return tray
}

export function shouldHideClearedTray({ empty = false, selected = false } = {}) {
  return empty && !selected
}

export function expandControlDisabled(hasNotes) {
  return !hasNotes
}

function defaultOutlinerEmpty(host) {
  const texts = host.querySelectorAll?.(".otext") || []
  return ![ ...texts ].some((el) => String(el.textContent || "").trim())
}
