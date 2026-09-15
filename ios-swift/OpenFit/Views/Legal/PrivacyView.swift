import SwiftUI

// Verbatim copy from src/app/privacy.tsx.

struct PrivacyView: View {
    var body: some View {
        LegalPageView(updated: "September 14, 2026") {
            LegalSection(title: "Who we are") {
                LegalParagraph("OpenFit is provided by \(openFitProvider). Contact \(openFitContactEmail) for privacy questions or deletion requests.")
            }
            LegalSection(title: "Accounts") {
                LegalParagraph("Clerk manages email verification, optional Google sign-in, account profiles and sessions. Google sign-in requests basic identity permissions only. OpenFit no longer requests Google Health API access. Native session credentials use secure platform storage; web sessions use Clerk-managed browser cookies.")
            }
            LegalSection(title: "Device health") {
                LegalParagraph("With your permission, OpenFit reads activity, workouts, sleep, heart and body measurements, and nutrition records from Apple Health on iPhone or Health Connect on Android. You choose which data types to allow. OpenFit uses these records for dashboard cards, date ranges and widgets. It does not write records to either health store. On Android, OpenFit also asks Health Connect for background read access so home-screen widgets can refresh today's totals while the app is closed; you can decline this and widgets will update whenever you open OpenFit.")
                LegalParagraph("Dashboard health records are processed on your phone and held in memory while the app runs. Widget summaries and preferences are stored locally. The web app cannot read your phone's health records, and OpenFit does not automatically upload or sync these records to a server.")
                LegalParagraph("Signing out or selecting Disconnect device health clears the health cache and widget summaries. This does not delete records in Apple Health or Health Connect. Revoke permissions in the Health app or Health Connect settings to stop operating-system access. Preferences remain until you clear app data or uninstall the app.")
            }
            LegalSection(title: "Markdown export") {
                LegalParagraph("Settings can create a Markdown file containing 30 days of available device health, all gym logs saved on this device, daily goals and a suggested AI prompt. The file is created locally. OpenFit does not send it to an AI provider. You decide where to save or share it, and the service you choose handles that copy under its own policy.")
                LegalParagraph("The built-in coach has been removed. Previously saved conversations remain subject to the existing 90-day retention limit. Contact \(openFitContactEmail) to request earlier deletion. OpenFit is a wellness utility and does not provide medical advice, diagnosis or treatment.")
            }
            LegalSection(title: "Manual workouts") {
                LegalParagraph("The exercise library and gym log work locally. Exercise names, dates, sets, repetitions, weights and notes stay in SQLite on the phone or browser storage on web. They are not automatically sent to an AI or fitness provider. Signing out does not erase them. Delete entries in Fitness or clear app or site data.")
            }
            LegalSection(title: "Optional fitness connections") {
                LegalParagraph("Strava and Garmin connections are available only when the deployment has the required provider approval. This version establishes and revokes account connections only; it does not import activity records. The app receives the provider account label, connection state, date and granted permissions. Access and refresh credentials are encrypted in the per-user Cloudflare agent and are not returned to the app.")
                LegalParagraph("Strava remains disabled unless the operator has written clearance for this use under its API Policy effective June 1, 2026. When enabled, it requests basic read permission. Garmin permissions depend on the approved provider configuration. Neither connection implies provider endorsement.")
                LegalParagraph("Provider credentials and connection metadata are excluded from Markdown exports. OpenFit does not combine Strava data with device health, Garmin or manual workouts, and does not use Strava API data to train, evaluate, ground or operate AI systems.")
                LegalParagraph("Disconnect asks the provider to revoke access before deleting the local server credential. If revocation fails, the credential remains available for retry. After revoking access directly with the provider, Remove from OpenFit erases the stored connection without claiming remote revocation. For an activated Strava integration, deletion requests, revocation or account deletion require removal of Strava-related personal data within 30 days unless a longer retention period is legally required, with written confirmation.")
            }
            LegalSection(title: "Sharing and deletion") {
                LegalParagraph("We do not sell personal or health data, share health data with advertisers, or use it to train general-purpose AI models. Clerk handles authentication; Cloudflare handles account services.")
                LegalParagraph("To request account and server-data deletion, contact \(openFitContactEmail) using the account email. Disconnect fitness providers in the app when possible. Signing out ends the local session but does not delete the Clerk account or revoke Google sign-in consent.")
                LegalParagraph("On upgrade, OpenFit removes locally stored legacy Google credentials. The server no longer uses Google Health credentials and removes retired credentials when an existing account agent is opened. Earlier coach messages retain the 90-day retention limit and can be deleted through a support request.")
            }
            LegalSection(title: "Children and changes") {
                LegalParagraph("OpenFit is not intended for children under 13. We update this policy when data handling changes; the effective date appears above.")
            }
        }
        .navigationTitle("OpenFit Privacy Policy")
    }
}
