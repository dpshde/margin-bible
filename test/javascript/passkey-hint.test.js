import assert from "node:assert/strict"
import { memoryStorage } from "../../app/javascript/lib/guest-pack.js"
import {
  PASSKEY_HINT_KEY,
  hasPasskeyHint,
  passkeyAutoStartKind,
  passkeyPrimaryMode,
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
  assert.equal(passkeyAutoStartKind({
    mediation: "conditional",
    conditionalAvailable: true
  }), "conditional")
  assert.equal(passkeyAutoStartKind({
    mediation: "conditional",
    conditionalAvailable: false
  }), "modal")
  assert.equal(passkeyAutoStartKind({
    mediation: "conditional",
    conditionalAvailable: false,
    passkeysSupported: false
  }), null)
  assert.equal(passkeyAutoStartKind({
    mediation: "conditional",
    conditionalAvailable: false,
    hasOptions: false
  }), null)
  assert.equal(passkeyAutoStartKind({ mediation: "optional", conditionalAvailable: true }), null)
}

console.log("passkey-hint: ok")
