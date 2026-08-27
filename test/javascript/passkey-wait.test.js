import assert from "node:assert/strict"
import {
  PASSKEY_SETTLED_COPY,
  PASSKEY_WAIT_COPY,
  passkeyWaitCopy
} from "../../app/javascript/lib/passkey-wait.js"

{
  assert.equal(passkeyWaitCopy(), PASSKEY_WAIT_COPY)
  assert.equal(passkeyWaitCopy({ supported: true }), PASSKEY_WAIT_COPY)
  assert.equal(passkeyWaitCopy({ supported: false }), PASSKEY_SETTLED_COPY)
  assert.equal(passkeyWaitCopy({ cancelled: true }), PASSKEY_SETTLED_COPY)
  assert.equal(passkeyWaitCopy({ failed: true }), PASSKEY_SETTLED_COPY)
  assert.equal(passkeyWaitCopy({ timedOut: true }), PASSKEY_SETTLED_COPY)
  assert.equal(PASSKEY_WAIT_COPY, "Waiting for your passkey…")
  assert.equal(PASSKEY_SETTLED_COPY, "Nothing popped up? That's okay.")
}

console.log("passkey-wait: ok")
