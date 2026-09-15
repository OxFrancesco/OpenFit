import SwiftUI

// Port of src/app/index.tsx (spec §2.1).

struct DashboardView: View {
    @EnvironmentObject private var account: AccountStore
    @EnvironmentObject private var health: HealthStore
    @EnvironmentObject private var prefsStore: DashboardPrefsStore

    @State private var snapshot: HealthSnapshot?
    @State private var connecting = false
    @State private var loadingHealth = false
    @State private var error: String?
    @State private var rangeDays = 1
    @State private var editingRingSlot: Int? = nil
    @State private var cardEditorOpen = false
    @State private var showDataDisclosure = false

    private static let rangeOptions: [(label: String, days: Int)] = [
        ("Today", 1), ("7D", 7), ("14D", 14), ("30D", 30), ("90D", 90),
    ]

    private var metricsMap: [String: HealthMetric] {
        Dictionary(uniqueKeysWithValues: (snapshot?.metrics ?? []).map { ($0.id, $0) })
    }

    private var neededIds: [String] {
        Array(Set(prefsStore.prefs.rings + prefsStore.prefs.cards
            + MetricCatalog.defaultRingIDs))
            .filter { $0 != MetricCatalog.sleepCardID }
    }

    private var ringSlots: [RingSlot] {
        prefsStore.prefs.rings.map { id in
            RingSlot(metricId: id,
                     value: metricsMap[id]?.value,
                     goal: prefsStore.goal(for: id))
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let daypart = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
        let name = account.user?.firstName ?? account.user?.fullName
        return name.map { "Good \(daypart), \($0)" } ?? "Good \(daypart)"
    }

    private var todayString: String {
        let f = DateFormatter()
        f.dateFormat = "EEEE, MMMM d"
        return f.string(from: Date())
    }

    var body: some View {
        Group {
            if !account.isSignedIn || !health.isConnected {
                gateScreen
            } else {
                dashboard
            }
        }
        .background(Theme.background)
        .navigationTitle("OpenFit")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: AppRoute.account) {
                    Image(systemName: "person.crop.circle")
                        .foregroundStyle(Theme.text)
                }
                .accessibilityLabel(account.user != nil ? "Your OpenFit account" : "Sign in to OpenFit")
            }
        }
        .onAppear { refresh() }
        .onChange(of: account.isSignedIn) { health.refreshConnection(); refresh() }
        .onChange(of: rangeDays) { reload() }
    }

    // MARK: - Gate (sign-in / connect)

    private var gateScreen: some View {
        ScrollView {
            VStack(spacing: Spacing.four) {
                Text("Health overview").themed(.title)
                    .frame(maxWidth: .infinity, alignment: .leading)

                VStack(spacing: 20) {
                    Image(systemName: "heart.text.square")
                        .font(.system(size: 40))
                        .foregroundStyle(Theme.onPrimaryContainer)
                    Text(account.isSignedIn ? "Connect Apple Health" : "Sign in to OpenFit")
                        .themed(.subtitle, color: Theme.onPrimaryContainer)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("Read activity, sleep, heart, body and nutrition data from this phone for your dashboard and widgets. Choose what to allow on the next screen.")
                        .themed(.default, color: Theme.onPrimaryContainer)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if connecting {
                        LoadingDots(color: Theme.primary)
                    } else if account.isSignedIn {
                        Button {
                            Task { await connect() }
                        } label: {
                            Text("Choose Apple Health permissions")
                                .themed(.smallBold, color: Theme.onPrimary)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(Theme.primary)
                                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        }
                    } else {
                        NavigationLink(value: AppRoute.account) {
                            Text("Sign in")
                                .themed(.smallBold, color: Theme.onPrimary)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(Theme.primary)
                                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        }
                    }
                }
                .padding(28)
                .background(Theme.primaryContainer)
                .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))

                if let error {
                    ErrorBanner(message: error)
                }

                DisclosureGroup(isExpanded: $showDataDisclosure) {
                    VStack(alignment: .leading, spacing: Spacing.three) {
                        Text("Health records are read on your phone. They are not uploaded for the dashboard or widgets. You can separately choose to share a health summary with the coach through Cloudflare AI.")
                        Text("Clerk manages sign-in. Coach messages are encrypted and retained for up to 90 days. Voice recordings go to ElevenLabs only when you use voice input. OpenFit does not sell health data or share it with advertisers.")
                    }
                    .themed(.small, color: Theme.textSecondary)
                    .padding(Spacing.four)
                } label: {
                    HStack {
                        Image(systemName: "lock.shield")
                        Text("How your data is used")
                    }
                    .themed(.default)
                }
                .padding(.horizontal, Spacing.two)
                .background(Theme.surfaceContainer)
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                .tint(Theme.text)

                HStack(spacing: Spacing.three) {
                    legalLink("Privacy", .privacy)
                    legalLink("Terms", .terms)
                    legalLink("Support", .support)
                }
            }
            .padding(24)
            .frame(maxWidth: maxContentWidth)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background)
    }

    private func legalLink(_ label: String, _ route: AppRoute) -> some View {
        NavigationLink(value: route) {
            Text(label).themed(.smallBold, color: Theme.primary)
        }
    }

    // MARK: - Dashboard

    private var dashboard: some View {
        ScrollView {
            VStack(spacing: Spacing.four) {
                // Header
                VStack(alignment: .leading, spacing: Spacing.half) {
                    Text(todayString)
                        .themed(.smallBold, color: Theme.textSecondary)
                    Text(greeting).themed(.title)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if let error {
                    ErrorBanner(message: error)
                }

                // Range segmented control
                Picker("Range", selection: $rangeDays) {
                    ForEach(Self.rangeOptions, id: \.days) { option in
                        Text(option.label).tag(option.days)
                    }
                }
                .pickerStyle(.segmented)

                // Activity rings
                SectionHeader(title: "Activity") {
                    Button("Edit") { editingRingSlot = 0 }
                        .themed(.smallBold)
                }
                VStack {
                    ActivityRingsView(slots: ringSlots, days: rangeDays) { slot in
                        editingRingSlot = slot
                    }
                }
                .padding(.vertical, Spacing.four)
                .padding(.horizontal, Spacing.three)
                .frame(maxWidth: .infinity)
                .background(Theme.card)
                .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))

                // Metrics grid
                SectionHeader(title: "Metrics") {
                    Button("Edit") { cardEditorOpen = true }
                        .themed(.smallBold)
                }
                if loadingHealth && snapshot == nil {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Spacing.three) {
                        ForEach(0..<4, id: \.self) { _ in SkeletonCard() }
                    }
                } else if prefsStore.prefs.cards.isEmpty {
                    Text("Choose the health metrics you want to see.")
                        .themed(.small, color: Theme.textSecondary)
                        .frame(maxWidth: .infinity)
                } else {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Spacing.three) {
                        ForEach(prefsStore.prefs.cards, id: \.self) { id in
                            if id == MetricCatalog.sleepCardID {
                                SleepCardView(sessions: snapshot?.sleepSessions ?? [])
                            } else if let def = MetricCatalog.def(for: id) {
                                MetricCardView(def: def, metric: metricsMap[id], days: rangeDays)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.three)
            .padding(.top, Spacing.three)
            .padding(.bottom, Spacing.six)
            .frame(maxWidth: maxContentWidth)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background)
        .refreshable { await loadHealth() }
        .sheet(isPresented: Binding(
            get: { editingRingSlot != nil },
            set: { if !$0 { editingRingSlot = nil } }
        )) {
            if let slot = editingRingSlot {
                SheetContainer {
                    RingEditorSheet(
                        slots: ringSlots,
                        editingSlot: slot,
                        onEditSlot: { editingRingSlot = $0 },
                        onSelectMetric: { s, id in prefsStore.setRingMetric(id, slot: s) },
                        onChangeGoal: { id, goal in prefsStore.setGoal(goal, for: id) }
                    )
                }
            }
        }
        .sheet(isPresented: $cardEditorOpen) {
            SheetContainer {
                CardEditorSheet(
                    selected: Binding(get: { prefsStore.prefs.cards },
                                      set: { _ in }),
                    onToggle: { prefsStore.toggleCard($0) },
                    onClose: { cardEditorOpen = false }
                )
            }
        }
    }

    // MARK: - Actions

    private func refresh() {
        health.refreshConnection()
        if health.isConnected {
            Task { await loadHealth() }
        }
    }

    private func connect() async {
        if !account.isSignedIn {
            error = nil
            return
        }
        connecting = true
        error = nil
        do {
            try await health.connect()
            await loadHealth()
        } catch let e {
            error = e.localizedDescription
        }
        connecting = false
    }

    private func reload() {
        guard health.isConnected else { return }
        snapshot = health.cachedSnapshot(days: rangeDays)
        Task { await loadHealth() }
    }

    private func loadHealth() async {
        guard health.isConnected else { return }
        loadingHealth = true
        error = nil
        do {
            let next = try await health.fetchSnapshot(days: rangeDays, metricIds: neededIds)
            snapshot = next
        } catch let e {
            error = e.localizedDescription
        }
        loadingHealth = false
    }
}

struct SectionHeader<Trailing: View>: View {
    var title: String
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .lastTextBaseline) {
            Text(title).themed(.subtitle)
            Spacer()
            trailing()
        }
    }
}

/// Dimmed-backdrop container matching the RN modal sheets.
struct SheetContainer<Content: View>: View {
    @ViewBuilder var content: () -> Content
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.black.opacity(0.4).ignoresSafeArea()
                .onTapGesture { dismiss() }
            content()
        }
        .presentationBackground(.clear)
    }
}
