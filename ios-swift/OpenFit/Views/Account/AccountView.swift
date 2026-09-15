import SwiftUI

// Port of src/app/account.tsx (spec §2.5) against the local AccountStore stub.

struct AccountView: View {
    @EnvironmentObject private var account: AccountStore
    @EnvironmentObject private var health: HealthStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.selectedTab) private var selectedTab

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var code = ""
    @State private var sent = false
    @State private var busy = false
    @State private var error: String?

    enum Mode: String, CaseIterable {
        case signIn = "Sign in"
        case signUp = "Create account"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if let user = account.user {
                    // Signed in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(user.fullName.isEmpty ? "Your account" : user.fullName)
                            .themed(.subtitle, color: Theme.onPrimaryContainer)
                        Text(user.email).themed(.default, color: Theme.onPrimaryContainer)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(24)
                    .background(Theme.primaryContainer)
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))

                    Text("Workouts remain on this device after you sign out.")
                        .themed(.small, color: Theme.textSecondary)

                    Button {
                        selectedTab.wrappedValue = 1
                        dismiss()
                    } label: {
                        Text("Go to workouts")
                            .themed(.smallBold, color: Theme.onPrimary)
                            .frame(maxWidth: .infinity, minHeight: 56)
                            .background(Theme.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    }

                    Button {
                        selectedTab.wrappedValue = 0
                        dismiss()
                    } label: {
                        Text("Go to health")
                            .themed(.smallBold, color: Theme.primary)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .strokeBorder(Theme.primary, lineWidth: 1))
                    }

                    Button {
                        busy = true
                        account.signOut()
                        health.disconnect()
                        sent = false
                        code = ""
                        busy = false
                    } label: {
                        Text("Sign out")
                            .themed(.smallBold, color: Theme.primary)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .strokeBorder(Theme.primary, lineWidth: 1))
                    }
                    .disabled(busy)
                } else {
                    // Signed out
                    Text(sent ? "Check your email" : "Sign in to OpenFit").themed(.title)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if sent {
                        Text("Enter the verification code sent to \(email.trimmingCharacters(in: .whitespaces)).")
                            .themed(.default, color: Theme.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        TextField("Verification code", text: $code)
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                            .padding(Spacing.two)
                            .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .strokeBorder(Theme.outline, lineWidth: 0.5))
                            .onChange(of: code) { code = String(code.filter(\.isNumber).prefix(6)) }

                        Button { verify() } label: {
                            Text("Verify and continue")
                                .themed(.smallBold, color: Theme.onPrimary)
                                .frame(maxWidth: .infinity, minHeight: 56)
                                .background(Theme.primary)
                                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        }
                        .disabled(busy || code.count != 6)
                        .opacity(code.count != 6 ? 0.5 : 1)

                        Button("Send a new code") { sent = true }
                        Button("Use another email") {
                            sent = false
                            code = ""
                            error = nil
                        }
                    } else {
                        Button {
                            error = "Google sign-in is not available in this build."
                        } label: {
                            Label("Continue with Google", systemImage: "g.circle.fill")
                                .themed(.smallBold, color: Theme.onPrimary)
                                .frame(maxWidth: .infinity, minHeight: 56)
                                .background(Theme.primary)
                                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        }

                        Picker("Mode", selection: $mode) {
                            ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.segmented)

                        TextField("Email address", text: $email)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(Spacing.two)
                            .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .strokeBorder(Theme.outline, lineWidth: 0.5))
                            .onSubmit { sendCode() }

                        Button { sendCode() } label: {
                            Text("Continue with email")
                                .themed(.smallBold, color: Theme.onPrimary)
                                .frame(maxWidth: .infinity, minHeight: 56)
                                .background(Theme.primary)
                                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        }
                        .disabled(busy || email.trimmingCharacters(in: .whitespaces).isEmpty)
                        .opacity(email.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
                    }

                    HStack {
                        NavigationLink("Privacy", value: AppRoute.privacy)
                        NavigationLink("Terms", value: AppRoute.terms)
                    }
                }

                if let error {
                    Text(error).themed(.small, color: Theme.error)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(24)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background)
        .navigationTitle("Account")
    }

    /// Local stub: "sends" a code (any 6-digit code verifies).
    private func sendCode() {
        guard !email.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        sent = true
        error = nil
    }

    private func verify() {
        busy = true
        error = nil
        account.signIn(email: email)
        health.refreshConnection()
        busy = false
    }
}
