import SwiftUI
import SwiftData

enum AppRoute: Hashable {
    case account, privacy, terms, support
}

private struct SelectedTabKey: EnvironmentKey {
    static let defaultValue: Binding<Int> = .constant(0)
}
extension EnvironmentValues {
    var selectedTab: Binding<Int> {
        get { self[SelectedTabKey.self] }
        set { self[SelectedTabKey.self] = newValue }
    }
}

@main
struct OpenFitApp: App {
    @StateObject private var accountStore = AccountStore()
    @StateObject private var prefsStore = DashboardPrefsStore()
    @StateObject private var fitnessStore = FitnessStore()
    @StateObject private var healthStore: HealthStore

    init() {
        let account = AccountStore()
        _accountStore = StateObject(wrappedValue: account)
        _healthStore = StateObject(wrappedValue: HealthStore(accountStore: account))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(accountStore)
                .environmentObject(prefsStore)
                .environmentObject(healthStore)
                .environmentObject(fitnessStore)
                .modelContainer(fitnessStore.container)
        }
    }
}

struct RootView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                DashboardView()
                    .appDestinations()
            }
            .tabItem { Label("Health", systemImage: "heart") }
            .tag(0)

            NavigationStack {
                FitnessView()
                    .appDestinations()
            }
            .tabItem { Label("Workouts", systemImage: "dumbbell.fill") }
            .tag(1)

            NavigationStack {
                SettingsView()
                    .appDestinations()
            }
            .tabItem { Label("Settings", systemImage: "gearshape") }
            .tag(2)
        }
        .tint(Theme.primary)
        .background(Theme.background)
        .environment(\.selectedTab, $selectedTab)
    }
}

extension View {
    func appDestinations() -> some View {
        navigationDestination(for: AppRoute.self) { route in
            switch route {
            case .account: AccountView()
            case .privacy: PrivacyView()
            case .terms: TermsView()
            case .support: SupportView()
            }
        }
    }
}
