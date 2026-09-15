import Foundation
import SwiftData
import Combine

// Port of the workout_logs table (src/lib/fitness-store.ts) and the log
// helpers in fitness-domain.ts.

@Model
final class WorkoutLog {
    @Attribute(.unique) var id: String
    var exerciseId: String
    var performedAt: Date
    var sets: Int
    var reps: Int
    var weightKg: Double
    var enteredUnitRaw: String
    var notes: String
    var createdAt: Date

    var enteredUnit: WeightUnit {
        get { WeightUnit(rawValue: enteredUnitRaw) ?? .kg }
        set { enteredUnitRaw = newValue.rawValue }
    }

    init(id: String = UUID().uuidString, exerciseId: String, performedAt: Date,
         sets: Int, reps: Int, weightKg: Double, enteredUnit: WeightUnit,
         notes: String = "", createdAt: Date = Date()) {
        self.id = id
        self.exerciseId = exerciseId
        self.performedAt = performedAt
        self.sets = sets
        self.reps = reps
        self.weightKg = weightKg
        self.enteredUnitRaw = enteredUnit.rawValue
        self.notes = notes
        self.createdAt = createdAt
    }
}

func workoutVolumeKg(sets: Int, reps: Int, weightKg: Double) -> Double {
    Double(sets * reps) * weightKg
}

func personalBestKg(_ logs: [WorkoutLog], exerciseId: String) -> Double {
    logs.reduce(0) { $1.exerciseId == exerciseId ? max($0, $1.weightKg) : $0 }
}

/// Exact validation messages from fitness-domain.ts.
func validateWorkoutInput(sets: Int?, reps: Int?, weightKg: Double?, notes: String) -> String? {
    guard let sets, sets >= 1, sets <= 99 else {
        return "Sets must be a whole number from 1 to 99."
    }
    guard let reps, reps >= 1, reps <= 999 else {
        return "Reps must be a whole number from 1 to 999."
    }
    guard let weightKg, weightKg.isFinite, weightKg >= 0, weightKg <= 1_000 else {
        return "Weight must be between 0 and 1,000 kg."
    }
    guard notes.count <= 500 else {
        return "Notes must be 500 characters or fewer."
    }
    return nil
}

@MainActor
final class FitnessStore: ObservableObject {
    let container: ModelContainer

    init(inMemory: Bool = false) {
        let config = ModelConfiguration(isStoredInMemoryOnly: inMemory)
        container = try! ModelContainer(for: WorkoutLog.self, configurations: config)
    }

    var context: ModelContext { container.mainContext }

    func listLogs(limit: Int = 100) -> [WorkoutLog] {
        var descriptor = FetchDescriptor<WorkoutLog>(
            sortBy: [SortDescriptor(\.performedAt, order: .reverse)]
        )
        if limit > 0 { descriptor.fetchLimit = limit }
        return (try? context.fetch(descriptor)) ?? []
    }

    func logs(for exerciseId: String) -> [WorkoutLog] {
        let predicate = #Predicate<WorkoutLog> { $0.exerciseId == exerciseId }
        let descriptor = FetchDescriptor<WorkoutLog>(predicate: predicate,
                                                   sortBy: [SortDescriptor(\.performedAt, order: .reverse)])
        return (try? context.fetch(descriptor)) ?? []
    }

    @discardableResult
    func save(exerciseId: String, performedAt: Date = Date(), sets: Int, reps: Int,
              weightKg: Double, enteredUnit: WeightUnit, notes: String) -> WorkoutLog {
        let log = WorkoutLog(exerciseId: exerciseId, performedAt: performedAt,
                             sets: sets, reps: reps, weightKg: weightKg,
                             enteredUnit: enteredUnit, notes: notes)
        context.insert(log)
        try? context.save()
        return log
    }

    func delete(_ log: WorkoutLog) {
        context.delete(log)
        try? context.save()
    }

    /// "This week" summary: entries/exercises/volume over the last 7 days.
    func weeklySummary(now: Date = Date()) -> (entries: Int, exercises: Int, volumeKg: Double) {
        let weekStart = now.addingTimeInterval(-7 * 24 * 60 * 60)
        let weekLogs = listLogs().filter { $0.performedAt >= weekStart }
        return (weekLogs.count,
                Set(weekLogs.map(\.exerciseId)).count,
                weekLogs.reduce(0) { $0 + workoutVolumeKg(sets: $1.sets, reps: $1.reps, weightKg: $1.weightKg) })
    }
}
