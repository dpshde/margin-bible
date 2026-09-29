import SwiftUI

enum MarginTheme {
    static let rem: CGFloat = 15.2
    static let paper = Color(red: 246 / 255, green: 245 / 255, blue: 242 / 255)
    static let paperRaised = Color.white
    static let ink = Color(red: 28 / 255, green: 25 / 255, blue: 23 / 255)
    static let inkSoft = Color(red: 68 / 255, green: 64 / 255, blue: 60 / 255)
    static let muted = Color(red: 120 / 255, green: 113 / 255, blue: 108 / 255)
    static let faint = Color(red: 168 / 255, green: 162 / 255, blue: 158 / 255)
    static let line = Color(red: 28 / 255, green: 25 / 255, blue: 23 / 255).opacity(0.12)
    static let fill = Color(red: 28 / 255, green: 25 / 255, blue: 23 / 255).opacity(0.05)
    static let rail = Color(red: 28 / 255, green: 25 / 255, blue: 23 / 255).opacity(0.18)
    static let railOpen = Color(red: 28 / 255, green: 25 / 255, blue: 23 / 255).opacity(0.42)
    static let spanWash = Color(red: 28 / 255, green: 25 / 255, blue: 23 / 255).opacity(0.04)
    static let gridScrim = Color(red: 28 / 255, green: 25 / 255, blue: 23 / 255).opacity(0.28)

    static func sans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        switch weight {
        case .medium:
            return .custom("Poppins-Medium", size: size)
        case .semibold, .bold, .heavy, .black:
            return .custom("Poppins-SemiBold", size: size)
        default:
            return .custom("Poppins-Regular", size: size)
        }
    }

    static func read(_ size: CGFloat) -> Font {
        .custom("SourceSerif4Roman-Regular", size: size)
    }

    static func head(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .custom("Lexend-Regular", size: size).weight(weight)
    }

    static func metrics(for width: CGFloat) -> VerseMetrics {
        if width <= 390 {
            return VerseMetrics(gutter: 1.05 * rem, gap: 0.45 * rem, inset: 0.2 * rem)
        }
        if width <= 640 {
            return VerseMetrics(gutter: 1.2 * rem, gap: 0.55 * rem, inset: 0.3 * rem)
        }
        return VerseMetrics(gutter: 1.4 * rem, gap: 0.7 * rem, inset: 0.4 * rem)
    }
}

struct VerseMetrics {
    var gutter: CGFloat
    var gap: CGFloat
    var inset: CGFloat
    var textLead: CGFloat { inset + gutter + gap }
}
