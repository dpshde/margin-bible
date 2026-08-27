export function paneIsOpen(paneName, openName) {
  return paneName === (openName || "root")
}

export function shouldCloseDockMenu(item) {
  if (!item) return false
  if (item.tagName === "A") return true
  const action = item.getAttribute?.("data-action") || ""
  return action.includes("reader#")
}
