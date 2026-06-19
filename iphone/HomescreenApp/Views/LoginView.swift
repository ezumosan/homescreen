import SwiftUI

struct LoginView: View {
    @EnvironmentObject var appState: AppState

    @State private var username: String = ""
    @State private var password: String = ""

    var body: some View {
        VStack(spacing: 24) {
            // Header
            VStack(spacing: 8) {
                Image(systemName: "cloud.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color(hex: "6ec6ff"), Color(hex: "a78bfa")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("クラウド同期")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)

                Text("ログインしてデータを同期しましょう")
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.white.opacity(0.5))
            }
            .padding(.top, 8)

            // Form fields
            VStack(spacing: 14) {
                HStack(spacing: 12) {
                    Image(systemName: "person.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.white.opacity(0.4))
                        .frame(width: 20)

                    TextField("ユーザー名", text: $username)
                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .foregroundStyle(.white)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                .padding(14)
                .background(cardBackground)

                HStack(spacing: 12) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.white.opacity(0.4))
                        .frame(width: 20)

                    SecureField("パスワード", text: $password)
                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .foregroundStyle(.white)
                }
                .padding(14)
                .background(cardBackground)
            }

            // Login Button
            Button {
                Task {
                    try? await appState.login(username: username, password: password)
                }
            } label: {
                HStack(spacing: 8) {
                    if appState.isSyncing {
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "arrow.right.circle.fill")
                    }
                    Text("ログイン")
                }
                .font(.system(size: 16, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [Color(hex: "6ec6ff"), Color(hex: "a78bfa")],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                )
            }
            .disabled(username.isEmpty || password.isEmpty || appState.isSyncing)
            .opacity(username.isEmpty || password.isEmpty ? 0.5 : 1.0)

            // Sync message
            if let message = appState.syncMessage {
                HStack(spacing: 8) {
                    Image(systemName: messageIcon(for: message))
                        .font(.system(size: 12))
                    Text(message)
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                }
                .foregroundStyle(messageColor(for: message))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(messageColor(for: message).opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(messageColor(for: message).opacity(0.2), lineWidth: 0.5)
                        )
                )
            }
        }
        .padding(20)
    }

    // MARK: - Helpers
    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(Color(hex: "1a1a2e"))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
            )
    }

    private func messageIcon(for message: String) -> String {
        if message.contains("承認") { return "clock.fill" }
        if message.contains("エラー") || message.contains("間違") { return "xmark.circle.fill" }
        return "info.circle.fill"
    }

    private func messageColor(for message: String) -> Color {
        if message.contains("承認") { return Color(hex: "fbbf24") }
        if message.contains("エラー") || message.contains("間違") { return Color.red }
        return Color(hex: "6ec6ff")
    }
}

#Preview {
    ZStack {
        Color(hex: "0f0f1a").ignoresSafeArea()
        LoginView()
            .environmentObject(AppState())
    }
}
