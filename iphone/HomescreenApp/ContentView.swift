import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView {
            Tab("ホーム", systemImage: "house.fill") {
                HomeView()
            }

            Tab("カレンダー", systemImage: "calendar") {
                CalendarView()
            }
            Tab("設定", systemImage: "gearshape.fill") {
                NavigationStack {
                    SettingsView()
                }
            }
        }
        .tint(Color.appTextPrimary)
    }
}
