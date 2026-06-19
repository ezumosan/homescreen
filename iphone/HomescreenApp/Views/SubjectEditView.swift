import SwiftUI

struct SubjectEditView: View {
    let blockId: String

    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var displayName: String = ""
    @State private var urlString: String = ""
    @State private var showSaved = false

    var body: some View {
        ZStack {
            Color(hex: "0f0f1a").ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    // Header with color indicator
                    HStack(spacing: 14) {
                        Circle()
                            .fill(GroupColors.color(for: blockId))
                            .frame(width: 36, height: 36)
                            .overlay(
                                Text(ScheduleData.groupBase(blockId))
                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                    .foregroundStyle(.white)
                            )
                            .shadow(color: GroupColors.color(for: blockId).opacity(0.4), radius: 8)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(blockId)
                                .font(.system(size: 20, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                            Text("科目情報の編集")
                                .font(.system(size: 13, weight: .medium, design: .rounded))
                                .foregroundStyle(Color.white.opacity(0.4))
                        }

                        Spacer()
                    }
                    .padding(.top, 8)

                    // Display Name
                    VStack(alignment: .leading, spacing: 8) {
                        sectionLabel("表示名")

                        TextField("例: 現代の国語", text: $displayName)
                            .font(.system(size: 16, weight: .medium, design: .rounded))
                            .foregroundStyle(.white)
                            .padding(14)
                            .background(cardBackground)
                    }

                    // URL
                    VStack(alignment: .leading, spacing: 8) {
                        sectionLabel("リンクURL")

                        TextField("https://...", text: $urlString)
                            .font(.system(size: 16, weight: .medium, design: .rounded))
                            .foregroundStyle(.white)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(14)
                            .background(cardBackground)

                        Text("授業ページのURLを設定すると、ホーム画面からタップで開けます")
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundStyle(Color.white.opacity(0.3))
                            .padding(.leading, 4)
                    }

                    // Save Button
                    Button {
                        appState.updateSubject(blockId: blockId, name: displayName, url: urlString)
                        withAnimation(.spring(response: 0.3)) {
                            showSaved = true
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            dismiss()
                        }
                    } label: {
                        HStack(spacing: 8) {
                            if showSaved {
                                Image(systemName: "checkmark.circle.fill")
                                Text("保存しました")
                            } else {
                                Image(systemName: "square.and.arrow.down")
                                Text("保存")
                            }
                        }
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(
                                    showSaved
                                        ? Color(hex: "34d399")
                                        : GroupColors.color(for: blockId)
                                )
                        )
                    }
                    .disabled(showSaved)
                }
                .padding(16)
            }
        }
        .navigationTitle("科目の編集")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color(hex: "0f0f1a"), for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear {
            displayName = appState.names[blockId] ?? ""
            urlString = appState.urls[blockId] ?? ""
        }
    }

    // MARK: - Helpers
    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .foregroundStyle(Color.white.opacity(0.4))
            .textCase(.uppercase)
            .padding(.leading, 4)
    }

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(Color(hex: "1a1a2e"))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
            )
    }
}

#Preview {
    NavigationStack {
        SubjectEditView(blockId: "I-a")
            .environmentObject(AppState())
    }
}
