export function trayHasNoteContent(tray, isEmpty = defaultOutlinerEmpty) {
  if (!tray) return false
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
  if (!hasContent) return false
  if (collapsed) return false
  return expanding || selected
}

export function applyClearedNoteTray(tray) {
  if (!tray) return tray
  delete tray.dataset?.noteSlug
  tray.removeAttribute?.("data-note-slug")
  tray.hidden = true
  return tray
}

export function expandControlDisabled(hasNotes) {
  return !hasNotes
}

function defaultOutlinerEmpty(host) {
  const texts = host.querySelectorAll?.(".otext") || []
  return ![ ...texts ].some((el) => String(el.textContent || "").trim())
}
