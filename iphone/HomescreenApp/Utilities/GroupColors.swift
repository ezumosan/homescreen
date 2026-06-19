import SwiftUI

struct GroupColors {
    static let colors: [String: Color] = [
        "I":   Color(hex: "6ec6ff"),  // Blue
        "II":  Color(hex: "a78bfa"),  // Purple
        "III": Color(hex: "34d399"),  // Green
        "IV":  Color(hex: "fbbf24"),  // Yellow/Amber
        "V":   Color(hex: "f472b6"),  // Pink
        "VI":  Color(hex: "fb923c"),  // Orange
        "LHR": Color(hex: "94a3b8"),  // Slate/Gray
    ]
    
    static func color(for blockId: String) -> Color {
        let base = ScheduleData.groupBase(blockId)
        return colors[base] ?? .gray
    }
    
    static func backgroundColor(for blockId: String) -> Color {
        return color(for: blockId).opacity(0.15)
    }
    
    static func borderColor(for blockId: String) -> Color {
        return color(for: blockId).opacity(0.4)
    }
}

// MARK: - Color Extension for Hex
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
