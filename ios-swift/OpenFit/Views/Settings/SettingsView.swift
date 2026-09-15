import SwiftUI
import UIKit
import UniformTypeIdentifiers

// Port of src/app/settings.tsx + health-export-settings.tsx (spec §2.4/§2.7).

struct SettingsView: View {
    @EnvironmentObject private var account: AccountStore
    @EnvironmentObject private var health: HealthStore
    @EnvironmentObject private var prefsStore: DashboardPrefsStore
    @EnvironmentObject private var fitness: FitnessStore

    @State private var busy = false
    @State private var message: String?
    #if DEBUG
    @State private var seedMessage: String?
    #endif

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.four) {
                // Account card
                NavigationLink(value: AppRoute.account) {
                    HStack(spacing: Spacing.three) {
                        Image(systemName: "person.crop.circle")
                            .font(.system(size: 24))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(account.user?.fullName ?? "Sign in to OpenFit")
                                .themed(.default, color: Theme.onPrimaryContainer)
                            if let email = account.user?.email {
                                Text(email).themed(.small, color: Theme.onPrimaryContainer)
                            }
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(Theme.onPrimaryContainer)
                    }
                    .padding(Spacing.three)
                    .background(Theme.primaryContainer)
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                }
                .buttonStyle(.plain)

                // Apple Health section
                VStack(alignment: .leading, spacing: Spacing.three) {
                    Text("Apple Health").themed(.subtitle)
                    Button {
                        Task { await refresh() }
                    } label: {
                        Text("Choose permissions and refresh")
                            .themed(.smallBold, color: Theme.onPrimary)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .background(Theme.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    }
                    .disabled(busy || !account.isSignedIn)
                    .opacity(busy || !account.isSignedIn ? 0.5 : 1)

                    Button {
                        UIApplication.shared.open(URL(string: "x-apple-health://")!)
                    } label: {
                        Text("Manage health permissions")
                            .themed(.smallBold, color: Theme.primary)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .strokeBorder(Theme.primary, lineWidth: 1))
                    }
                    .disabled(busy)

                    Button("Disconnect device health") {
                        health.disconnect()
                        message = "Device health disconnected from OpenFit. You can also revoke permissions in your health app."
                    }
                    .themed(.smallBold, color: Theme.primary)
                    .disabled(busy)

                    if let message {
                        Text(message).themed(.small)
                            .accessibilityLabel("Status: \(message)")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                HealthExportSection()

                #if DEBUG
                VStack(alignment: .leading, spacing: Spacing.three) {
                    Text("Debug").themed(.subtitle)
                    Button("Seed sample health data (debug)") {
                        Task {
                            do {
                                try await seedSampleHealthData()
                                seedMessage = "Sample health data written to Apple Health."
                            } catch let e {
                                seedMessage = e.localizedDescription
                            }
                        }
                    }
                    .themed(.smallBold, color: Theme.primary)
                    if let seedMessage {
                        Text(seedMessage).themed(.small, color: Theme.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                #endif

                // Legal group
                VStack(spacing: 0) {
                    legalRow("Privacy", "lock.shield", .privacy)
                    legalRow("Terms", "doc.text", .terms)
                    legalRow("Support", "questionmark.circle", .support)
                }
                .background(Theme.surfaceContainer)
                .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            }
            .padding(.horizontal, Spacing.three)
            .padding(.top, Spacing.four)
            .padding(.bottom, Spacing.six)
            .frame(maxWidth: maxContentWidth)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background)
        .navigationTitle("Settings")
    }

    private func legalRow(_ title: String, _ icon: String, _ route: AppRoute) -> some View {
        NavigationLink(value: route) {
            HStack(spacing: Spacing.three) {
                Image(systemName: icon).foregroundStyle(Theme.textSecondary).frame(width: 24)
                Text(title).themed(.default)
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Theme.textSecondary)
            }
            .padding(Spacing.three)
        }
        .buttonStyle(.plain)
    }

    private func refresh() async {
        busy = true
        message = nil
        do {
            try await health.connect()
            _ = try await health.fetchSnapshot(days: 1, metricIds: prefsStore.prefs.widgetMetrics)
            message = "Health data and widgets refreshed. If data is missing, check permissions and the records in your health app."
        } catch let e {
            message = e.localizedDescription
        }
        busy = false
    }
}

// MARK: - Export for your AI (spec §2.7)

struct HealthExportSection: View {
    @EnvironmentObject private var health: HealthStore
    @EnvironmentObject private var prefsStore: DashboardPrefsStore
    @EnvironmentObject private var fitness: FitnessStore

    @State private var busy = false
    @State private var message: String?
    @State private var exportURL: URL?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.three) {
            Text("Export for your AI").themed(.subtitle)
            Text("Download a Markdown file with 30 days of available device health, all gym logs saved on this device, daily goals, and a ready-made prompt. Choose where to share it.")
                .themed(.small)

            if busy {
                HStack { ProgressView(); Text("Exporting…").themed(.small, color: Theme.textSecondary) }
            } else if let url = exportURL {
                ShareLink(item: url) {
                    Label("Share exported file", systemImage: "square.and.arrow.up")
                        .themed(.smallBold, color: Theme.onPrimary)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(Theme.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                }
            } else {
                Button { Task { await export() } } label: {
                    Label("Export Markdown", systemImage: "square.and.arrow.down")
                        .themed(.smallBold, color: Theme.onPrimary)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(Theme.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                }
            }

            Button {
                UIPasteboard.general.string = healthAIPrompt
                message = "Prompt copied. Attach the Markdown file in your AI chat."
            } label: {
                Label("Copy prompt", systemImage: "doc.on.doc")
                    .themed(.smallBold, color: Theme.primary)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .strokeBorder(Theme.primary, lineWidth: 1))
            }
            .disabled(busy)

            if let message {
                Text(message).themed(.small)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func export() async {
        busy = true
        message = nil
        let prefs = prefsStore.prefs
        let logs = fitness.listLogs(limit: -1)
        var snapshot: HealthSnapshot? = nil
        if health.isConnected {
            snapshot = try? await health.fetchSnapshot(
                days: 30,
                metricIds: MetricCatalog.all.filter { MetricCatalog.supports($0.id) }.map(\.id))
        }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let createdAt = iso.string(from: Date())
        let markdown = buildHealthMarkdown(HealthExportData(
            createdAt: createdAt,
            source: "Apple Health",
            snapshot: snapshot,
            healthUnavailable: "Device health is not connected. Connect it in Settings to include it.",
            goals: Array(Set(prefs.rings + Array(prefs.goals.keys))).compactMap { id in
                MetricCatalog.def(for: id).map {
                    (label: $0.label, value: prefs.goals[id] ?? MetricCatalog.defaultGoal(for: id), unit: $0.unit)
                }
            },
            workouts: logs.map { (log: $0, exerciseName: catalogExercise(id: $0.exerciseId)?.name ?? $0.exerciseId) }
        ))
        do {
            exportURL = try writeExportFile(markdown: markdown, createdAt: createdAt)
            if snapshot == nil {
                message = "Device health is disconnected. The file includes local gym logs and goals."
            }
        } catch let e {
            message = e.localizedDescription
        }
        busy = false
    }
}
