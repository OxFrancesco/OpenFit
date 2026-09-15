import SwiftUI
import UIKit

// MARK: - Dynamic color helper

extension Color {
    init(light: String, dark: String) {
        self.init(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&value)
        self.init(
            red: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: 1
        )
    }
}

extension Color {
    init(hex: String) { self.init(uiColor: UIColor(hex: hex)) }
}

// MARK: - Theme palette (spec §5 — src/constants/theme.ts)

enum Theme {
    static let text = Color(light: "#17211C", dark: "#DFE9E0")
    static let background = Color(light: "#F5F9F5", dark: "#0F1511")
    static let backgroundElement = Color(light: "#EAF1EB", dark: "#1B231D")
    static let backgroundSelected = Color(light: "#DCE8DF", dark: "#2F3A32")
    static let card = Color(light: "#EAF1EB", dark: "#1B231D")
    static let textSecondary = Color(light: "#4D6357", dark: "#B7CABD")
    static let separator = Color(light: "#BFCFC3", dark: "#405348")
    static let rule = Color(light: "#17211C", dark: "#DFE9E0")
    static let primary = Color(light: "#006C50", dark: "#8DD5B3")
    static let onPrimary = Color(light: "#FFFFFF", dark: "#003827")
    static let primaryContainer = Color(light: "#A8F2CE", dark: "#00513A")
    static let onPrimaryContainer = Color(light: "#002116", dark: "#A8F2CE")
    static let secondary = Color(light: "#486454", dark: "#B0CDB9")
    static let secondaryContainer = Color(light: "#CCE9D5", dark: "#304C3B")
    static let onSecondaryContainer = Color(light: "#102D1E", dark: "#CCE9D5")
    static let tertiary = Color(light: "#775A23", dark: "#E8C17F")
    static let tertiaryContainer = Color(light: "#FFDEA2", dark: "#5C420E")
    static let onTertiaryContainer = Color(light: "#291800", dark: "#FFDEA2")
    static let surface = Color(light: "#F5F9F5", dark: "#0F1511")
    static let surfaceContainer = Color(light: "#EAF1EB", dark: "#1B231D")
    static let surfaceContainerHigh = Color(light: "#E0E9E2", dark: "#252E27")
    static let surfaceContainerHighest = Color(light: "#DCE5DD", dark: "#303A32")
    static let outline = Color(light: "#708579", dark: "#8A9F91")
    static let error = Color(light: "#BA1A1A", dark: "#FFB4AB")
    static let errorContainer = Color(light: "#FFDAD6", dark: "#93000A")
    static let onErrorContainer = Color(light: "#410002", dark: "#FFDAD6")

    // RingColors — slot colors in light mode; dark-mode set used by the rings view.
    static let ringSteps = Color(hex: "#007D60")
    static let ringCalories = Color(hex: "#C45735")
    static let ringMinutes = Color(hex: "#687A26")
    static let errorBannerBackground = Color(red: 1, green: 59/255, blue: 48/255).opacity(0.1)
}

enum Spacing {
    static let half: CGFloat = 2
    static let one: CGFloat = 4
    static let two: CGFloat = 8
    static let three: CGFloat = 16
    static let four: CGFloat = 24
    static let five: CGFloat = 32
    static let six: CGFloat = 64
}

enum Shape {
    static let small: CGFloat = 12
    static let medium: CGFloat = 16
    static let large: CGFloat = 24
    static let extraLarge: CGFloat = 28
    static let full: CGFloat = 999
}

let maxContentWidth: CGFloat = 840
let metricCardMinHeight: CGFloat = 144

// MARK: - ThemedText type scale (spec §4.6 — system font stands in for Roboto)

enum TextKind {
    case `default`, title, subtitle, small, smallBold, caption, metric, hero, link, code

    var font: Font {
        switch self {
        case .default: return .system(size: 16, weight: .regular)
        case .title: return .system(size: 32, weight: .medium)
        case .subtitle: return .system(size: 22, weight: .medium)
        case .small: return .system(size: 14, weight: .regular)
        case .smallBold: return .system(size: 14, weight: .medium)
        case .caption: return .system(size: 12, weight: .regular)
        case .metric: return .system(size: 24, weight: .medium).monospacedDigit()
        case .hero: return .system(size: 45, weight: .medium).monospacedDigit()
        case .link: return .system(size: 14, weight: .regular)
        case .code: return .system(size: 12, weight: .regular, design: .monospaced)
        }
    }

    var lineHeight: CGFloat {
        switch self {
        case .default: return 24
        case .title: return 40
        case .subtitle: return 28
        case .small, .smallBold: return 20
        case .caption: return 16
        case .metric: return 30
        case .hero: return 52
        case .link: return 30
        case .code: return 20
        }
    }
}

struct ThemedTextModifier: ViewModifier {
    var kind: TextKind = .default
    var color: Color = Theme.text

    func body(content: Content) -> some View {
        content
            .font(kind.font)
            .lineSpacing(kind.lineHeight - kind.fontSize)
            .foregroundStyle(color)
    }
}

extension TextKind {
    var fontSize: CGFloat {
        switch self {
        case .default: return 16
        case .title: return 32
        case .subtitle: return 22
        case .small, .smallBold, .link: return 14
        case .caption, .code: return 12
        case .metric: return 24
        case .hero: return 45
        }
    }
}

extension View {
    func themed(_ kind: TextKind = .default, color: Color = Theme.text) -> some View {
        modifier(ThemedTextModifier(kind: kind, color: color))
    }
}

// MARK: - Number formatting (toLocaleString equivalent)

func formatAmount(_ value: Double?, fractionDigits: Int = 0) -> String {
    guard let value else { return "--" }
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.maximumFractionDigits = fractionDigits
    return formatter.string(from: NSNumber(value: value)) ?? "--"
}
