export function copyWithExecCommand(text) {
  if (typeof document === "undefined" || !document.body) return false
  const field = document.createElement("textarea")
  field.value = String(text ?? "")
  field.setAttribute("readonly", "")
  field.style.position = "fixed"
  field.style.top = "0"
  field.style.left = "-9999px"
  document.body.appendChild(field)
  field.select()
  let ok = false
  try {
    ok = document.execCommand("copy")
  } catch {
    ok = false
  }
  field.remove()
  return ok
}

export async function writeClipboard(text, html, io = {}) {
  const clipboard = io.clipboard ?? globalThis.navigator?.clipboard
  const exec = io.exec ?? copyWithExecCommand
  const prompt = io.prompt ?? ((message, value) => globalThis.prompt?.(message, value))
  const ClipboardItem = io.ClipboardItem ?? globalThis.ClipboardItem
  const plain = String(text ?? "")

  if (html && ClipboardItem && clipboard?.write) {
    try {
      await clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([ plain ], { type: "text/plain" }),
          "text/html": new Blob([ String(html) ], { type: "text/html" })
        })
      ])
      return true
    } catch {
      // Safari / iOS often reject text/html ClipboardItem. Plain text can still copy.
    }
  }

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(plain)
      return true
    } catch {
      // gesture may already be spent; try the execCommand fallback
    }
  }

  if (exec(plain)) return true
  prompt?.("Copy", plain)
  return false
}

export function markCopied(button, ok, io = {}) {
  if (!button || !ok) return false
  const wait = io.timeout ?? 1400
  const later = io.setTimeout ?? globalThis.setTimeout
  const cancel = io.clearTimeout ?? globalThis.clearTimeout
  const priorTitle = button.getAttribute("title")
  const priorLabel = button.getAttribute("aria-label")
  button.classList.add("is-copied")
  button.setAttribute("title", "Copied")
  button.setAttribute("aria-label", "Copied")
  if (button._copiedTimer) cancel(button._copiedTimer)
  button._copiedTimer = later(() => {
    button.classList.remove("is-copied")
    if (priorTitle) button.setAttribute("title", priorTitle)
    else button.removeAttribute("title")
    if (priorLabel) button.setAttribute("aria-label", priorLabel)
    else button.removeAttribute("aria-label")
  }, wait)
  return true
}
