import Foundation
import Combine

// Port of src/lib/dashboard-prefs-core.ts (spec §3.2). SecureStore → UserDefaults.

struct DashboardPrefs: Codable, Equatable {
    /// Metric id per ring slot (outer, middle, inner).
    var rings: [String]            // exactly 3
    /// Metric id per widget value slot (first, second, third).
    var widgetMetrics: [String]    // exactly 3
    /// Per-metric goal overrides; defaults come from the catalog.
    var goals: [String: Double]
    /// Visible card ids in display order ('sleep' is a pseudo-card).
    var cards: [String]

    static let prefsKey = "fitty.dashboard_prefs"

    static var `default`: DashboardPrefs {
        DashboardPrefs(rings: MetricCatalog.defaultRingIDs,
                       widgetMetrics: MetricCatalog.defaultRingIDs,
                       goals: [:],
                       cards: MetricCatalog.defaultCardIDs)
    }

    // MARK: Normalization (mirrors normalizeRings/Goals/Cards/WidgetMetrics)

    private static func normalizeRings(_ incoming: [String]?) -> [String] {
        var used = Set<String>()
        return MetricCatalog.defaultRingIDs.enumerated().map { slot, fallback in
            let candidate = incoming?[safe: slot] ?? fallback
            var id = (MetricCatalog.def(for: candidate)?.ring != nil && !used.contains(candidate)) ? candidate : fallback
            if used.contains(id) {
                id = MetricCatalog.ringEligible.first { !used.contains($0.id) }?.id ?? fallback
            }
            used.insert(id)
            return id
        }
    }

    private static func normalizeGoals(_ value: [String: Double]?) -> [String: Double] {
        guard let value else { return [:] }
        var goals: [String: Double] = [:]
        for (id, goal) in value where MetricCatalog.def(for: id)?.ring != nil && goal.isFinite && goal > 0 {
            goals[id] = goal
        }
        return goals
    }

    private static func normalizeCards(_ value: [String]?) -> [String] {
        guard let value else { return MetricCatalog.defaultCardIDs }
        var seen = Set<String>()
        var cards: [String] = []
        for id in value {
            if seen.contains(id) { continue }
            if id != MetricCatalog.sleepCardID && MetricCatalog.def(for: id) == nil { continue }
            seen.insert(id)
            cards.append(id)
        }
        // An empty list is a valid choice — the user removed every card.
        return cards
    }

    private static func normalizeWidgetMetrics(_ incoming: [String]?, rings: [String]) -> [String] {
        var used = Set<String>()
        let alternates = MetricCatalog.defaultRingIDs + MetricCatalog.ringEligible.map(\.id)
        return rings.enumerated().map { slot, fallback in
            let candidate = incoming?[safe: slot] ?? fallback
            var id = (MetricCatalog.def(for: candidate) != nil && !used.contains(candidate)) ? candidate : fallback
            if used.contains(id) {
                id = alternates.first { MetricCatalog.def(for: $0) != nil && !used.contains($0) } ?? fallback
            }
            used.insert(id)
            return id
        }
    }

    static func decode(data: Data?) -> DashboardPrefs {
        guard let data,
              let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return .default
        }
        let rings = normalizeRings(raw["rings"] as? [String])
        return DashboardPrefs(
            rings: rings,
            widgetMetrics: normalizeWidgetMetrics(raw["widgetMetrics"] as? [String], rings: rings),
            goals: normalizeGoals(raw["goals"] as? [String: Double]),
            cards: normalizeCards(raw["cards"] as? [String])
        )
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

final class DashboardPrefsStore: ObservableObject {
    @Published private(set) var prefs: DashboardPrefs {
        didSet { persist() }
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.prefs = DashboardPrefs.decode(data: defaults.data(forKey: DashboardPrefs.prefsKey))
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(prefs) {
            defaults.set(data, forKey: DashboardPrefs.prefsKey)
        }
    }

    func setRingMetric(_ metricID: String, slot: Int) {
        var rings = prefs.rings
        rings[slot] = metricID
        prefs.rings = rings
    }

    func setGoal(_ goal: Double, for metricID: String) {
        prefs.goals[metricID] = goal
    }

    func toggleCard(_ id: String) {
        if prefs.cards.contains(id) {
            prefs.cards.removeAll { $0 == id }
        } else {
            prefs.cards.append(id)
        }
    }

    func goal(for id: String) -> Double {
        prefs.goals[id] ?? MetricCatalog.defaultGoal(for: id)
    }
}
