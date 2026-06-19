import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color(hex: "0f0f1a").ignoresSafeArea()

            List {
                // MARK: - Cloud Sync Section
                Section {
                    if appState.isLoggedIn {
                        loggedInSection
                    } else {
                        LoginView()
                            .listRowBackground(Color.clear)
                            .listRowInsets(EdgeInsets())
                    }
                } header: {
                    sectionHeader("クラウド同期", icon: "cloud.fill")
                }

                // MARK: - Subject Names Section
                Section {
                    ForEach(ScheduleData.allBlockIds, id: \.self) { blockId in
                        NavigationLink(destination: SubjectEditView(blockId: blockId)) {
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(GroupColors.color(for: blockId))
                                    .frame(width: 10, height: 10)

                                Text(blockId)
                                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                                    .foregroundStyle(.white)

                                Spacer()

                                Text(ScheduleData.displayName(blockId, names: appState.names))
                                    .font(.system(size: 14, weight: .medium, design: .rounded))
                                    .foregroundStyle(Color.white.opacity(0.5))
                                    .lineLimit(1)
                            }
                            .padding(.vertical, 4)
                        }
                        .listRowBackground(Color(hex: "1a1a2e"))
                    }
                } header: {
                    sectionHeader("科目名の編集", icon: "pencil.circle.fill")
                }

                // MARK: - Display Settings
                Section {
                    // ダークモード設定はシステムに依存するため削除されました

                } header: {
                    sectionHeader("表示設定", icon: "paintbrush.fill")
                }

                // MARK: - App Info
                Section {
                    HStack {
                        Text("バージョン")
                            .font(.system(size: 14, weight: .medium, design: .rounded))
                            .foregroundStyle(Color.appTextSecondary)
                        Spacer()
                        Text("Beta 0.0")
                            .font(.system(size: 14, weight: .medium, design: .monospaced))
                            .foregroundStyle(Color.appTextSecondary.opacity(0.6))
                    }
                    .listRowBackground(Color.appCard)
                } header: {
                    sectionHeader("アプリ情報", icon: "info.circle.fill")
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("設定")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color(hex: "0f0f1a"), for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    // MARK: - Logged In Section
    private var loggedInSection: some View {
        Group {
            // Username display
            HStack(spacing: 10) {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(Color(hex: "6ec6ff"))

                VStack(alignment: .leading, spacing: 2) {
                    Text(appState.username)
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("ログイン中")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(Color(hex: "34d399"))
                }

                Spacer()
            }
            .padding(.vertical, 4)
            .listRowBackground(Color(hex: "1a1a2e"))

            // Sync buttons
            HStack(spacing: 12) {
                Button {
                    Task { try? await appState.pull() }
                } label: {
                    HStack(spacing: 6) {
                        if appState.isSyncing {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.7)
                        } else {
                            Image(systemName: "arrow.down.circle.fill")
                        }
                        Text("Pull")
                    }
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color(hex: "6ec6ff").opacity(0.2))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color(hex: "6ec6ff").opacity(0.3), lineWidth: 0.5)
                            )
                    )
                }
                .disabled(appState.isSyncing)

                Button {
                    Task { try? await appState.push() }
                } label: {
                    HStack(spacing: 6) {
                        if appState.isSyncing {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.7)
                        } else {
                            Image(systemName: "arrow.up.circle.fill")
                        }
                        Text("Push")
                    }
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color(hex: "a78bfa").opacity(0.2))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color(hex: "a78bfa").opacity(0.3), lineWidth: 0.5)
                            )
                    )
                }
                .disabled(appState.isSyncing)
            }
            .listRowBackground(Color(hex: "1a1a2e"))

            // Sync message
            if let message = appState.syncMessage {
                HStack(spacing: 6) {
                    Image(systemName: "info.circle.fill")
                        .font(.system(size: 12))
                    Text(message)
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                }
                .foregroundStyle(Color(hex: "6ec6ff"))
                .listRowBackground(Color(hex: "1a1a2e"))
            }

            // Logout
            Button {
                appState.logout()
            } label: {
                HStack {
                    Spacer()
                    Text("ログアウト")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(.red.opacity(0.8))
                    Spacer()
                }
            }
            .listRowBackground(Color(hex: "1a1a2e"))
        }
    }

    // MARK: - Helpers
    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12))
            Text(title)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
        }
        .foregroundStyle(Color.white.opacity(0.4))
        .textCase(.uppercase)
    }
}

#Preview {
    NavigationStack {
        SettingsView()
            .environmentObject(AppState())
    }
}
