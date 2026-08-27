import { BridgeComponent } from "@hotwired/hotwire-native-bridge"
import { setNativeHapticPlayer } from "../lib/haptics"

export default class extends BridgeComponent {
  static component = "haptic"

  connect() {
    super.connect()
    setNativeHapticPlayer((type) => {
      this.send("play", { type })
    })
  }

  disconnect() {
    setNativeHapticPlayer(null)
    super.disconnect()
  }
}
