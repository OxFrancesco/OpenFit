import Foundation

struct MetricDay: Hashable {
    var date: String          // "yyyy-MM-dd" local
    var value: Double?
}

enum HealthMetricStatus: String {
    case loaded, empty, error
}

struct HealthMetric: Identifiable {
    var id: String
    var label: String
    var value: Double?
    var unit: String
    var status: HealthMetricStatus
    var error: String?
    var dailyValues: [MetricDay]?
}

struct ExerciseSummary: Identifiable, Hashable {
    var id: String
    var name: String
    var type: String
    var startTime: String?
    var endTime: String?
    var activeMinutes: Double?
    var caloriesKcal: Double?
    var distanceKm: Double?
    var steps: Double?
}

struct SleepSummary: Identifiable, Hashable {
    var id: String
    var kind: String          // "sleep" | "nap"
    var startTime: String?
    var endTime: String?
    var minutesAsleep: Double?
    var minutesInSleepPeriod: Double?
}

struct HealthSnapshot {
    var metrics: [HealthMetric]
    var exercises: [ExerciseSummary]
    /// Sleep sessions in the range, most recent first.
    var sleepSessions: [SleepSummary]
    var rangeLabel: String
}

func formatMetricValue(_ metric: HealthMetric) -> String {
    guard let value = metric.value else { return "--" }
    let digits = MetricCatalog.def(for: metric.id)?.fractionDigits ?? 0
    return formatAmount(value, fractionDigits: digits)
}
