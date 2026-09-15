import Foundation
import Combine

// Port of src/lib/health-source.ts + health-cache.ts + device-health-core.ts
// windowing (spec §3.3/§3.4). SecureStore → UserDefaults for the owner flag.

@MainActor
final class HealthStore: ObservableObject {
    static let ownerKey = "openfit.device-health-owner.v1"
    /// In-memory snapshot cache TTL (health-cache.ts FRESH_TTL_MS).
    static let freshTTL: TimeInterval = 120

    @Published private(set) var isConnected = false

    private let service = HealthKitService()
    private var cache: [Int: (snapshot: HealthSnapshot, fetchedAt: Date)] = [:]
    private let defaults: UserDefaults
    private let accountStore: AccountStore

    init(accountStore: AccountStore, defaults: UserDefaults = .standard) {
        self.accountStore = accountStore
        self.defaults = defaults
        refreshConnection()
    }

    func refreshConnection() {
        guard let userID = accountStore.user?.id.uuidString else {
            isConnected = false
            return
        }
        isConnected = defaults.string(forKey: Self.ownerKey) == userID
    }

    func connect() async throws {
        guard let userID = accountStore.user?.id.uuidString else {
            throw NSError(domain: "OpenFit", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Sign in to OpenFit first."])
        }
        try await service.requestReadAuthorization()
        defaults.set(userID, forKey: Self.ownerKey)
        clearCache()
        isConnected = true
    }

    func disconnect() {
        defaults.removeObject(forKey: Self.ownerKey)
        clearCache()
        isConnected = false
    }

    /// today-midnight minus (days−1) days … now; days clamped to 0..89.
    func healthWindow(_ days: Int, now: Date = Date()) -> (start: Date, end: Date) {
        var start = Calendar.current.startOfDay(for: now)
        let back = max(0, min(89, days - 1))
        start = Calendar.current.date(byAdding: .day, value: -back, to: start)!
        return (start, now)
    }

    private static let rangeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .short
        return f
    }()

    func cachedSnapshot(days: Int) -> HealthSnapshot? {
        cache[days]?.snapshot
    }

    func isFresh(days: Int) -> Bool {
        guard let entry = cache[days] else { return false }
        return Date().timeIntervalSince(entry.fetchedAt) < Self.freshTTL
    }

    @discardableResult
    func fetchSnapshot(days: Int = 7, metricIds: [String]? = nil) async throws -> HealthSnapshot {
        guard isConnected else {
            throw NSError(domain: "OpenFit", code: 2,
                          userInfo: [NSLocalizedDescriptionKey: "Connect device health from the dashboard first."])
        }
        let (start, end) = healthWindow(days)
        let ids = metricIds ?? (MetricCatalog.defaultRingIDs + MetricCatalog.defaultCardIDs)
        let result = try await service.read(ids: ids, start: start, end: end)
        let snapshot = HealthSnapshot(
            metrics: result.metrics,
            exercises: result.exercises,
            sleepSessions: result.sleepSessions,
            rangeLabel: "\(Self.rangeFormatter.string(from: start)) – \(Self.rangeFormatter.string(from: end))"
        )
        cache[days] = (snapshot, Date())
        return snapshot
    }

    func clearCache() {
        cache.removeAll()
    }
}
