import SwiftUI

struct HomeView: View {
    @EnvironmentObject var appState: AppState
    @State private var editingBlockId: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // MARK: - Clock & Date
                    clockSection

                    // MARK: - Status Pill
                    statusPill

                    // MARK: - Today's Schedule
                    scheduleSection

                    // MARK: - Upcoming Tests
                    if !upcomingTestsThisWeek.isEmpty {
                        upcomingTestsSection
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .background(Color.appBackground.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: editingBinding) { wrapper in
                SubjectEditView(blockId: wrapper.id)
                    .environmentObject(appState)
            }
        }
    }

    // MARK: - Clock Section
    private var clockSection: some View {
        VStack(spacing: 6) {
            Text(appState.timeString)
                .font(.system(size: 64, weight: .thin, design: .rounded))
                .foregroundStyle(Color.appTextPrimary)
                .monospacedDigit()
                .contentTransition(.numericText())

            Text(appState.dateString)
                .font(.system(size: 15, weight: .medium, design: .rounded))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 16)
    }

    // MARK: - Status Pill
    private var statusPill: some View {
        let status = appState.currentStatus
        let isInClass = status.periodIndex != nil

        return HStack(spacing: 8) {
            Image(systemName: status.icon)
                .font(.system(size: 13, weight: .semibold))
            Text(status.text)
                .font(.system(size: 14, weight: .semibold, design: .rounded))
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(
            Capsule()
                .fill(
                    isInClass
                        ? activeStatusColor.opacity(0.2)
                        : Color.appCard
                )
                .overlay(
                    Capsule()
                        .stroke(
                            isInClass
                                ? activeStatusColor.opacity(0.5)
                                : Color.appBorder,
                            lineWidth: 1
                        )
                )
        )
        .foregroundStyle(isInClass ? activeStatusColor : Color.appTextSecondary)
    }

    private var activeStatusColor: Color {
        guard let schedule = appState.todaySchedule,
              let idx = appState.currentStatus.periodIndex,
              idx < schedule.count else {
            return Color(hex: "6ec6ff")
        }
        return GroupColors.color(for: schedule[idx].blockId)
    }

    // MARK: - Schedule Section
    @ViewBuilder
    private var scheduleSection: some View {
        if let schedule = appState.todaySchedule {
            VStack(alignment: .leading, spacing: 10) {
                Text("今日の時間割")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.appTextSecondary)
                    .textCase(.uppercase)
                    .padding(.leading, 4)

                ForEach(schedule, id: \.period.id) { item in
                    let blockId = item.blockId
                    let period = item.period
                    let name = ScheduleData.displayName(blockId, names: appState.names)
                    let isActive = appState.currentStatus.periodIndex == period.id
                    let hasTest = blockHasUpcomingTest(blockId)
                    let color = GroupColors.color(for: blockId)

                    ClassRow(
                        period: period,
                        blockId: blockId,
                        displayName: name,
                        isActive: isActive,
                        hasTest: hasTest,
                        groupColor: color
                    )
                    .contentShape(Rectangle())
                    .onTapGesture {
                        openSubjectURL(blockId)
                    }
                    .onLongPressGesture {
                        editingBlockId = blockId
                    }
                }
            }
        } else {
            // Weekend / no classes
            VStack(spacing: 16) {
                Image(systemName: "moon.stars.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color(hex: "a78bfa"), Color(hex: "6ec6ff")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("今日は授業がありません")
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.appTextPrimary)

                Text("ゆっくり休んでください 🎉")
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 48)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.appCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(Color.appBorder, lineWidth: 0.5)
                    )
            )
        }
    }

    // MARK: - Upcoming Tests Section
    private var upcomingTestsThisWeek: [TestItem] {
        appState.upcomingTests.filter { ($0.daysUntil ?? Int.max) <= 7 }
    }

    private var upcomingTestsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: "fbbf24"))
                Text("テスト予定")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color(hex: "fbbf24"))
            }
            .padding(.leading, 4)

            ForEach(upcomingTestsThisWeek) { test in
                HStack(spacing: 10) {
                    Circle()
                        .fill(GroupColors.color(for: test.blockId))
                        .frame(width: 8, height: 8)

                    Text(ScheduleData.displayName(test.blockId, names: appState.names))
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.appTextPrimary)

                    Text(test.unit)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.appTextSecondary)

                    Spacer()

                    if let label = test.urgencyLabel {
                        Text(label)
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundStyle(urgencyColor(for: test))
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.appCard)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.appBorder, lineWidth: 0.5)
                        )
                )
            }
        }
    }

    // MARK: - Helpers
    private func blockHasUpcomingTest(_ blockId: String) -> Bool {
        appState.upcomingTests.contains { $0.blockId == blockId && ($0.daysUntil ?? Int.max) <= 7 }
    }

    private func openSubjectURL(_ blockId: String) {
        guard let urlString = ScheduleData.blockURL(blockId, urls: appState.urls),
              let url = URL(string: urlString) else { return }
        
        // Google Classroom のURLの場合は専用スキームで開けるか試す
        if urlString.contains("classroom.google.com") {
            let appSchemeString = urlString.replacingOccurrences(of: "https://", with: "googleclassroom://")
            if let appUrl = URL(string: appSchemeString), UIApplication.shared.canOpenURL(appUrl) {
                UIApplication.shared.open(appUrl)
                return
            }
        }
        
        UIApplication.shared.open(url)
    }

    private func urgencyColor(for test: TestItem) -> Color {
        guard let days = test.daysUntil else { return Color.appTextPrimary }
        if days == 0 { return Color.red }
        if days <= 3 { return Color(hex: "fbbf24") }
        return Color.appTextSecondary
    }

    // Binding wrapper for sheet presentation
    private var editingBinding: Binding<IdentifiableString?> {
        Binding(
            get: { editingBlockId.map { IdentifiableString(id: $0) } },
            set: { editingBlockId = $0?.id }
        )
    }
}

/// Helper for using String as sheet item
struct IdentifiableString: Identifiable {
    let id: String
}

#Preview {
    HomeView()
        .environmentObject(AppState())
}
