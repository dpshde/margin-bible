import assert from "node:assert/strict"
import { memoryStorage } from "../../app/javascript/lib/guest-pack.js"
import {
  PASSKEY_HINT_KEY,
  hasPasskeyHint,
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

console.log("passkey-hint: ok")
