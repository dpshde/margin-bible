import HotwireNative
import UIKit

final class HapticComponent: BridgeComponent {
    override class var name: String { "haptic" }

    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let notify = UINotificationFeedbackGenerator()
    private let selection = UISelectionFeedbackGenerator()

    override func onReceive(message: Message) {
        guard message.event == "play" else { return }
        let payload: PlayData? = message.data()
        play(payload?.type ?? "")
    }

    private func play(_ type: String) {
        switch type {
        case "success":
            notify.notificationOccurred(.success)
        case "warning":
            notify.notificationOccurred(.warning)
        case "error":
            notify.notificationOccurred(.error)
        case "selection":
            selection.selectionChanged()
        case "medium", "buzz":
            mediumImpact.impactOccurred()
        default:
            lightImpact.impactOccurred()
        }
    }

    private struct PlayData: Decodable {
        let type: String
    }
}
