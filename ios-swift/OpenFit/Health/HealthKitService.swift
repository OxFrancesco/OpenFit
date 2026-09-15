import Foundation
import HealthKit

// Direct port of modules/apple-health-sync/ios/DeviceHealthModule.swift into an
// async service. Same metric map, daily-bucket statistics, workouts mapping
// and iOS sleep merging rules (spec §3.5).

struct HealthReadResult {
    var metrics: [HealthMetric]
    var exercises: [ExerciseSummary]
    var sleepSessions: [SleepSummary]
}

struct HKMetric {
    var type: HKQuantityTypeIdentifier
    var unit: HKUnit
    var isSum = false
    var scale: Double = 1
}

enum HealthKitError: LocalizedError {
    case unavailable
    case invalidRange

    var errorDescription: String? {
        switch self {
        case .unavailable: return "Apple Health is unavailable on this device."
        case .invalidRange: return "Invalid health date range."
        }
    }
}

final class HealthKitService {
    private let store = HKHealthStore()

    private static var metrics: [String: HKMetric] { [
        "steps": HKMetric(type: .stepCount, unit: .count(), isSum: true),
        "active-energy-burned": HKMetric(type: .activeEnergyBurned, unit: .kilocalorie(), isSum: true),
        "active-minutes": HKMetric(type: .appleExerciseTime, unit: .minute(), isSum: true),
        "distance": HKMetric(type: .distanceWalkingRunning, unit: .meterUnit(with: .kilo), isSum: true),
        "floors": HKMetric(type: .flightsClimbed, unit: .count(), isSum: true),
        "heart-rate": HKMetric(type: .heartRate, unit: .count().unitDivided(by: .minute())),
        "daily-resting-heart-rate": HKMetric(type: .restingHeartRate, unit: .count().unitDivided(by: .minute())),
        "daily-heart-rate-variability": HKMetric(type: .heartRateVariabilitySDNN, unit: .secondUnit(with: .milli)),
        "daily-vo2-max": HKMetric(type: .vo2Max, unit: HKUnit(from: "ml/kg*min")),
        "weight": HKMetric(type: .bodyMass, unit: .gramUnit(with: .kilo)),
        "body-fat": HKMetric(type: .bodyFatPercentage, unit: .percent(), scale: 100),
        "core-body-temperature": HKMetric(type: .bodyTemperature, unit: .degreeCelsius()),
        "blood-glucose": HKMetric(type: .bloodGlucose, unit: HKUnit(from: "mg/dL")),
        "daily-oxygen-saturation": HKMetric(type: .oxygenSaturation, unit: .percent(), scale: 100),
        "daily-respiratory-rate": HKMetric(type: .respiratoryRate, unit: .count().unitDivided(by: .minute())),
        "nutrition-log": HKMetric(type: .dietaryEnergyConsumed, unit: .kilocalorie(), isSum: true),
        "hydration-log": HKMetric(type: .dietaryWater, unit: .literUnit(with: .milli), isSum: true),
    ] }

    func isAvailable() -> Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    /// Read authorization for every metric + workouts + sleep + basal energy.
    func requestReadAuthorization() async throws {
        guard isAvailable() else { throw HealthKitError.unavailable }
        var types = Set(Self.metrics.values.compactMap { HKObjectType.quantityType(forIdentifier: $0.type) as HKObjectType? })
        types.insert(HKObjectType.workoutType())
        types.insert(HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!)
        types.insert(HKObjectType.quantityType(forIdentifier: .basalEnergyBurned)!)
        try await store.requestAuthorization(toShare: [], read: types)
    }

    func read(ids: [String], start: Date, end: Date) async throws -> HealthReadResult {
        guard isAvailable() else { throw HealthKitError.unavailable }
        guard end > start else { throw HealthKitError.invalidRange }

        var metrics: [HealthMetric] = []
        for id in ids {
            if id == "total-calories" {
                let def = MetricCatalog.def(for: id)!
                do {
                    let active = try await quantity(HKMetric(type: .activeEnergyBurned, unit: .kilocalorie(), isSum: true), start: start, end: end)
                    let basal = try await quantity(HKMetric(type: .basalEnergyBurned, unit: .kilocalorie(), isSum: true), start: start, end: end)
                    let total: Double? = (active.value == nil && basal.value == nil) ? nil : (active.value ?? 0) + (basal.value ?? 0)
                    var dates: [String: Double] = [:]
                    for day in active.days + basal.days {
                        if let v = day.value { dates[day.date, default: 0] += v }
                    }
                    let daily = dates.map { MetricDay(date: $0.key, value: $0.value) }
                        .sorted { $0.date > $1.date }
                    metrics.append(HealthMetric(id: id, label: def.label, value: total, unit: def.unit,
                                                status: total == nil ? .empty : .loaded, error: nil,
                                                dailyValues: daily))
                } catch {
                    metrics.append(errorMetric(id, def.label, error))
                }
            } else if let metric = Self.metrics[id] {
                let def = MetricCatalog.def(for: id)!
                do {
                    let result = try await quantity(metric, start: start, end: end)
                    metrics.append(HealthMetric(id: id, label: def.label, value: result.value, unit: def.unit,
                                                status: result.value == nil ? .empty : .loaded, error: nil,
                                                dailyValues: result.days.sorted { $0.date > $1.date }))
                } catch {
                    metrics.append(errorMetric(id, def.label, error))
                }
            } else if let def = MetricCatalog.def(for: id) {
                metrics.append(HealthMetric(id: id, label: def.label, value: nil, unit: def.unit,
                                            status: .error,
                                            error: "This metric is not available from Apple Health.",
                                            dailyValues: nil))
            }
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let workouts = try await samples(HKObjectType.workoutType(), start: start, end: end)
            .compactMap { $0 as? HKWorkout }
        let exercises: [ExerciseSummary] = workouts.map { w in
            ExerciseSummary(
                id: w.uuid.uuidString,
                name: (w.metadata?[HKMetadataKeyWorkoutBrandName] as? String) ?? Self.workoutName(w.workoutActivityType),
                type: String(w.workoutActivityType.rawValue),
                startTime: formatter.string(from: w.startDate),
                endTime: formatter.string(from: w.endDate),
                activeMinutes: w.duration / 60,
                caloriesKcal: w.statistics(for: HKQuantityType(.activeEnergyBurned))?
                    .sumQuantity()?.doubleValue(for: .kilocalorie()),
                distanceKm: w.totalDistance?.doubleValue(for: .meterUnit(with: .kilo)),
                steps: nil
            )
        }

        // iOS sleep merging (spec §3.5): asleep variants {1,3,4,5}, read from
        // start−36h, merge overlapping segments, group with <90 min gaps.
        let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!
        let sleepSamples = try await samples(sleepType, start: start.addingTimeInterval(-36 * 60 * 60), end: end)
            .compactMap { $0 as? HKCategorySample }
        let asleepValues: Set<Int> = [1, 3, 4, 5]
        let segments = sleepSamples
            .filter { asleepValues.contains($0.value) }
            .map { ($0.startDate, min(end, $0.endDate)) }
            .filter { $0.1 > $0.0 }
            .sorted { $0.0 < $1.0 }
        var merged: [(Date, Date)] = []
        for segment in segments {
            if let last = merged.last, segment.0 <= last.1 {
                merged[merged.count - 1].1 = max(last.1, segment.1)
            } else {
                merged.append(segment)
            }
        }
        var sessions: [(Date, Date, Double)] = []
        for segment in merged {
            let minutes = segment.1.timeIntervalSince(segment.0) / 60
            if let last = sessions.last, segment.0.timeIntervalSince(last.1) < 90 * 60 {
                sessions[sessions.count - 1] = (last.0, segment.1, last.2 + minutes)
            } else {
                sessions.append((segment.0, segment.1, minutes))
            }
        }
        let sleeps: [SleepSummary] = sessions
            .filter { $0.1 > start }
            .reversed()
            .map { session in
                SleepSummary(id: formatter.string(from: session.0), kind: "sleep",
                             startTime: formatter.string(from: session.0),
                             endTime: formatter.string(from: session.1),
                             minutesAsleep: session.2,
                             minutesInSleepPeriod: session.1.timeIntervalSince(session.0) / 60)
            }

        return HealthReadResult(metrics: metrics, exercises: dedupeExercises(exercises), sleepSessions: sleeps)
    }

    private func errorMetric(_ id: String, _ label: String, _ error: Error) -> HealthMetric {
        HealthMetric(id: id, label: label, value: nil, unit: MetricCatalog.def(for: id)?.unit ?? "",
                     status: .error, error: error.localizedDescription, dailyValues: nil)
    }

    /// Two apps often write the same session; records of the same type whose
    /// start and end fall within a minute of each other are one workout.
    private func dedupeExercises(_ exercises: [ExerciseSummary]) -> [ExerciseSummary] {
        let tolerance: TimeInterval = 60
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        func parse(_ s: String?) -> Date? { s.flatMap { iso.date(from: $0) } }
        func detail(_ e: ExerciseSummary) -> Int {
            (e.caloriesKcal != nil ? 1 : 0) + (e.distanceKm != nil ? 1 : 0)
                + (e.steps != nil ? 1 : 0) + (e.name != "Workout" ? 1 : 0)
        }
        func near(_ a: String?, _ b: String?) -> Bool {
            guard let da = parse(a), let db = parse(b) else { return false }
            return abs(da.timeIntervalSince(db)) <= tolerance
        }
        var kept: [ExerciseSummary] = []
        for exercise in exercises {
            if let index = kept.firstIndex(where: {
                $0.type == exercise.type && near($0.startTime, exercise.startTime) && near($0.endTime, exercise.endTime)
            }) {
                if detail(exercise) > detail(kept[index]) { kept[index] = exercise }
            } else {
                kept.append(exercise)
            }
        }
        return kept
    }

    private func samples(_ type: HKSampleType, start: Date, end: Date) async throws -> [HKSample] {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate,
                                      limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: samples ?? [])
                }
            }
            store.execute(query)
        }
    }

    private func quantity(_ metric: HKMetric, start: Date, end: Date) async throws -> (value: Double?, days: [MetricDay]) {
        guard let type = HKObjectType.quantityType(forIdentifier: metric.type) else { return (nil, []) }
        let options: HKStatisticsOptions = metric.isSum ? .cumulativeSum : .discreteAverage
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [.strictStartDate])
        let anchor = Calendar.current.startOfDay(for: start)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: predicate,
                                                    options: options, anchorDate: anchor,
                                                    intervalComponents: DateComponents(day: 1))
            query.initialResultsHandler = { _, result, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                var days: [MetricDay] = []
                let format = DateFormatter()
                format.calendar = Calendar(identifier: .gregorian)
                format.locale = Locale(identifier: "en_US_POSIX")
                format.dateFormat = "yyyy-MM-dd"
                result?.enumerateStatistics(from: start, to: end) { statistics, _ in
                    let quantity = metric.isSum ? statistics.sumQuantity() : statistics.averageQuantity()
                    if let quantity {
                        days.append(MetricDay(date: format.string(from: statistics.startDate),
                                              value: quantity.doubleValue(for: metric.unit) * metric.scale))
                    }
                }
                let values = days.compactMap(\.value)
                let value = values.isEmpty ? nil : values.reduce(0, +) / (metric.isSum ? 1 : Double(values.count))
                continuation.resume(returning: (value, days))
            }
            store.execute(query)
        }
    }

    /// Human-readable workout names (improvement over "Workout" fallback).
    static func workoutName(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return "Running"
        case .walking: return "Walking"
        case .cycling: return "Cycling"
        case .swimming: return "Swimming"
        case .hiking: return "Hiking"
        case .yoga: return "Yoga"
        case .functionalStrengthTraining: return "Strength Training"
        case .traditionalStrengthTraining: return "Strength Training"
        case .highIntensityIntervalTraining: return "HIIT"
        case .elliptical: return "Elliptical"
        case .rowing: return "Rowing"
        case .stairClimbing: return "Stair Climbing"
        case .pilates: return "Pilates"
        case .dance: return "Dance"
        case .coreTraining: return "Core Training"
        case .crossTraining: return "Cross Training"
        case .mixedCardio: return "Cardio"
        case .tennis: return "Tennis"
        case .basketball: return "Basketball"
        case .soccer: return "Soccer"
        case .golf: return "Golf"
        case .boxing: return "Boxing"
        case .martialArts: return "Martial Arts"
        case .skatingSports: return "Skating"
        case .snowSports: return "Snow Sports"
        case .surfingSports: return "Surfing"
        case .mindAndBody: return "Mind & Body"
        case .other: return "Workout"
        default: return "Workout"
        }
    }
}
