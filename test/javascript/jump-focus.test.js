import assert from "node:assert/strict"
import { isJumpShortcut, isJumpTypingTarget, jumpShortcutAction } from "../../app/javascript/lib/jump-focus.js"

function el(matches = false, closest = null, extras = {}) {
  return {
    nodeType: 1,
    matches: () => matches,
    isContentEditable: false,
    closest: () => closest,
    ...extras
  }
}

function keyEvent(partial) {
  return {
    defaultPrevented: false,
    isComposing: false,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: el(),
    ...partial
  }
}

{
  assert.equal(isJumpShortcut(keyEvent({ key: "/" })), true)
  assert.equal(isJumpShortcut(keyEvent({ key: "/", ctrlKey: true })), false)
  assert.equal(isJumpShortcut(keyEvent({ key: "k", metaKey: true })), true)
  assert.equal(isJumpShortcut(keyEvent({ key: "K", ctrlKey: true })), true)
  assert.equal(isJumpShortcut(keyEvent({ key: "k", metaKey: true, shiftKey: true })), false)
  assert.equal(isJumpShortcut(keyEvent({ key: "k" })), false)
  assert.equal(isJumpShortcut(keyEvent({ key: "/", repeat: true })), false)
}

{
  const input = el(true)
  const otext = el(true, null, { isContentEditable: true })
  const outliner = el(false, el())
  outliner.closest = (sel) => (String(sel).includes(".outliner") ? outliner : null)
  assert.equal(isJumpTypingTarget(input), true)
  assert.equal(isJumpTypingTarget(otext), true)
  assert.equal(isJumpTypingTarget(outliner), true)
  assert.equal(isJumpTypingTarget(el()), false)
}

{
  const jump = el()
  assert.equal(jumpShortcutAction(keyEvent({ key: "/" }), { input: jump }), "focus")
  assert.equal(jumpShortcutAction(keyEvent({ key: "k", metaKey: true }), { input: jump }), "focus")
  assert.equal(jumpShortcutAction(keyEvent({ key: "/", target: jump }), { input: jump }), "consume")
  assert.equal(jumpShortcutAction(keyEvent({ key: "k", ctrlKey: true, target: jump }), { input: jump }), "consume")
}

{
  const note = el(false, el())
  note.closest = (sel) => (String(sel).includes(".otext") ? note : null)
  assert.equal(jumpShortcutAction(keyEvent({ key: "/", target: note })), null)
  assert.equal(jumpShortcutAction(keyEvent({ key: "k", metaKey: true, target: note })), null)
}

{
  const textarea = el(true)
  textarea.matches = (sel) => String(sel).includes("textarea")
  assert.equal(jumpShortcutAction(keyEvent({ key: "/", target: textarea })), null)
}
