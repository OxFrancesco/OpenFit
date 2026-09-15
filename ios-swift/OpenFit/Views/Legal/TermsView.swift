import SwiftUI

// Verbatim copy from src/app/terms.tsx.

struct TermsView: View {
    var body: some View {
        LegalPageView(updated: "September 10, 2026") {
            LegalSection(title: "Provider") {
                LegalParagraph("OpenFit is provided by \(openFitProvider). Contact \(openFitContactEmail) with support questions.")
            }
            LegalSection(title: "Use of OpenFit") {
                LegalParagraph("OpenFit is a personal wellness utility that helps you read device health data from Apple Health on iPhone or Health Connect on Android. It also provides an offline exercise library and a device-local manual workout log. An approved hosted deployment may also let you establish a connection-only link to your own Strava or Garmin account. You are responsible for the Google, Apple, Strava, Garmin, and device accounts you use with OpenFit and for the accuracy of entries you create.")
            }
            LegalSection(title: "No Medical Advice") {
                LegalParagraph("OpenFit does not provide medical advice, diagnosis, or treatment. Do not use OpenFit as a substitute for professional medical advice or emergency care.")
            }
            LegalSection(title: "User Permissions") {
                LegalParagraph("OpenFit accesses Health Connect and Apple Health data only after you grant permission. You can revoke access in Health Connect, Apple Health settings, or device settings. Strava and Garmin also require their own authorization. When a connection is available, you can withdraw it using Disconnect in Fitness or through the provider account.")
            }
            LegalSection(title: "Third-Party Fitness Connections") {
                LegalParagraph("The Strava and Garmin implementation currently establishes and revokes connections only; it does not import or sync provider activity records. Availability does not mean that a provider endorses, sponsors, or is affiliated with OpenFit. Provider services are governed by their own terms, privacy notices, availability, account requirements, and approvals.")
                LegalParagraph("Strava API materials and data must not be used with AI exports or any AI system, or combined with device health, Garmin, manual workout data, or other customer data. Strava and Garmin credentials remain encrypted in the per-user server agent and are not returned to the app.")
                LegalParagraph("To the fullest extent permitted by law, third-party providers make no warranties through these Terms, including implied warranties of merchantability, fitness for a particular purpose, or non-infringement, and are not liable through these Terms for consequential, special, punitive, or indirect damages. OpenFit, not the provider, is responsible for support for the OpenFit integration.")
            }
            LegalSection(title: "Availability") {
                LegalParagraph("OpenFit may change, pause, or stop features as the product evolves or as third-party APIs change. Health data availability depends on Health Connect, Apple Health, your devices, and the permissions you grant. Garmin requires acceptance into the Garmin Connect Developer Program. Strava remains disabled unless the operator receives written Strava clearance expressly permitting this use under the API Policy effective June 1, 2026. Credentials or an in-app provider card do not guarantee that either connection is active or approved.")
            }
            LegalSection(title: "Privacy") {
                LegalParagraph("The OpenFit Privacy Policy explains what data OpenFit accesses and how it is used.")
            }
        }
        .navigationTitle("OpenFit Terms of Service")
    }
}
