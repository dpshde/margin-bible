import assert from "node:assert/strict"
import {
  applyClearedNoteTray,
  expandControlDisabled,
  shouldHideClearedTray,
  shouldShowExpandedTray,
  trayHasNoteContent
} from "../../app/javascript/lib/expand-notes.js"

{
  assert.equal(shouldShowExpandedTray({
    expanding: true, selected: false, collapsed: false, hasContent: false
  }), false)
  assert.equal(shouldShowExpandedTray({
    expanding: true, selected: false, collapsed: false, hasContent: true
  }), true)
  assert.equal(shouldShowExpandedTray({
    expanding: false, selected: true, collapsed: false, hasContent: true
  }), true)
  assert.equal(shouldShowExpandedTray({
    expanding: true, selected: false, collapsed: true, hasContent: true
  }), false)
  assert.equal(shouldShowExpandedTray({
    expanding: false, selected: false, collapsed: false, hasContent: true
  }), false)
  assert.equal(shouldShowExpandedTray({
    expanding: false, selected: true, collapsed: false, hasContent: false
  }), true)
}

{
  const empty = {
    dataset: { noteSlug: "jhn.1.1" },
    hidden: false,
    querySelector: (sel) => (sel === ".att-chip" || sel === ".tray-bookmark.is-on") ? null : ({ empty: true })
  }
  assert.equal(trayHasNoteContent(empty, (host) => host.empty), false)
  applyClearedNoteTray(empty)
  assert.equal(empty.dataset.noteSlug, undefined)
  assert.equal(empty.hidden, true)
  assert.equal(shouldShowExpandedTray({
    expanding: true, selected: false, collapsed: false, hasContent: false
  }), false)
}

{
  const full = { querySelector: (sel) => (sel === ".att-chip" || sel === ".tray-bookmark.is-on") ? null : ({ empty: false }) }
  assert.equal(trayHasNoteContent(full, (host) => host.empty), true)
  const attached = { querySelector: (sel) => sel === ".att-chip" ? {} : null }
  assert.equal(trayHasNoteContent(attached, (host) => host.empty), true)
  const marked = { querySelector: (sel) => sel === ".tray-bookmark.is-on" ? {} : null }
  assert.equal(trayHasNoteContent(marked, (host) => true), true)
  assert.equal(expandControlDisabled(true), false)
  assert.equal(expandControlDisabled(false), true)
}

{
  assert.equal(shouldHideClearedTray({ empty: true, selected: false }), true)
  assert.equal(shouldHideClearedTray({ empty: true, selected: true }), false)
  assert.equal(shouldHideClearedTray({ empty: false, selected: false }), false)
  assert.equal(shouldHideClearedTray({ empty: false, selected: true }), false)
}

console.log("expand-notes: ok")
