import Foundation

struct TestItem: Identifiable, Codable, Equatable {
    var id: String
    var blockId: String
    var date: String      // "YYYY-MM-DD"
    var unit: String
    
    init(id: String = UUID().uuidString, blockId: String, date: String, unit: String = "未設定") {
        self.id = id
        self.blockId = blockId
        self.date = date
        self.unit = unit
    }
    
    var dateValue: Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: date)
    }
    
    /// Days until this test from today. Negative = past.
    var daysUntil: Int? {
        guard let testDate = dateValue else { return nil }
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let test = cal.startOfDay(for: testDate)
        return cal.dateComponents([.day], from: today, to: test).day
    }
    
    /// Urgency label
    var urgencyLabel: String? {
        guard let days = daysUntil, days >= 0 else { return nil }
        if days == 0 { return "今日" }
        if days <= 3 { return "⚠️ \(days)日後" }
        if days <= 7 { return "📍 \(days)日後" }
        return "\(days)日後"
    }
    
    var isUpcoming: Bool {
        guard let days = daysUntil else { return false }
        return days >= 0
    }
}
