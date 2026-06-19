import Foundation
import SwiftUI
import Combine

@MainActor
class AppState: ObservableObject {
    // MARK: - Published State
    @Published var currentTime = Date()
    @Published var names: [String: String] = [:]
    @Published var urls: [String: String] = [:]
    @Published var tests: [TestItem] = []
    @Published var isLoggedIn = false
    @Published var username: String = ""
    @Published var isSyncing = false
    @Published var syncMessage: String?
    @Published var darkMode = true
    
    private var timer: Timer?
    private let storage = StorageService.shared
    
    init() {
        loadFromStorage()
        startClock()
    }
    
    deinit {
        timer?.invalidate()
    }
    
    // MARK: - Clock
    private func startClock() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.currentTime = Date()
            }
        }
    }
    
    // MARK: - Computed Properties
    var dateString: String {
        let cal = Calendar.current
        let y = cal.component(.year, from: currentTime)
        let m = cal.component(.month, from: currentTime)
        let d = cal.component(.day, from: currentTime)
        let weekday = cal.component(.weekday, from: currentTime)
        return "\(y)年\(m)月\(d)日（\(ScheduleData.dayNames[weekday - 1])）"
    }
    
    var timeString: String {
        let cal = Calendar.current
        let h = cal.component(.hour, from: currentTime)
        let m = cal.component(.minute, from: currentTime)
        return String(format: "%02d:%02d", h, m)
    }
    
    var currentStatus: (text: String, icon: String, periodIndex: Int?) {
        ScheduleData.currentStatus(names: names)
    }
    
    var todaySchedule: [(period: Period, blockId: String)]? {
        guard let blocks = ScheduleData.todaySchedule() else { return nil }
        return zip(ScheduleData.periods, blocks).map { ($0, $1) }
    }
    
    var upcomingTests: [TestItem] {
        tests
            .filter { $0.isUpcoming }
            .sorted { ($0.daysUntil ?? Int.max) < ($1.daysUntil ?? Int.max) }
    }
    
    // MARK: - Storage
    func loadFromStorage() {
        names = storage.names
        urls = storage.urls
        tests = storage.tests
        darkMode = storage.darkMode
        isLoggedIn = storage.syncToken != nil
        username = storage.syncUsername ?? ""
    }
    
    func saveToStorage() {
        storage.names = names
        storage.urls = urls
        storage.tests = tests
        storage.darkMode = darkMode
    }
    
    // MARK: - Subject Editing
    func updateSubject(blockId: String, name: String, url: String) {
        if name.isEmpty {
            names.removeValue(forKey: blockId)
        } else {
            names[blockId] = name
        }
        if url.isEmpty {
            urls.removeValue(forKey: blockId)
        } else {
            urls[blockId] = url
        }
        saveToStorage()
    }
    
    // MARK: - Test Management
    func addTest(_ test: TestItem) {
        tests.append(test)
        saveToStorage()
    }
    
    func updateTest(_ test: TestItem) {
        if let index = tests.firstIndex(where: { $0.id == test.id }) {
            tests[index] = test
            saveToStorage()
        }
    }
    
    func deleteTest(id: String) {
        tests.removeAll { $0.id == id }
        saveToStorage()
    }
    
    // MARK: - Cloud Sync
    func login(username: String, password: String) async throws {
        isSyncing = true
        syncMessage = nil
        defer { isSyncing = false }
        
        do {
            let response = try await APIService.shared.login(username: username, password: password)
            if let token = response.token {
                storage.syncToken = token
                storage.syncUsername = username
                self.isLoggedIn = true
                self.username = username
                syncMessage = "ログインしました"
            }
        } catch APIService.APIError.pendingApproval(let msg) {
            syncMessage = msg
            throw APIService.APIError.pendingApproval(msg)
        }
    }
    
    func logout() {
        storage.clearAuth()
        isLoggedIn = false
        username = ""
        syncMessage = "ログアウトしました"
    }
    
    func pull() async throws {
        guard let token = storage.syncToken else { return }
        isSyncing = true
        syncMessage = nil
        defer { isSyncing = false }
        
        do {
            let data = try await APIService.shared.pull(token: token)
            
            if let n = data.names { names = n }
            if let u = data.urls { urls = u }
            if let t = data.tests { tests = t }
            if let d = data.darkMode { darkMode = d }
            
            saveToStorage()
            syncMessage = "クラウドから反映しました"
        } catch APIService.APIError.tokenExpired {
            logout()
            throw APIService.APIError.tokenExpired
        }
    }
    
    func push() async throws {
        guard let token = storage.syncToken else { return }
        isSyncing = true
        syncMessage = nil
        defer { isSyncing = false }
        
        do {
            try await APIService.shared.push(
                token: token,
                names: names,
                urls: urls,
                tests: tests,
                theme: storage.theme,
                darkMode: darkMode
            )
            syncMessage = "クラウドへ保存しました"
        } catch APIService.APIError.tokenExpired {
            logout()
            throw APIService.APIError.tokenExpired
        }
    }
}
