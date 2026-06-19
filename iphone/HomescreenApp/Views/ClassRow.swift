import SwiftUI

struct ClassRow: View {
    let period: Period
    let blockId: String
    let displayName: String
    let isActive: Bool
    let hasTest: Bool
    let groupColor: Color

    @State private var pulseOpacity: Double = 0.3

    var body: some View {
        HStack(spacing: 0) {
            // Left accent bar
            RoundedRectangle(cornerRadius: 2)
                .fill(groupColor)
                .frame(width: 4)
                .padding(.vertical, 4)

            HStack(spacing: 12) {
                // Period info
                VStack(alignment: .leading, spacing: 2) {
                    Text(period.label)
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text(period.timeString)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.white.opacity(0.5))
                }
                .frame(width: 80, alignment: .leading)

                // Subject name
                Text(displayName)
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundStyle(isActive ? groupColor : Color.appTextPrimary)
                    .lineLimit(1)

                Spacer()

                // Test indicator
                if hasTest {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 8, height: 8)
                        .shadow(color: .red.opacity(0.6), radius: 4)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
        }
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(
                    isActive
                        ? groupColor.opacity(0.12)
                        : Color.appCard
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(
                            isActive ? groupColor.opacity(0.4) : Color.appBorder,
                            lineWidth: isActive ? 1.5 : 0.5
                        )
                )
                .shadow(
                    color: isActive ? groupColor.opacity(pulseOpacity) : .clear,
                    radius: isActive ? 12 : 0,
                    y: 0
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .onAppear {
            guard isActive else { return }
            withAnimation(
                .easeInOut(duration: 1.8)
                .repeatForever(autoreverses: true)
            ) {
                pulseOpacity = 0.6
            }
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        ClassRow(
            period: ScheduleData.periods[0],
            blockId: "I-a",
            displayName: "現代の国語",
            isActive: true,
            hasTest: false,
            groupColor: GroupColors.color(for: "I-a")
        )
        ClassRow(
            period: ScheduleData.periods[1],
            blockId: "II-a",
            displayName: "数学I",
            isActive: false,
            hasTest: true,
            groupColor: GroupColors.color(for: "II-a")
        )
    }
    .padding()
    .background(Color(hex: "0f0f1a"))
}
