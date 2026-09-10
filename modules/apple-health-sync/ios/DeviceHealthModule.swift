import ExpoModulesCore
import HealthKit

public final class DeviceHealthModule: Module {
  private let store = HKHealthStore()
  private struct Metric {
    let type: HKQuantityTypeIdentifier
    let unit: HKUnit
    let sum: Bool
    let scale: Double
    init(_ type: HKQuantityTypeIdentifier, _ unit: HKUnit, _ sum: Bool = false, _ scale: Double = 1) {
      self.type = type; self.unit = unit; self.sum = sum; self.scale = scale
    }
  }
  private static var metrics: [String: Metric] { [
    "steps": Metric(.stepCount, .count(), true),
    "active-energy-burned": Metric(.activeEnergyBurned, .kilocalorie(), true),
    "active-minutes": Metric(.appleExerciseTime, .minute(), true),
    "distance": Metric(.distanceWalkingRunning, .meterUnit(with: .kilo), true),
    "floors": Metric(.flightsClimbed, .count(), true),
    "heart-rate": Metric(.heartRate, .count().unitDivided(by: .minute())),
    "daily-resting-heart-rate": Metric(.restingHeartRate, .count().unitDivided(by: .minute())),
    "daily-heart-rate-variability": Metric(.heartRateVariabilitySDNN, .secondUnit(with: .milli)),
    "daily-vo2-max": Metric(.vo2Max, HKUnit(from: "ml/kg*min")),
    "weight": Metric(.bodyMass, .gramUnit(with: .kilo)),
    "body-fat": Metric(.bodyFatPercentage, .percent(), false, 100),
    "core-body-temperature": Metric(.bodyTemperature, .degreeCelsius()),
    "blood-glucose": Metric(.bloodGlucose, HKUnit(from: "mg/dL")),
    "daily-oxygen-saturation": Metric(.oxygenSaturation, .percent(), false, 100),
    "daily-respiratory-rate": Metric(.respiratoryRate, .count().unitDivided(by: .minute())),
    "nutrition-log": Metric(.dietaryEnergyConsumed, .kilocalorie(), true),
    "hydration-log": Metric(.dietaryWater, .literUnit(with: .milli), true)
  ] }

  public func definition() -> ModuleDefinition {
    Name("OpenFitDeviceHealth")
    AsyncFunction("isAvailable") { HKHealthStore.isHealthDataAvailable() }
    AsyncFunction("requestReadAuthorization") { (promise: Promise) in
      var types = Set(Self.metrics.values.compactMap { HKObjectType.quantityType(forIdentifier: $0.type) as HKObjectType? })
      types.insert(HKObjectType.workoutType())
      types.insert(HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!)
      types.insert(HKObjectType.quantityType(forIdentifier: .basalEnergyBurned)!)
      DispatchQueue.main.async {
        self.store.requestAuthorization(toShare: [], read: types) { success, error in
          if let error { promise.reject("HEALTH_PERMISSION", error.localizedDescription) }
          else if !success { promise.reject("HEALTH_PERMISSION", "Apple Health could not complete the permission request.") }
          else { promise.resolve(nil) }
        }
      }
    }
    AsyncFunction("read") { (ids: [String], start: String, end: String, promise: Promise) in
      let formatter = ISO8601DateFormatter()
      formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      guard let start = formatter.date(from: start), let end = formatter.date(from: end), end > start else {
        promise.reject("HEALTH_RANGE", "Invalid health date range."); return
      }
      Task {
        var metrics: [[String: Any]] = []
        for id in ids {
          do {
            if id == "total-calories" {
              let active = try await self.quantity(Metric(.activeEnergyBurned, .kilocalorie(), true), start, end)
              let basal = try await self.quantity(Metric(.basalEnergyBurned, .kilocalorie(), true), start, end)
              let total = (active.value == nil && basal.value == nil) ? nil : (active.value ?? 0) + (basal.value ?? 0)
              var dates: [String: Double] = [:]
              for day in active.days + basal.days { dates[day["date"] as! String, default: 0] += day["value"] as! Double }
              metrics.append(["id": id, "value": total as Any? ?? NSNull(), "dailyValues": dates.sorted { $0.key < $1.key }.map { ["date": $0.key, "value": $0.value] as [String: Any] }])
            } else if let metric = Self.metrics[id] {
              let result = try await self.quantity(metric, start, end)
              metrics.append(["id": id, "value": result.value as Any? ?? NSNull(), "dailyValues": result.days])
            } else {
              metrics.append(["id": id, "value": NSNull(), "error": "This metric is not available from Apple Health."])
            }
          } catch {
            metrics.append(["id": id, "value": NSNull(), "error": error.localizedDescription])
          }
        }
        do {
          let workouts = try await self.samples(HKObjectType.workoutType(), start, end).compactMap { $0 as? HKWorkout }
          let sleep = try await self.samples(HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!, start, end).compactMap { $0 as? HKCategorySample }
          let exercises: [[String: Any]] = workouts.map { w in [
            "id": w.uuid.uuidString, "name": w.metadata?[HKMetadataKeyWorkoutBrandName] as? String ?? "Workout",
            "type": String(w.workoutActivityType.rawValue), "startTime": formatter.string(from: w.startDate),
            "endTime": formatter.string(from: w.endDate), "activeMinutes": w.duration / 60,
            "caloriesKcal": w.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie()) as Any? ?? NSNull(),
            "distanceKm": w.totalDistance?.doubleValue(for: .meterUnit(with: .kilo)) as Any? ?? NSNull(), "steps": NSNull()
          ] }
          // Merge overlapping asleep segments from multiple sources before grouping sessions.
          let asleepValues: Set<Int> = [1, 3, 4, 5]
          let segments = sleep.filter { asleepValues.contains($0.value) }.map { (max(start, $0.startDate), min(end, $0.endDate)) }.filter { $0.1 > $0.0 }.sorted { $0.0 < $1.0 }
          var merged: [(Date, Date)] = []
          for segment in segments {
            if let last = merged.last, segment.0 <= last.1 {
              merged[merged.count - 1].1 = max(last.1, segment.1)
            } else { merged.append(segment) }
          }
          var sessions: [(Date, Date, Double)] = []
          for segment in merged {
            let minutes = segment.1.timeIntervalSince(segment.0) / 60
            if let last = sessions.last, segment.0.timeIntervalSince(last.1) < 90 * 60 {
              sessions[sessions.count - 1] = (last.0, segment.1, last.2 + minutes)
            } else { sessions.append((segment.0, segment.1, minutes)) }
          }
          let sleeps: [[String: Any]] = sessions.reversed().map { session in [
            "id": formatter.string(from: session.0), "kind": "sleep", "startTime": formatter.string(from: session.0),
            "endTime": formatter.string(from: session.1), "minutesAsleep": session.2, "minutesInSleepPeriod": session.1.timeIntervalSince(session.0) / 60
          ] }
          promise.resolve(["metrics": metrics, "exercises": exercises, "sleepSessions": sleeps])
        } catch { promise.reject("HEALTH_READ", error.localizedDescription) }
      }
    }
  }

  private func samples(_ type: HKSampleType, _ start: Date, _ end: Date) async throws -> [HKSample] {
    try await withCheckedThrowingContinuation { continuation in
      let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
      let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
        if let error { continuation.resume(throwing: error) }
        else { continuation.resume(returning: samples ?? []) }
      }
      store.execute(query)
    }
  }

  private func quantity(_ metric: Metric, _ start: Date, _ end: Date) async throws -> (value: Double?, days: [[String: Any]]) {
    guard let type = HKObjectType.quantityType(forIdentifier: metric.type) else { return (nil, []) }
    return try await withCheckedThrowingContinuation { continuation in
      let options: HKStatisticsOptions = metric.sum ? .cumulativeSum : .discreteAverage
      let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [.strictStartDate])
      let query = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: predicate, options: options,
        anchorDate: Calendar.current.startOfDay(for: start), intervalComponents: DateComponents(day: 1))
      query.initialResultsHandler = { _, result, error in
        if let error { continuation.resume(throwing: error); return }
        var days: [[String: Any]] = []
        let format = DateFormatter(); format.calendar = Calendar(identifier: .gregorian); format.locale = Locale(identifier: "en_US_POSIX"); format.dateFormat = "yyyy-MM-dd"
        result?.enumerateStatistics(from: start, to: end) { statistics, _ in
          let quantity = metric.sum ? statistics.sumQuantity() : statistics.averageQuantity()
          if let quantity {
            days.append(["date": format.string(from: statistics.startDate), "value": quantity.doubleValue(for: metric.unit) * metric.scale])
          }
        }
        let values = days.compactMap { $0["value"] as? Double }
        let value = values.isEmpty ? nil : values.reduce(0, +) / (metric.sum ? 1 : Double(values.count))
        continuation.resume(returning: (value, days))
      }
      store.execute(query)
    }
  }
}
