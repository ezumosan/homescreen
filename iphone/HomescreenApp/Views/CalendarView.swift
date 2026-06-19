import SwiftUI

struct CalendarView: View {
    @EnvironmentObject var appState: AppState

    @State private var currentMonth = Date()
    @State private var selectedDate: Date?
    @State private var showingAddSheet = false
    @State private var editingTest: TestItem?

    private let calendar = Calendar.current
    private let weekdayLabels = ["月", "火", "水", "木", "金", "土", "日"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // MARK: - Month Header
                    monthHeader

                    // MARK: - Calendar Grid
                    calendarGrid

                    // MARK: - Upcoming Tests List
                    upcomingTestsList
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .background(Color(hex: "0f0f1a").ignoresSafeArea())
            .navigationTitle("カレンダー")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color(hex: "0f0f1a"), for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .sheet(isPresented: $showingAddSheet) {
                TestEditSheet(existingTest: nil) { test in
                    appState.addTest(test)
                }
            }
            .sheet(item: $editingTest) { test in
                TestEditSheet(existingTest: test) { updated in
                    appState.updateTest(updated)
                }
            }
        }
    }

    // MARK: - Month Header
    private var monthHeader: some View {
        HStack {
            Button {
                withAnimation(.easeInOut(duration: 0.3)) {
                    currentMonth = calendar.date(byAdding: .month, value: -1, to: currentMonth) ?? currentMonth
                }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.6))
                    .frame(width: 40, height: 40)
            }

            Spacer()

            VStack(spacing: 2) {
                Text(monthYearString)
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }

            Spacer()

            Button {
                withAnimation(.easeInOut(duration: 0.3)) {
                    currentMonth = calendar.date(byAdding: .month, value: 1, to: currentMonth) ?? currentMonth
                }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.6))
                    .frame(width: 40, height: 40)
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Calendar Grid
    private var calendarGrid: some View {
        VStack(spacing: 4) {
            // Weekday headers
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 4) {
                ForEach(weekdayLabels, id: \.self) { label in
                    Text(label)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.white.opacity(0.4))
                        .frame(height: 28)
                }
            }

            // Day cells
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 4) {
                ForEach(daysInMonth, id: \.self) { date in
                    if let date = date {
                        dayCell(for: date)
                    } else {
                        Color.clear
                            .frame(height: 52)
                    }
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(hex: "1a1a2e"))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
                )
        )
    }

    private func dayCell(for date: Date) -> some View {
        let day = calendar.component(.day, from: date)
        let isToday = calendar.isDateInToday(date)
        let testsOnDay = testsForDate(date)

        return Button {
            selectedDate = date
            if testsOnDay.isEmpty {
                showingAddSheet = true
            }
        } label: {
            VStack(spacing: 3) {
                Text("\(day)")
                    .font(.system(size: 14, weight: isToday ? .bold : .medium, design: .rounded))
                    .foregroundStyle(
                        isToday ? .white : Color.white.opacity(0.7)
                    )

                // Test dots
                if !testsOnDay.isEmpty {
                    HStack(spacing: 3) {
                        ForEach(testsOnDay.prefix(3)) { test in
                            Circle()
                                .fill(GroupColors.color(for: test.blockId))
                                .frame(width: 5, height: 5)
                        }
                    }
                } else {
                    Spacer()
                        .frame(height: 5)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(
                        isToday
                            ? Color.white.opacity(0.1)
                            : Color.clear
                    )
            )
        }
    }

    // MARK: - Upcoming Tests List
    private var upcomingTestsList: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("テスト一覧")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.white.opacity(0.4))
                    .textCase(.uppercase)

                Spacer()

                Button {
                    showingAddSheet = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(Color(hex: "6ec6ff"))
                }
            }
            .padding(.leading, 4)

            let sortedTests = appState.upcomingTests

            if sortedTests.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(Color(hex: "34d399").opacity(0.5))
                        Text("予定されているテストはありません")
                            .font(.system(size: 14, weight: .medium, design: .rounded))
                            .foregroundStyle(Color.white.opacity(0.4))
                    }
                    .padding(.vertical, 24)
                    Spacer()
                }
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(Color(hex: "1a1a2e"))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
                        )
                )
            } else {
                ForEach(sortedTests) { test in
                    testRow(test)
                }
            }
        }
    }

    private func testRow(_ test: TestItem) -> some View {
        HStack(spacing: 12) {
            // Color bar
            RoundedRectangle(cornerRadius: 2)
                .fill(GroupColors.color(for: test.blockId))
                .frame(width: 4, height: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text(ScheduleData.displayName(test.blockId, names: appState.names))
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)

                HStack(spacing: 6) {
                    Text(test.date)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.white.opacity(0.4))

                    if test.unit != "未設定" {
                        Text("·")
                            .foregroundStyle(Color.white.opacity(0.3))
                        Text(test.unit)
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundStyle(Color.white.opacity(0.4))
                    }
                }
            }

            Spacer()

            if let label = test.urgencyLabel {
                Text(label)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(urgencyColor(for: test))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(urgencyColor(for: test).opacity(0.15))
                    )
            }

            // Delete button
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    appState.deleteTest(id: test.id)
                }
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.red.opacity(0.6))
                    .frame(width: 32, height: 32)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color(hex: "1a1a2e"))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
                )
        )
        .contentShape(Rectangle())
        .onTapGesture {
            editingTest = test
        }
    }

    // MARK: - Helpers
    private var monthYearString: String {
        let y = calendar.component(.year, from: currentMonth)
        let m = calendar.component(.month, from: currentMonth)
        return "\(y)年\(m)月"
    }

    /// Returns an array of optional Dates for the calendar grid.
    /// nil entries represent empty cells before the first day.
    private var daysInMonth: [Date?] {
        let comps = calendar.dateComponents([.year, .month], from: currentMonth)
        guard let firstOfMonth = calendar.date(from: comps),
              let range = calendar.range(of: .day, in: .month, for: firstOfMonth) else {
            return []
        }

        // weekday: 1=Sun ... 7=Sat; convert to Monday-start: Mon=0..Sun=6
        let firstWeekday = calendar.component(.weekday, from: firstOfMonth)
        let offset = (firstWeekday + 5) % 7 // Mon-based offset

        var days: [Date?] = Array(repeating: nil, count: offset)
        for day in range {
            if let date = calendar.date(bySetting: .day, value: day, of: firstOfMonth) {
                days.append(date)
            }
        }
        return days
    }

    private func testsForDate(_ date: Date) -> [TestItem] {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateStr = formatter.string(from: date)
        return appState.tests.filter { $0.date == dateStr }
    }

    private func urgencyColor(for test: TestItem) -> Color {
        guard let days = test.daysUntil else { return .white }
        if days == 0 { return Color.red }
        if days <= 3 { return Color(hex: "fbbf24") }
        return Color.white.opacity(0.6)
    }
}

#Preview {
    CalendarView()
        .environmentObject(AppState())
}
