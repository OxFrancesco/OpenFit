#if DEBUG
import Foundation
import HealthKit

/// DEBUG-only: requests write access and fills HealthKit with ~14 days of
/// plausible samples so the dashboard is testable in the Simulator.
func seedSampleHealthData() async throws {
    let store = HKHealthStore()
    guard HKHealthStore.isHealthDataAvailable() else {
        throw NSError(domain: "OpenFit", code: 10,
                      userInfo: [NSLocalizedDescriptionKey: "Apple Health is unavailable on this device."])
    }

    let writeTypes: Set<HKSampleType> = [
        HKObjectType.quantityType(forIdentifier: .stepCount)!,
        HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
        HKObjectType.quantityType(forIdentifier: .basalEnergyBurned)!,
        HKObjectType.quantityType(forIdentifier: .appleExerciseTime)!,
        HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!,
        HKObjectType.quantityType(forIdentifier: .heartRate)!,
        HKObjectType.quantityType(forIdentifier: .bodyMass)!,
        HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
        HKObjectType.workoutType(),
    ]
    try await store.requestAuthorization(toShare: writeTypes, read: [])

    let calendar = Calendar.current
    let now = Date()
    var samples: [HKSample] = []

    func quantity(_ id: HKQuantityTypeIdentifier, _ value: Double, _ unit: HKUnit,
                  _ start: Date, _ end: Date) -> HKQuantitySample {
        HKQuantitySample(type: HKObjectType.quantityType(forIdentifier: id)!,
                         quantity: HKQuantity(unit: unit, doubleValue: value),
                         start: start, end: end)
    }

    for dayOffset in 0..<14 {
        guard let dayStart = calendar.date(byAdding: .day, value: -dayOffset, to: calendar.startOfDay(for: now)) else { continue }
        let isToday = dayOffset == 0

        // Steps: 4 samples/day, total ~6–12k
        var remainingSteps = Double.random(in: 6_000...12_000)
        for slot in 0..<4 {
            let share = slot == 3 ? remainingSteps : remainingSteps * Double.random(in: 0.15...0.35)
            remainingSteps -= share
            let start = dayStart.addingTimeInterval(TimeInterval((7 + slot * 4) * 3600))
            let end = start.addingTimeInterval(45 * 60)
            if isToday && start > now { continue }
            let clippedEnd = min(end, now)
            samples.append(quantity(.stepCount, share, .count(), start, clippedEnd))
        }

        // Active kcal ~300–600, basal ~1500/day spread across hours
        let active = Double.random(in: 300...600)
        for slot in 0..<6 {
            let start = dayStart.addingTimeInterval(TimeInterval((8 + slot * 2) * 3600))
            if isToday && start > now { continue }
            samples.append(quantity(.activeEnergyBurned, active / 6, .kilocalorie(), start, min(start.addingTimeInterval(3600), now)))
        }
        for slot in 0..<12 {
            let start = dayStart.addingTimeInterval(TimeInterval(slot * 2 * 3600))
            if isToday && start > now { continue }
            samples.append(quantity(.basalEnergyBurned, 1500 / 12, .kilocalorie(), start, min(start.addingTimeInterval(2 * 3600), now)))
        }

        // Exercise minutes ~20–45
        let exerciseStart = dayStart.addingTimeInterval(17 * 3600)
        if !isToday || exerciseStart < now {
            samples.append(quantity(.appleExerciseTime, Double.random(in: 20...45), .minute(),
                                    exerciseStart, min(exerciseStart.addingTimeInterval(3600), now)))
        }

        // Distance 4–9 km
        let distStart = dayStart.addingTimeInterval(9 * 3600)
        if !isToday || distStart < now {
            samples.append(quantity(.distanceWalkingRunning, Double.random(in: 4...9),
                                    .meterUnit(with: .kilo), distStart, min(distStart.addingTimeInterval(3600), now)))
        }

        // Heart rate samples 60–110 bpm, a few per day
        for slot in 0..<5 {
            let start = dayStart.addingTimeInterval(TimeInterval((8 + slot * 3) * 3600))
            if isToday && start > now { continue }
            samples.append(quantity(.heartRate, Double.random(in: 60...110),
                                    .count().unitDivided(by: .minute()), start, min(start.addingTimeInterval(60), now)))
        }

        // Weight ~72 kg, every few days
        if dayOffset % 4 == 0 {
            let start = dayStart.addingTimeInterval(7 * 3600)
            if !isToday || start < now {
                samples.append(quantity(.bodyMass, 72 + Double.random(in: -0.8...0.8),
                                        .gramUnit(with: .kilo), start, start))
            }
        }

        // Sleep: 23:00 previous night → 06:45 this morning, asleep segments
        guard let nightStart = calendar.date(byAdding: .hour, value: -1, to: dayStart) else { continue }
        let segments: [(Int, HKCategoryValueSleepAnalysis)] = [
            (0, .asleepCore), (90 * 60, .asleepDeep), (150 * 60, .asleepCore),
            (240 * 60, .asleepREM), (300 * 60, .asleepCore), (420 * 60, .asleepDeep),
        ]
        var cursor = nightStart
        for (offsetMinutes, stage) in segments {
            let s = cursor
            let e = s.addingTimeInterval(TimeInterval(90 * 60))
            samples.append(HKCategorySample(type: HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
                                            value: stage.rawValue, start: s, end: e))
            cursor = e
            _ = offsetMinutes
        }
    }

    try await store.save(samples)

    // Workouts: 3 different types with kcal/distance
    let workoutSpecs: [(HKWorkoutActivityType, Double, Double?, TimeInterval)] = [
        (.running, 320, 5.2, 42 * 60),
        (.functionalStrengthTraining, 210, nil, 55 * 60),
        (.cycling, 480, 18.4, 60 * 60),
    ]
    var workouts: [HKWorkout] = []
    for (i, spec) in workoutSpecs.enumerated() {
        let end = now.addingTimeInterval(TimeInterval(-(i + 1) * 26 * 3600))
        let start = end.addingTimeInterval(-spec.3)
        let builder = HKWorkoutBuilder(healthStore: store, configuration: {
            let c = HKWorkoutConfiguration(); c.activityType = spec.0; return c
        }(), device: nil)
        try await builder.beginCollection(at: start)
        try await builder.addSamples([
            quantity(.activeEnergyBurned, spec.1, .kilocalorie(), start, end)
        ])
        if let km = spec.2 {
            try await builder.addSamples([
                quantity(.distanceWalkingRunning, km, .meterUnit(with: .kilo), start, end)
            ])
        }
        try await builder.endCollection(at: end)
        if let workout = try await builder.finishWorkout() {
            workouts.append(workout)
        }
    }
}
#endif
