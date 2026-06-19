import Foundation

// MARK: - API Service
actor APIService {
    static let shared = APIService()
    
    private let baseURL = "https://homescreen-gules.vercel.app/api"
    
    // MARK: - Auth
    struct AuthResponse: Codable {
        let message: String?
        let token: String?
        let error: String?
        let pending: Bool?
    }
    
    func login(username: String, password: String) async throws -> AuthResponse {
        let url = URL(string: "\(baseURL)/auth")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "username": username,
            "password": password,
            "device_id": StorageService.shared.deviceId,
            "user_agent": "HomescreenApp-iOS/1.0"
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse
        
        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        
        if httpResponse.statusCode == 202 || httpResponse.statusCode == 403 {
            throw APIError.pendingApproval(authResponse.message ?? authResponse.error ?? "承認待ちです")
        }
        
        if httpResponse.statusCode == 401 {
            throw APIError.invalidCredentials
        }
        
        if httpResponse.statusCode != 200 {
            throw APIError.serverError(authResponse.error ?? "Unknown error")
        }
        
        return authResponse
    }
    
    // MARK: - Sync Pull
    struct SyncPullResponse: Codable {
        let data: SyncData?
        let error: String?
    }
    
    struct SyncData: Codable {
        let names: [String: String]?
        let urls: [String: String]?
        let tests: [TestItem]?
        let theme: String?
        let darkMode: Bool?
    }
    
    func pull(token: String) async throws -> SyncData {
        let url = URL(string: "\(baseURL)/sync")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse
        
        if httpResponse.statusCode == 401 {
            throw APIError.tokenExpired
        }
        
        if httpResponse.statusCode != 200 {
            throw APIError.serverError("Pull failed: \(httpResponse.statusCode)")
        }
        
        let syncResponse = try JSONDecoder().decode(SyncPullResponse.self, from: data)
        
        guard let syncData = syncResponse.data else {
            throw APIError.serverError(syncResponse.error ?? "No data returned")
        }
        
        return syncData
    }
    
    // MARK: - Sync Push
    func push(token: String, names: [String: String], urls: [String: String], tests: [TestItem], theme: String?, darkMode: Bool) async throws {
        let url = URL(string: "\(baseURL)/sync")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        var body: [String: Any] = [
            "names": names,
            "urls": urls,
            "darkMode": darkMode
        ]
        
        // Encode tests
        let testsData = try JSONEncoder().encode(tests)
        let testsArray = try JSONSerialization.jsonObject(with: testsData) as? [[String: Any]] ?? []
        body["tests"] = testsArray
        
        if let theme = theme {
            body["theme"] = theme
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse
        
        if httpResponse.statusCode == 401 {
            throw APIError.tokenExpired
        }
        
        if httpResponse.statusCode != 200 {
            let errorBody = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let errorMsg = errorBody?["error"] as? String ?? "Push failed"
            throw APIError.serverError(errorMsg)
        }
    }
    
    // MARK: - Errors
    enum APIError: LocalizedError {
        case pendingApproval(String)
        case invalidCredentials
        case tokenExpired
        case serverError(String)
        
        var errorDescription: String? {
            switch self {
            case .pendingApproval(let msg): return msg
            case .invalidCredentials: return "ユーザー名またはパスワードが間違っています"
            case .tokenExpired: return "セッションの有効期限が切れました。再度ログインしてください"
            case .serverError(let msg): return msg
            }
        }
    }
}

// MARK: - Storage Service (UserDefaults)
class StorageService {
    static let shared = StorageService()
    
    private let defaults = UserDefaults.standard
    
    private enum Keys {
        static let syncToken = "hs_sync_token"
        static let syncUsername = "hs_sync_username"
        static let deviceId = "hs_device_id"
        static let names = "hs_names"
        static let urls = "hs_urls"
        static let tests = "hs_tests"
        static let theme = "hs_theme_color"
        static let darkMode = "hs_dark_mode"
    }
    
    // MARK: - Auth
    var syncToken: String? {
        get { defaults.string(forKey: Keys.syncToken) }
        set { defaults.set(newValue, forKey: Keys.syncToken) }
    }
    
    var syncUsername: String? {
        get { defaults.string(forKey: Keys.syncUsername) }
        set { defaults.set(newValue, forKey: Keys.syncUsername) }
    }
    
    var deviceId: String {
        if let id = defaults.string(forKey: Keys.deviceId) {
            return id
        }
        let id = UUID().uuidString
        defaults.set(id, forKey: Keys.deviceId)
        return id
    }
    
    // MARK: - Data
    var names: [String: String] {
        get { defaults.dictionary(forKey: Keys.names) as? [String: String] ?? [:] }
        set { defaults.set(newValue, forKey: Keys.names) }
    }
    
    var urls: [String: String] {
        get { defaults.dictionary(forKey: Keys.urls) as? [String: String] ?? [:] }
        set { defaults.set(newValue, forKey: Keys.urls) }
    }
    
    var tests: [TestItem] {
        get {
            guard let data = defaults.data(forKey: Keys.tests) else { return [] }
            return (try? JSONDecoder().decode([TestItem].self, from: data)) ?? []
        }
        set {
            let data = try? JSONEncoder().encode(newValue)
            defaults.set(data, forKey: Keys.tests)
        }
    }
    
    var theme: String? {
        get { defaults.string(forKey: Keys.theme) }
        set { defaults.set(newValue, forKey: Keys.theme) }
    }
    
    var darkMode: Bool {
        get { defaults.object(forKey: Keys.darkMode) == nil ? true : defaults.bool(forKey: Keys.darkMode) }
        set { defaults.set(newValue, forKey: Keys.darkMode) }
    }
    
    // MARK: - Logout
    func clearAuth() {
        syncToken = nil
        syncUsername = nil
    }
}
