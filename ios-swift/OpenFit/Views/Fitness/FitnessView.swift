import SwiftUI
import UIKit
import SwiftData

// Port of src/components/fitness/fitness-screen.tsx (spec §2.2).

enum FitnessSection: String, CaseIterable {
    case exercises = "Exercises"
    case history = "History"
    case connections = "Connections"
}

struct FitnessView: View {
    @EnvironmentObject private var fitness: FitnessStore
    @EnvironmentObject private var account: AccountStore
    @EnvironmentObject private var health: HealthStore

    @State private var section: FitnessSection = .exercises
    @State private var query = ""
    @State private var muscle: String? = nil
    @State private var logExercise: Exercise?
    @State private var historyReload = 0

    private var results: [Exercise] {
        searchExercises(exerciseCatalog, query: query, muscle: muscle)
    }

    private var summary: (entries: Int, exercises: Int, volumeKg: Double) {
        fitness.weeklySummary()
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.four) {
                if section != .connections {
                    TrainingSummaryCard(entries: summary.entries,
                                        exercises: summary.exercises,
                                        volumeKg: summary.volumeKg)
                }

                Picker("Section", selection: $section) {
                    ForEach(FitnessSection.allCases, id: \.self) { s in
                        Text(s.rawValue).tag(s)
                    }
                }
                .pickerStyle(.segmented)

                switch section {
                case .exercises:
                    exerciseLibrary
                case .history:
                    VStack(spacing: Spacing.three) {
                        DeviceWorkoutsView(days: 7)
                        WorkoutHistoryView(reload: historyReload) {
                            section = .exercises
                        } onDeleted: {
                            historyReload += 1
                        } onLogAgain: { exerciseId in
                            if let e = catalogExercise(id: exerciseId) { logExercise = e }
                        }
                    }
                case .connections:
                    ConnectionsView()
                }
            }
            .padding(.horizontal, Spacing.three)
            .padding(.bottom, Spacing.six)
            .frame(maxWidth: maxContentWidth)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background)
        .navigationTitle("Workouts")
        .sheet(item: $logExercise) { exercise in
            NavigationStack {
                WorkoutLogFormView(exercise: exercise) {
                    historyReload += 1
                }
                .navigationTitle("Log exercise")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            logExercise = nil
                        } label: {
                            Image(systemName: "xmark")
                        }
                        .accessibilityLabel("Close workout form")
                    }
                }
            }
        }
    }

    // MARK: - Exercises

    private var exerciseLibrary: some View {
        VStack(spacing: Spacing.three) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(Theme.textSecondary)
                TextField("Search exercises", text: $query)
            }
            .padding(.horizontal, Spacing.three)
            .frame(minHeight: 50)
            .background(Theme.surfaceContainerHigh)
            .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
            .accessibilityLabel("Search exercises")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.two) {
                    muscleChip("All", selected: muscle == nil) { muscle = nil }
                    ForEach(exerciseMuscles, id: \.self) { m in
                        muscleChip(m, selected: muscle == m) {
                            muscle = (muscle == m) ? nil : m
                        }
                    }
                }
                .padding(.trailing, Spacing.three)
            }

            if results.isEmpty {
                EmptyStateView(icon: "magnifyingglass",
                               title: "No exercise found",
                               detail: "Try another name, muscle, or clear the current filter.")
            } else {
                LazyVStack(spacing: Spacing.two) {
                    ForEach(Array(results.enumerated()), id: \.element.id) { index, exercise in
                        ExerciseRow(exercise: exercise,
                                    logs: fitness.logs(for: exercise.id),
                                    first: index == 0)
                            .onTapGesture { logExercise = exercise }
                    }
                }
            }
        }
    }

    private func muscleChip(_ label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if selected { Image(systemName: "checkmark").font(.system(size: 11, weight: .semibold)) }
                Text(label).themed(.small)
            }
            .padding(.horizontal, Spacing.three)
            .padding(.vertical, Spacing.two)
            .frame(minHeight: 48)
            .background(selected ? Theme.secondaryContainer : .clear)
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Theme.separator, lineWidth: 0.5))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .foregroundStyle(Theme.text)
    }
}

// MARK: - This week summary

struct TrainingSummaryCard: View {
    var entries: Int
    var exercises: Int
    var volumeKg: Double

    var body: some View {
        VStack(spacing: Spacing.three) {
            HStack(spacing: Spacing.three) {
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(Theme.text)
                    .frame(width: 44, height: 44)
                    .background(Theme.secondaryContainer)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                Text("This week").themed(.smallBold)
                Spacer()
            }
            HStack(spacing: Spacing.two) {
                SummaryStat(value: "\(entries)", label: "Entries")
                SummaryStat(value: "\(exercises)", label: "Exercises")
                SummaryStat(value: formatAmount(volumeKg), label: "Volume kg")
            }
        }
        .padding(Spacing.three)
        .background(Theme.primaryContainer)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct SummaryStat: View {
    var value: String
    var label: String
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.half) {
            Text(value).themed(.metric)
            Text(label).themed(.caption, color: Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Exercise row

struct ExerciseRow: View {
    var exercise: Exercise
    var logs: [WorkoutLog]
    var first: Bool

    private var best: Double { personalBestKg(logs, exerciseId: exercise.id) }

    var body: some View {
        HStack(spacing: Spacing.three) {
            Image(systemName: exercise.category == "cardio" ? "figure.run" : "dumbbell.fill")
                .font(.system(size: 21))
                .foregroundStyle(Theme.text)
                .frame(width: 44, height: 44)
                .background(Theme.secondaryContainer)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            VStack(alignment: .leading, spacing: Spacing.half) {
                Text(exercise.name).themed(.default).lineLimit(1)
                Text("\(exercise.primaryMuscle) · \(exercise.equipment)")
                    .themed(.small, color: Theme.textSecondary).lineLimit(1)
                if let recent = logs.first {
                    Text("Last \(recent.sets)×\(recent.reps) at \(formatWeight(recent.weightKg, unit: recent.enteredUnit))"
                        + (best > recent.weightKg ? " · best \(formatWeight(best, unit: recent.enteredUnit))" : ""))
                        .themed(.caption, color: Theme.textSecondary).lineLimit(1)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 14))
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(Spacing.three)
        .background(Theme.card)
        .overlay(RoundedRectangle(cornerRadius: first ? 24 : 8, style: .continuous)
            .strokeBorder(Theme.separator, lineWidth: 0.5))
        .clipShape(RoundedRectangle(cornerRadius: first ? 24 : 8, style: .continuous))
        .accessibilityLabel("Log \(exercise.name)")
        .accessibilityHint("Opens a form for sets, reps, and weight")
    }
}

// MARK: - History

struct WorkoutHistoryView: View {
    var reload: Int
    var onBrowse: () -> Void
    var onDeleted: () -> Void
    var onLogAgain: (String) -> Void

    @EnvironmentObject private var fitness: FitnessStore

    private var logs: [WorkoutLog] { fitness.listLogs() }

    var body: some View {
        Group {
            if logs.isEmpty {
                EmptyStateView(icon: "list.bullet.clipboard",
                               title: "No workouts yet",
                               detail: "Choose an exercise and record your first sets, reps, and weight.",
                               actionLabel: "Browse exercises", onAction: onBrowse)
            } else {
                LazyVStack(spacing: Spacing.two) {
                    ForEach(logs, id: \.id) { log in
                        HistoryRow(log: log, onDeleted: onDeleted, onLogAgain: onLogAgain)
                    }
                }
            }
        }
        .id(reload)
    }
}

struct HistoryRow: View {
    var log: WorkoutLog
    var onDeleted: () -> Void
    var onLogAgain: (String) -> Void

    @EnvironmentObject private var fitness: FitnessStore
    @State private var confirmDelete = false
    @State private var deleteError: String?

    private var exercise: Exercise? { catalogExercise(id: log.exerciseId) }

    private var dateText: String {
        let f = DateFormatter()
        if Calendar.current.isDate(log.performedAt, equalTo: Date(), toGranularity: .year) {
            f.dateFormat = "MMM d"
        } else {
            f.dateFormat = "MMM d, yyyy"
        }
        return f.string(from: log.performedAt)
    }

    var body: some View {
        VStack(spacing: Spacing.three) {
            HStack(spacing: Spacing.two) {
                VStack(alignment: .leading, spacing: Spacing.half) {
                    Text(exercise?.name ?? "Exercise").themed(.smallBold).lineLimit(1)
                    Text(dateText).themed(.caption, color: Theme.textSecondary)
                }
                Spacer()
                Button { onLogAgain(log.exerciseId) } label: {
                    Text("Log again").themed(.caption)
                        .frame(minHeight: 48)
                        .padding(.horizontal, Spacing.two)
                }
                .accessibilityLabel("Log \(exercise?.name ?? "exercise") again")
                Button(role: .destructive) { confirmDelete = true } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 17))
                        .foregroundStyle(Theme.error)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Delete gym entry")
            }
            HStack(spacing: Spacing.two) {
                HistoryStat(label: "Sets × reps", value: "\(log.sets) × \(log.reps)")
                HistoryStat(label: "Weight", value: formatWeight(log.weightKg, unit: log.enteredUnit))
                HistoryStat(label: "Volume",
                            value: "\(Int(workoutVolumeKg(sets: log.sets, reps: log.reps, weightKg: log.weightKg).rounded())) kg")
            }
            if !log.notes.isEmpty {
                Text(log.notes).themed(.small, color: Theme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(Spacing.three)
        .background(Theme.card)
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .strokeBorder(Theme.separator, lineWidth: 0.5))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .alert("Delete gym entry?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                fitness.delete(log)
                onDeleted()
            }
        } message: {
            Text("This removes the entry from this device.")
        }
        .alert("Could not delete entry", isPresented: .constant(deleteError != nil)) {
            Button("OK") { deleteError = nil }
        } message: {
            Text(deleteError ?? "")
        }
    }
}

struct HistoryStat: View {
    var label: String
    var value: String
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.half) {
            Text(value).themed(.smallBold).monospacedDigit()
            Text(label).themed(.caption, color: Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Device workouts (spec §2.2 "From Apple Health")

struct DeviceWorkoutsView: View {
    var days: Int

    @EnvironmentObject private var health: HealthStore
    @State private var workouts: [ExerciseSummary] = []
    @State private var error: String?
    @State private var loaded = false

    var body: some View {
        if health.isConnected {
            VStack(spacing: Spacing.two) {
                HStack(alignment: .lastTextBaseline) {
                    Text("From Apple Health").themed(.smallBold)
                    Spacer()
                    Text("Last \(days) days").themed(.caption, color: Theme.textSecondary)
                }
                if let error {
                    Text(error).themed(.small, color: Theme.error)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else if loaded && workouts.isEmpty {
                    Text("No workouts recorded on this phone in the last \(days) days.")
                        .themed(.small, color: Theme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    ForEach(workouts) { workout in
                        DeviceWorkoutRow(workout: workout)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .onAppear { Task { await load() } }
        }
    }

    private func load() async {
        do {
            let snapshot = try await health.fetchSnapshot(days: days, metricIds: [])
            workouts = snapshot.exercises
            loaded = true
        } catch let e {
            error = e.localizedDescription
            loaded = true
        }
    }
}

struct DeviceWorkoutRow: View {
    var workout: ExerciseSummary

    private var stats: String {
        var parts: [String] = []
        if let m = workout.activeMinutes {
            let whole = Int(m.rounded())
            parts.append(whole >= 60 ? "\(whole / 60)h \(whole % 60)m" : "\(whole) min")
        }
        if let kcal = workout.caloriesKcal { parts.append("\(Int(kcal.rounded())) kcal") }
        if let km = workout.distanceKm {
            let f = NumberFormatter()
            f.maximumFractionDigits = 2
            parts.append("\(f.string(from: NSNumber(value: km)) ?? "\(km)") km")
        }
        return parts.joined(separator: " · ")
    }

    private var whenText: String {
        guard let s = workout.startTime else { return "" }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = iso.date(from: s) else { return s }
        let f = DateFormatter()
        f.dateFormat = "EEE, MMM d, HH:mm"
        return f.string(from: date)
    }

    var body: some View {
        HStack(spacing: Spacing.three) {
            Image(systemName: "figure.run")
                .font(.system(size: 18))
                .foregroundStyle(Theme.text)
                .frame(width: 40, height: 40)
                .background(Theme.secondaryContainer)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            VStack(alignment: .leading, spacing: Spacing.half) {
                Text(workout.name).themed(.smallBold).lineLimit(1)
                Text(whenText).themed(.caption, color: Theme.textSecondary)
            }
            Spacer()
            Text(stats)
                .themed(.small, color: Theme.textSecondary)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 140)
        }
        .padding(Spacing.three)
        .background(Theme.card)
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .strokeBorder(Theme.separator, lineWidth: 0.5))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - Connections (spec §2.2; Strava/Garmin are link-only stubs)

struct ConnectionsView: View {
    @EnvironmentObject private var account: AccountStore
    @EnvironmentObject private var health: HealthStore

    var body: some View {
        VStack(spacing: Spacing.two) {
            ProviderCard(
                name: "Device health",
                detail: "Apple Health on iPhone or Health Connect on Android",
                glyph: "G",
                status: health.isConnected ? "On this phone" : "Available",
                action: "Open Health",
                goToTab: health.isConnected ? 2 : 0
            )
            ProviderCard(
                name: "Garmin Connect",
                detail: "Connection only; activities are not imported. Garmin partner approval is required",
                glyph: "△",
                status: "Partner approval",
                action: "Partner details",
                url: "https://developer.garmin.com/gc-developer-program/activity-api/"
            )
            ProviderCard(
                name: "Strava",
                detail: "Connection only; activities are not imported. Written policy clearance is required",
                glyph: "▲",
                status: "Policy review",
                action: "Review policy",
                url: "https://www.strava.com/legal/api_policy"
            )
        }
    }
}

struct ProviderCard: View {
    var name: String
    var detail: String
    var glyph: String
    var status: String
    var action: String
    var url: String? = nil
    var goToTab: Int? = nil

    @Environment(\.selectedTab) private var selectedTab

    var body: some View {
        VStack(spacing: Spacing.three) {
            HStack(spacing: Spacing.three) {
                Text(glyph).themed(.smallBold)
                    .frame(width: 42, height: 42)
                    .background(Theme.secondaryContainer)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                VStack(alignment: .leading, spacing: Spacing.half) {
                    Text(name).themed(.smallBold)
                    Text(detail).themed(.small, color: Theme.textSecondary)
                }
                Spacer()
            }
            HStack {
                Text(status)
                    .themed(.caption, color: Theme.textSecondary)
                    .padding(.horizontal, Spacing.two)
                    .padding(.vertical, Spacing.one)
                    .background(Theme.secondaryContainer)
                    .clipShape(Capsule())
                Spacer()
                Button {
                    if let goToTab { selectedTab.wrappedValue = goToTab }
                    else if let url { UIApplication.shared.open(URL(string: url)!) }
                } label: {
                    Text(action)
                        .themed(.smallBold, color: Theme.background)
                        .frame(minHeight: 48)
                        .padding(.horizontal, Spacing.three)
                        .background(Theme.text)
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                }
                .accessibilityLabel("\(action) \(name)")
            }
        }
        .padding(Spacing.three)
        .background(Theme.card)
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .strokeBorder(Theme.separator, lineWidth: 0.5))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - Empty state

struct EmptyStateView: View {
    var icon: String
    var title: String
    var detail: String
    var actionLabel: String? = nil
    var onAction: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Spacing.two) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundStyle(Theme.textSecondary)
                .frame(width: 48, height: 48)
                .background(Theme.secondaryContainer)
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            Text(title).themed(.smallBold)
            Text(detail)
                .themed(.small, color: Theme.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)
            if let actionLabel, let onAction {
                Button(action: onAction) {
                    Text(actionLabel).themed(.smallBold)
                        .frame(minHeight: 48)
                        .padding(.horizontal, Spacing.three)
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .strokeBorder(Theme.separator, lineWidth: 0.5))
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.four)
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .strokeBorder(Theme.separator, lineWidth: 0.5))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
