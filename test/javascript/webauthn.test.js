import assert from "node:assert/strict"
import {
  PASSKEY_HINTS,
  authenticate,
  prepareCreationOptions,
  prepareRequestOptions
} from "../../app/javascript/lib/webauthn.js"

const challenge = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8"

{
  const prepared = prepareRequestOptions({
    challenge,
    rpId: "localhost",
    userVerification: "preferred",
    allowCredentials: []
  })
  assert.deepEqual(prepared.hints, PASSKEY_HINTS)
  assert.equal("allowCredentials" in prepared, false)
  assert.ok(prepared.challenge instanceof ArrayBuffer)
}

{
  const prepared = prepareRequestOptions({
    challenge,
    rpId: "localhost",
    hints: [ "security-key" ]
  })
  assert.deepEqual(prepared.hints, [ "security-key" ])
}

{
  const prepared = prepareCreationOptions({
    challenge,
    user: { id: challenge, name: "reader@example.com", displayName: "reader@example.com" },
    excludeCredentials: []
  })
  assert.deepEqual(prepared.hints, PASSKEY_HINTS)
}

await (async () => {
  const calls = []
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      credentials: {
        get: async (request) => {
          calls.push(request)
          const buf = new Uint8Array([ 1, 2, 3 ]).buffer
          return {
            id: "cred",
            response: {
              clientDataJSON: buf,
              authenticatorData: buf,
              signature: buf
            }
          }
        }
      }
    }
  })

  await authenticate({ challenge, rpId: "localhost" })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].publicKey.hints, PASSKEY_HINTS)
  assert.equal("signal" in calls[0], false)
  assert.equal("mediation" in calls[0], false)

  const controller = new AbortController()
  await authenticate({ challenge, rpId: "localhost" }, { signal: controller.signal, mediation: "optional" })
  assert.equal(calls[1].signal, controller.signal)
  assert.equal(calls[1].mediation, "optional")

  await authenticate({ challenge, rpId: "localhost" }, { mediation: "immediate" })
  assert.equal(calls[2].mediation, "immediate")
  assert.equal("signal" in calls[2], false)
})()
