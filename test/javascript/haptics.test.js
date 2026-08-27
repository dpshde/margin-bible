import assert from "node:assert/strict"
import {
  playHaptic,
  resetHapticsForTests,
  setNativeHapticPlayer
} from "../../app/javascript/lib/haptics.js"

function motionOk() {
  return () => ({ matches: false })
}

{
  resetHapticsForTests()
  assert.equal(playHaptic("nudge", { matchMedia: () => ({ matches: true }), WebHaptics: class {} }), false)
}

{
  resetHapticsForTests()
  assert.equal(playHaptic("nudge", { matchMedia: motionOk(), WebHaptics: null, strada: null }), false)
  assert.equal(playHaptic("nope", { matchMedia: motionOk(), WebHaptics: class { trigger() {} } }), false)
}

{
  resetHapticsForTests()
  const calls = []
  class FakeWebHaptics {
    trigger(name) {
      calls.push(name)
    }
  }
  assert.equal(playHaptic("light", { matchMedia: motionOk(), WebHaptics: FakeWebHaptics }), true)
  assert.equal(playHaptic("success", { matchMedia: motionOk(), WebHaptics: FakeWebHaptics }), true)
  assert.equal(playHaptic("selection", { matchMedia: motionOk(), WebHaptics: FakeWebHaptics }), true)
  assert.equal(playHaptic("error", { matchMedia: motionOk(), WebHaptics: FakeWebHaptics }), true)
  assert.deepEqual(calls, [ "nudge", "success", "selection", "error" ])
}

{
  resetHapticsForTests()
  const sent = []
  const strada = {
    web: {
      send(message) {
        sent.push(message)
      }
    }
  }
  class Boom {
    trigger() {
      throw new Error("web should not run")
    }
  }
  assert.equal(playHaptic("nudge", { matchMedia: motionOk(), strada, WebHaptics: Boom }), true)
  assert.equal(playHaptic("success", { matchMedia: motionOk(), strada, WebHaptics: Boom }), true)
  assert.deepEqual(sent.map((message) => message.data.type), [ "nudge", "success" ])
  assert.equal(sent[0].component, "haptic")
  assert.equal(sent[0].event, "play")
}

{
  resetHapticsForTests()
  const played = []
  setNativeHapticPlayer((type) => played.push(type))
  assert.equal(playHaptic("selection", {
    matchMedia: motionOk(),
    strada: { web: { send() {} } },
    WebHaptics: class { trigger() { throw new Error("web") } }
  }), true)
  assert.deepEqual(played, [ "selection" ])
}

{
  resetHapticsForTests()
  const calls = []
  setNativeHapticPlayer((type) => calls.push(type))
  assert.equal(playHaptic("nudge", { matchMedia: motionOk(), WebHaptics: class { trigger() { calls.push("web") } } }), true)
  assert.deepEqual(calls, [ "web" ])
}

{
  resetHapticsForTests()
  class Broken {
    trigger() {
      throw new Error("vibrate denied")
    }
  }
  assert.equal(playHaptic("error", { matchMedia: motionOk(), WebHaptics: Broken }), false)
}

{
  resetHapticsForTests()
  const calls = []
  class FakeWebHaptics {
    trigger(name) {
      calls.push(name)
    }
  }
  const stub = {
    web: {
      supportsComponent() {
        return false
      },
      send() {
        calls.push("native")
      }
    }
  }
  assert.equal(playHaptic("nudge", {
    matchMedia: motionOk(),
    global: { Strada: stub, HotwireNative: stub },
    WebHaptics: FakeWebHaptics
  }), true)
  assert.deepEqual(calls, [ "nudge" ])
}

{
  resetHapticsForTests()
  class Unsupported {
    static isSupported = false
    trigger() {
      throw new Error("should skip")
    }
  }
  assert.equal(playHaptic("nudge", { matchMedia: motionOk(), WebHaptics: Unsupported }), false)
}

console.log("haptics: ok")
