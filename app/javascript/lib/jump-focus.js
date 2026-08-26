export function isJumpTypingTarget(element) {
  if (!element) return false
  const el = element.nodeType === 1 ? element : element.parentElement
  if (!el) return false
  if (el.matches?.("input, textarea, select, .otext, .outliner")) return true
  if (el.isContentEditable) return true
  return Boolean(
    el.closest?.("input, textarea, select, [contenteditable='true'], [contenteditable=''], .otext, .outliner")
  )
}

export function isJumpShortcut(event) {
  if (!event || event.defaultPrevented || event.isComposing || event.repeat) return false
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) return true
  const key = String(event.key || "").toLowerCase()
  if (key === "k" && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) return true
  return false
}

export function jumpShortcutAction(event, { input = null } = {}) {
  if (!isJumpShortcut(event)) return null
  const target = event.target
  if (input && isSameField(target, input)) return "consume"
  if (isJumpTypingTarget(target)) return null
  return "focus"
}

function isSameField(target, input) {
  if (!target || !input) return false
  if (target === input) return true
  return Boolean(input.contains?.(target))
}
