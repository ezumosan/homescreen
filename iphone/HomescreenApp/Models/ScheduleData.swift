import Foundation
import SwiftUI

// MARK: - Period Definition
struct Period: Identifiable {
    let id: Int // 0-indexed period number
    let label: String
    let start: (hour: Int, minute: Int)
    let end: (hour: Int, minute: Int)
    
    var startMinutes: Int { start.hour * 60 + start.minute }
    var endMinutes: Int { end.hour * 60 + end.minute }
    
    var timeString: String {
        String(format: "%02d:%02d – %02d:%02d", start.hour, start.minute, end.hour, end.minute)
    }
}

// MARK: - Schedule Configuration
struct ScheduleData {
    
    // 7 periods per day
    static let periods: [Period] = [
        Period(id: 0, label: "1限", start: (8, 45),  end: (9, 35)),
        Period(id: 1, label: "2限", start: (9, 40),  end: (10, 30)),
        Period(id: 2, label: "3限", start: (10, 35), end: (11, 25)),
        Period(id: 3, label: "4限", start: (11, 30), end: (12, 20)),
        Period(id: 4, label: "5限", start: (12, 50), end: (13, 40)),
        Period(id: 5, label: "6限", start: (13, 45), end: (14, 35)),
        Period(id: 6, label: "7限", start: (14, 40), end: (15, 30)),
    ]
    
    // Special time slots
    static let shrStart = 8 * 60 + 30  // 8:30
    static let shrEnd   = 8 * 60 + 40  // 8:40
    static let lunchStart = 12 * 60 + 20 // 12:20
    static let lunchEnd   = 12 * 60 + 50 // 12:50
    static let schoolStart = 8 * 60 + 30 // 8:30
    static let schoolEnd   = 15 * 60 + 30 // 15:30
    
    // Mon(0) - Fri(4), 7 periods each
    // Block IDs reference subject groups
    static let schedule: [[String]] = [
        ["I-a",  "II-a",  "III-a", "IV-a",  "V-a",   "VI",    "LHR"],    // Mon
        ["II-b", "I-a",   "I-b",   "V-b",   "IV-b",  "VI",    "III-b"],  // Tue
        ["III-a","II-a",  "IV-b",  "IV-a",  "V-a",   "V-b",   "I-b"],    // Wed
        ["II-a", "II-b",  "I-a",   "V-a",   "IV-a",  "III-b", "VI-a"],   // Thu
        ["III-b","II-b",  "VI",    "IV-b",  "V-b",   "I-b",   "III-a"],  // Fri
    ]
    
    static let dayNames = ["日", "月", "火", "水", "木", "金", "土"]
    static let dayNamesFull = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"]
    
    // All possible block IDs
    static let allBlockIds = ["I-a","I-b","II-a","II-b","III-a","III-b","IV-a","IV-b","V-a","V-b","VI","VI-a","LHR"]
    
    /// Extract group base from block ID (e.g. "III-a" → "III")
    static func groupBase(_ blockId: String) -> String {
        if blockId == "LHR" { return "LHR" }
        let parts = blockId.split(separator: "-")
        return String(parts.first ?? Substring(blockId))
    }
    
    /// Get today's schedule (array of 7 block IDs), or nil if weekend
    static func todaySchedule() -> [String]? {
        let weekday = Calendar.current.component(.weekday, from: Date())
        // weekday: 1=Sun, 2=Mon, ..., 7=Sat
        let dayIndex = weekday - 2 // 0=Mon, 1=Tue, ..., 4=Fri
        guard dayIndex >= 0 && dayIndex <= 4 else { return nil }
        return schedule[dayIndex]
    }
    
    /// Get the current period index (0-6) or nil
    static func currentPeriodIndex() -> Int? {
        let now = Date()
        let cal = Calendar.current
        let h = cal.component(.hour, from: now)
        let m = cal.component(.minute, from: now)
        let nowMin = h * 60 + m
        
        for (i, period) in periods.enumerated() {
            if nowMin >= period.startMinutes && nowMin < period.endMinutes {
                return i
            }
        }
        return nil
    }
    
    /// Get current status description
    static func currentStatus(names: [String: String]) -> (text: String, icon: String, periodIndex: Int?) {
        let now = Date()
        let cal = Calendar.current
        let weekday = cal.component(.weekday, from: now)
        let h = cal.component(.hour, from: now)
        let m = cal.component(.minute, from: now)
        let nowMin = h * 60 + m
        
        // Weekend
        guard weekday >= 2 && weekday <= 6 else {
            return ("休日", "moon.fill", nil)
        }
        
        let dayIndex = weekday - 2
        
        // SHR
        if nowMin >= shrStart && nowMin < shrEnd {
            return ("ショートホームルーム", "bell.fill", nil)
        }
        
        // Lunch
        if nowMin >= lunchStart && nowMin < lunchEnd {
            return ("昼休憩", "fork.knife", nil)
        }
        
        // Check periods
        for (i, period) in periods.enumerated() {
            if nowMin >= period.startMinutes && nowMin < period.endMinutes {
                let blockId = schedule[dayIndex][i]
                let name = displayName(blockId, names: names)
                return ("\(period.label)｜\(name)", "book.fill", i)
            }
        }
        
        // Before school
        if nowMin < schoolStart {
            return ("授業前", "sunrise.fill", nil)
        }
        
        // After school
        if nowMin >= schoolEnd {
            return ("放課後", "sunset.fill", nil)
        }
        
        // Break time
        return ("休憩時間", "clock.fill", nil)
    }
    
    /// Get display name for a block ID
    static func displayName(_ blockId: String, names: [String: String]) -> String {
        return names[blockId] ?? blockId
    }
    
    /// Get URL for a block ID
    static func blockURL(_ blockId: String, urls: [String: String]) -> String? {
        let url = urls[blockId]
        if let url = url, !url.isEmpty, url != "#" {
            return url
        }
        return nil
    }
}
