import assert from "node:assert/strict"
import { markCopied, writeClipboard } from "../../app/javascript/lib/clipboard-copy.js"

function fakeButton() {
  const attrs = {
    title: "Copy notes",
    "aria-label": "Copy chapter notes"
  }
  const classes = new Set()
  return {
    classes,
    attrs,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name)
    },
    getAttribute(name) {
      return attrs[name]
    },
    setAttribute(name, value) {
      attrs[name] = value
    },
    removeAttribute(name) {
      delete attrs[name]
    }
  }
}

{
  const writes = []
  const ok = await writeClipboard("plain", "<p>html</p>", {
    ClipboardItem: class {
      constructor(items) {
        this.items = items
      }
    },
    clipboard: {
      write: async (items) => {
        writes.push(items)
      }
    }
  })
  assert.equal(ok, true)
  assert.equal(writes.length, 1)
}

{
  const texts = []
  const ok = await writeClipboard("chapter text", "<p>chapter</p>", {
    ClipboardItem: class {
      constructor(items) {
        this.items = items
      }
    },
    clipboard: {
      write: async () => {
        throw new Error("ClipboardItem html denied")
      },
      writeText: async (text) => {
        texts.push(text)
      }
    }
  })
  assert.equal(ok, true)
  assert.deepEqual(texts, [ "chapter text" ])
}

{
  const prompts = []
  const ok = await writeClipboard("fallback", null, {
    clipboard: {
      writeText: async () => {
        throw new Error("no gesture")
      }
    },
    exec: (text) => text === "fallback",
    prompt: (label, value) => prompts.push([ label, value ])
  })
  assert.equal(ok, true)
  assert.deepEqual(prompts, [])
}

{
  const prompts = []
  const ok = await writeClipboard("ask me", null, {
    clipboard: {
      writeText: async () => {
        throw new Error("no gesture")
      }
    },
    exec: () => false,
    prompt: (label, value) => prompts.push([ label, value ])
  })
  assert.equal(ok, false)
  assert.deepEqual(prompts, [ [ "Copy", "ask me" ] ])
}

{
  assert.equal(markCopied(null, true), false)
  assert.equal(markCopied(fakeButton(), false), false)
}

{
  const button = fakeButton()
  let restore
  const ok = markCopied(button, true, {
    timeout: 1400,
    setTimeout: (fn) => {
      restore = fn
      return 7
    },
    clearTimeout: () => {}
  })
  assert.equal(ok, true)
  assert.equal(button.classes.has("is-copied"), true)
  assert.equal(button.getAttribute("title"), "Copied")
  assert.equal(button.getAttribute("aria-label"), "Copied")
  restore()
  assert.equal(button.classes.has("is-copied"), false)
  assert.equal(button.getAttribute("title"), "Copy notes")
  assert.equal(button.getAttribute("aria-label"), "Copy chapter notes")
}
