import Foundation

// Port of src/lib/metric-catalog.ts (spec §3.1). The `extract`/`field`/`kind`
// fields from the TS catalog describe Google Health API payloads and don't
// apply to the HealthKit-backed iOS port; aggregation, units, goals, icons
// and labels are preserved verbatim.

enum MetricCategory: String, CaseIterable {
    case activity = "Activity"
    case heart = "Heart"
    case body = "Body"
    case nutrition = "Nutrition"
    case sleep = "Sleep"
}

enum MetricAggregate {
    case sum, avg
}

struct RingGoal {
    var goal: Double
    var step: Double
}

struct MetricDef: Identifiable {
    var id: String
    var label: String
    var shortLabel: String?
    var unit: String
    var icon: String          // SF Symbol name
    var category: MetricCategory
    var aggregate: MetricAggregate
    var fractionDigits: Int = 0
    var ring: RingGoal?       // present when the metric can drive a ring
    var defaultCard = false

    var legendLabel: String { shortLabel ?? label }
}

enum MetricCatalog {
    static let all: [MetricDef] = [
        // Activity
        .init(id: "steps", label: "Steps", shortLabel: nil, unit: "steps", icon: "figure.walk",
              category: .activity, aggregate: .sum, ring: .init(goal: 10_000, step: 500)),
        .init(id: "active-energy-burned", label: "Active calories", shortLabel: "Active calories", unit: "kcal",
              icon: "flame.fill", category: .activity, aggregate: .sum, ring: .init(goal: 500, step: 50)),
        .init(id: "total-calories", label: "Total calories", shortLabel: "Total kcal", unit: "kcal",
              icon: "flame", category: .activity, aggregate: .sum, ring: .init(goal: 2_500, step: 100), defaultCard: true),
        .init(id: "active-minutes", label: "Active minutes", shortLabel: "Minutes", unit: "min",
              icon: "timer", category: .activity, aggregate: .sum, ring: .init(goal: 30, step: 5)),
        .init(id: "active-zone-minutes", label: "Zone minutes", shortLabel: "Zone min", unit: "min",
              icon: "bolt.heart.fill", category: .activity, aggregate: .sum, ring: .init(goal: 20, step: 5)),
        .init(id: "distance", label: "Distance", shortLabel: nil, unit: "km",
              icon: "location.fill", category: .activity, aggregate: .sum, fractionDigits: 1,
              ring: .init(goal: 5, step: 0.5), defaultCard: true),
        .init(id: "floors", label: "Floors", shortLabel: nil, unit: "floors",
              icon: "figure.stairs", category: .activity, aggregate: .sum, ring: .init(goal: 10, step: 1)),
        .init(id: "altitude", label: "Elevation gain", shortLabel: "Climb", unit: "m",
              icon: "mountain.2.fill", category: .activity, aggregate: .sum, ring: .init(goal: 50, step: 10)),
        .init(id: "sedentary-period", label: "Sedentary time", shortLabel: nil, unit: "h",
              icon: "chair.lounge.fill", category: .activity, aggregate: .sum, fractionDigits: 1),
        .init(id: "swim-lengths-data", label: "Swim strokes", shortLabel: "Swim", unit: "strokes",
              icon: "figure.pool.swim", category: .activity, aggregate: .sum, ring: .init(goal: 500, step: 100)),
        .init(id: "run-vo2-max", label: "Run VO₂ max", shortLabel: nil, unit: "ml/kg/min",
              icon: "figure.run", category: .activity, aggregate: .avg, fractionDigits: 1),

        // Heart
        .init(id: "heart-rate", label: "Avg heart rate", shortLabel: nil, unit: "bpm",
              icon: "heart.fill", category: .heart, aggregate: .avg, defaultCard: true),
        .init(id: "daily-resting-heart-rate", label: "Resting heart rate", shortLabel: nil, unit: "bpm",
              icon: "heart", category: .heart, aggregate: .avg),
        .init(id: "daily-heart-rate-variability", label: "Heart rate variability", shortLabel: nil, unit: "ms",
              icon: "waveform.path.ecg", category: .heart, aggregate: .avg),
        .init(id: "time-in-heart-rate-zone", label: "Time in HR zones", shortLabel: "Zone time", unit: "min",
              icon: "heart.circle", category: .heart, aggregate: .sum, ring: .init(goal: 30, step: 5)),
        .init(id: "calories-in-heart-rate-zone", label: "Zone calories", shortLabel: "Zone kcal", unit: "kcal",
              icon: "flame.circle", category: .heart, aggregate: .sum, ring: .init(goal: 300, step: 50)),
        .init(id: "daily-vo2-max", label: "VO₂ max", shortLabel: nil, unit: "ml/kg/min",
              icon: "speedometer", category: .heart, aggregate: .avg, fractionDigits: 1),

        // Body
        .init(id: "weight", label: "Weight", shortLabel: nil, unit: "kg",
              icon: "scalemass.fill", category: .body, aggregate: .avg, fractionDigits: 1),
        .init(id: "body-fat", label: "Body fat", shortLabel: nil, unit: "%",
              icon: "percent", category: .body, aggregate: .avg, fractionDigits: 1),
        .init(id: "core-body-temperature", label: "Body temperature", shortLabel: nil, unit: "°C",
              icon: "thermometer.medium", category: .body, aggregate: .avg, fractionDigits: 1),
        .init(id: "blood-glucose", label: "Blood glucose", shortLabel: nil, unit: "mg/dL",
              icon: "cross.case.fill", category: .body, aggregate: .avg),
        .init(id: "daily-oxygen-saturation", label: "Blood oxygen", shortLabel: nil, unit: "%",
              icon: "lungs.fill", category: .body, aggregate: .avg, fractionDigits: 1),
        .init(id: "daily-respiratory-rate", label: "Respiratory rate", shortLabel: nil, unit: "br/min",
              icon: "wind", category: .body, aggregate: .avg, fractionDigits: 1),

        // Nutrition
        .init(id: "nutrition-log", label: "Calories eaten", shortLabel: "Food", unit: "kcal",
              icon: "fork.knife", category: .nutrition, aggregate: .sum, ring: .init(goal: 2_000, step: 100)),
        .init(id: "hydration-log", label: "Hydration", shortLabel: "Water", unit: "ml",
              icon: "drop.fill", category: .nutrition, aggregate: .sum, ring: .init(goal: 2_000, step: 250)),
    ]

    /// Pseudo-card for sleep sessions — fetched as sessions, not a metric.
    static let sleepCardID = "sleep"

    /// supported-health-metrics.ts COMMON set (iOS excludes altitude).
    static let supportedOnIOS: Set<String> = [
        "steps", "active-energy-burned", "total-calories", "active-minutes", "distance", "floors",
        "heart-rate", "daily-resting-heart-rate", "weight", "nutrition-log", "hydration-log",
        "body-fat", "core-body-temperature", "blood-glucose", "daily-oxygen-saturation",
        "daily-respiratory-rate", "daily-vo2-max", "daily-heart-rate-variability", "sleep",
    ]

    static let categories = MetricCategory.allCases

    static func def(for id: String) -> MetricDef? {
        all.first { $0.id == id }
    }

    static let ringEligible: [MetricDef] = all.filter { $0.ring != nil }

    static let defaultCardIDs: [String] =
        [sleepCardID] + all.filter(\.defaultCard).map(\.id)

    static let defaultRingIDs: [String] = ["steps", "active-energy-burned", "active-minutes"]

    static func defaultGoal(for id: String) -> Double {
        def(for: id)?.ring?.goal ?? 0
    }

    static func supports(_ id: String) -> Bool {
        supportedOnIOS.contains(id)
    }
}
