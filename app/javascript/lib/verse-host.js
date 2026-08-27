export function verseNodes(root, n) {
  return [ ...root.querySelectorAll(`[data-verse="${n}"]`) ]
}

export function verseTrayHost(root, n) {
  const nodes = verseNodes(root, n)
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    if (nodes[i].querySelector(".note-tray")) return nodes[i]
  }
  return nodes[nodes.length - 1] || root.querySelector(`#v${n}`) || null
}
