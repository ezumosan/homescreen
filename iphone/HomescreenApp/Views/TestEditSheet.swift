import SwiftUI

struct TestEditSheet: View {
    let existingTest: TestItem?
    let onSave: (TestItem) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var selectedBlockId: String
    @State private var selectedDate: Date
    @State private var unit: String

    init(existingTest: TestItem? = nil, onSave: @escaping (TestItem) -> Void) {
        self.existingTest = existingTest
        self.onSave = onSave
        _selectedBlockId = State(initialValue: existingTest?.blockId ?? ScheduleData.allBlockIds.first ?? "I-a")
        _selectedDate = State(initialValue: existingTest?.dateValue ?? Date())
        _unit = State(initialValue: existingTest?.unit ?? "")
    }

    private var isEditMode: Bool { existingTest != nil }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "0f0f1a").ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Subject picker
                        VStack(alignment: .leading, spacing: 8) {
                            sectionLabel("科目")

                            Menu {
                                ForEach(ScheduleData.allBlockIds, id: \.self) { blockId in
                                    Button {
                                        selectedBlockId = blockId
                                    } label: {
                                        HStack {
                                            Text(blockId)
                                            if blockId == selectedBlockId {
                                                Image(systemName: "checkmark")
                                            }
                                        }
                                    }
                                }
                            } label: {
                                HStack {
                                    Circle()
                                        .fill(GroupColors.color(for: selectedBlockId))
                                        .frame(width: 10, height: 10)
                                    Text(selectedBlockId)
                                        .font(.system(size: 16, weight: .medium, design: .rounded))
                                        .foregroundStyle(.white)
                                    Spacer()
                                    Image(systemName: "chevron.up.chevron.down")
                                        .font(.system(size: 12))
                                        .foregroundStyle(Color.white.opacity(0.4))
                                }
                                .padding(14)
                                .background(cardBackground)
                            }
                        }

                        // Date picker
                        VStack(alignment: .leading, spacing: 8) {
                            sectionLabel("日付")

                            DatePicker(
                                "",
                                selection: $selectedDate,
                                displayedComponents: .date
                            )
                            .datePickerStyle(.graphical)
                            .tint(GroupColors.color(for: selectedBlockId))
                            .colorScheme(.dark)
                            .padding(14)
                            .background(cardBackground)
                        }

                        // Unit field
                        VStack(alignment: .leading, spacing: 8) {
                            sectionLabel("範囲・内容")

                            TextField("例: 第3章まで", text: $unit)
                                .font(.system(size: 16, weight: .medium, design: .rounded))
                                .foregroundStyle(.white)
                                .padding(14)
                                .background(cardBackground)
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle(isEditMode ? "テストを編集" : "テストを追加")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color(hex: "0f0f1a"), for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") {
                        dismiss()
                    }
                    .foregroundStyle(Color.white.opacity(0.6))
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        saveTest()
                    }
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(GroupColors.color(for: selectedBlockId))
                }
            }
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

    private func saveTest() {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateStr = formatter.string(from: selectedDate)

        let test = TestItem(
            id: existingTest?.id ?? UUID().uuidString,
            blockId: selectedBlockId,
            date: dateStr,
            unit: unit.isEmpty ? "未設定" : unit
        )
        onSave(test)
        dismiss()
    }
}

#Preview {
    TestEditSheet { test in
        print("Saved: \(test)")
    }
}
