import assert from "node:assert/strict"
import { paneIsOpen, shouldCloseDockMenu } from "../../app/javascript/lib/dock-menu.js"

assert.equal(paneIsOpen("root", "root"), true)
assert.equal(paneIsOpen("toc", "root"), false)
assert.equal(paneIsOpen("toc", "toc"), true)
assert.equal(paneIsOpen("root", null), true)
assert.equal(paneIsOpen("toc", ""), false)

assert.equal(shouldCloseDockMenu(null), false)
assert.equal(shouldCloseDockMenu({ tagName: "BUTTON", getAttribute: () => "click->dock-menu#show" }), false)
assert.equal(shouldCloseDockMenu({ tagName: "BUTTON", getAttribute: () => "click->reader#toggleQuiet" }), true)
assert.equal(shouldCloseDockMenu({ tagName: "A", getAttribute: () => "click->reader#jumpSection" }), true)
assert.equal(shouldCloseDockMenu({ tagName: "A", getAttribute: () => null }), true)

console.log("dock-menu: ok")
