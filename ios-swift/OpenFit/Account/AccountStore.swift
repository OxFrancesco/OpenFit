import Foundation
import Combine

/// Local stand-in for Clerk: persists a fake user in UserDefaults and accepts
/// any 6-digit code. Replace with a real auth provider before shipping.
@MainActor
final class AccountStore: ObservableObject {
    struct LocalUser: Codable, Equatable {
        var id: UUID
        var email: String
        var name: String

        var firstName: String? { name.split(separator: " ").first.map(String.init) }
        var fullName: String { name }
    }

    @Published private(set) var user: LocalUser?

    private static let userKey = "openfit.local-account.v1"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: Self.userKey),
           let stored = try? JSONDecoder().decode(LocalUser.self, from: data) {
            user = stored
        }
    }

    var isSignedIn: Bool { user != nil }

    func signIn(email rawEmail: String) {
        let email = rawEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let localPart = email.split(separator: "@").first.map(String.init) ?? "User"
        let name = localPart
            .replacingOccurrences(of: #"[^a-zA-Z ]"#, with: " ", options: .regularExpression)
            .split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
        let displayName = name.isEmpty
            ? (localPart.prefix(1).uppercased() + localPart.dropFirst())
            : name
        let user = LocalUser(id: UUID(uuidString: stableUUID(for: email)) ?? UUID(),
                             email: email,
                             name: displayName)
        self.user = user
        if let data = try? JSONEncoder().encode(user) {
            defaults.set(data, forKey: Self.userKey)
        }
    }

    /// Stable per-email UUID (namespace-style SHA-256 → UUID form).
    private func stableUUID(for email: String) -> String {
        var bytes = [UInt8](repeating: 0, count: 16)
        var hash: UInt64 = 0xcbf29ce484222325
        for b in email.utf8 {
            hash ^= UInt64(b)
            hash &*= 0x100000001b3
        }
        for i in 0..<8 { bytes[i] = UInt8((hash >> UInt64(8 * i)) & 0xFF) }
        for i in 8..<16 { bytes[i] = UInt8((hash >> UInt64(8 * (i - 8))) & 0xFF) ^ UInt8(i) }
        let hex = bytes.map { String(format: "%02x", $0) }.joined()
        return "\(hex.prefix(8))-\(hex.dropFirst(8).prefix(4))-\(hex.dropFirst(12).prefix(4))-\(hex.dropFirst(16).prefix(4))-\(hex.dropFirst(20).prefix(12))"
    }

    func signOut() {
        user = nil
        defaults.removeObject(forKey: Self.userKey)
    }
}
