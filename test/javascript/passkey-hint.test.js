import assert from "node:assert/strict"
import { memoryStorage } from "../../app/javascript/lib/guest-pack.js"
import {
  PASSKEY_HINT_KEY,
  hasPasskeyHint,
  passkeyAutoStartKind,
  passkeyAutoStartSteps,
  passkeyPrimaryMode,
  refocusPasskeyUsername,
  rememberPasskeyHint
} from "../../app/javascript/lib/passkey-hint.js"

{
  const store = memoryStorage()
  assert.equal(hasPasskeyHint(store), false)
  assert.equal(passkeyPrimaryMode(false), "use")
  assert.equal(passkeyPrimaryMode(hasPasskeyHint(store)), "use")
  rememberPasskeyHint(store)
  assert.equal(store.getItem(PASSKEY_HINT_KEY), "1")
  assert.equal(hasPasskeyHint(store), true)
  assert.equal(passkeyPrimaryMode(true), "use")
  assert.equal(passkeyPrimaryMode(hasPasskeyHint(store)), "use")
}

{
  assert.equal(passkeyAutoStartKind({}), "conditional")
  assert.equal(passkeyAutoStartKind({ passkeysSupported: true, hasOptions: true }), "conditional")
  assert.deepEqual(passkeyAutoStartSteps({}), [ "conditional" ])
  assert.equal(passkeyAutoStartKind({
    immediateAvailable: true,
    userActivated: true
  }), "immediate")
  assert.deepEqual(passkeyAutoStartSteps({
    immediateAvailable: true,
    userActivated: true
  }), [ "immediate", "conditional" ])
  assert.equal(passkeyAutoStartKind({
    immediateAvailable: true,
    userActivated: false
  }), "conditional")
  assert.equal(passkeyAutoStartKind({ passkeysSupported: false }), null)
  assert.deepEqual(passkeyAutoStartSteps({ passkeysSupported: false }), [])
  assert.equal(passkeyAutoStartKind({ hasOptions: false }), null)
}

{
  const calls = []
  const input = {
    focus() { calls.push("focus") },
    blur() { calls.push("blur") }
  }
  assert.equal(refocusPasskeyUsername(null), false)
  assert.equal(refocusPasskeyUsername(input), true)
  assert.deepEqual(calls, [ "focus" ])

  globalThis.document = { activeElement: input }
  assert.equal(refocusPasskeyUsername(input), true)
  assert.deepEqual(calls, [ "focus", "blur", "focus" ])
  delete globalThis.document
}

console.log("passkey-hint: ok")
