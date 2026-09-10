import { LegalPage, LegalParagraph, LegalSection, OPENFIT_CONTACT_EMAIL, OPENFIT_PROVIDER } from '@/components/legal-page';

export default function PrivacyPolicyScreen() {
  return <LegalPage title="OpenFit Privacy Policy" updated="September 10, 2026">
    <LegalSection title="Who we are">
      <LegalParagraph>OpenFit is provided by {OPENFIT_PROVIDER}. Contact {OPENFIT_CONTACT_EMAIL} for privacy questions or deletion requests.</LegalParagraph>
    </LegalSection>
    <LegalSection title="Accounts">
      <LegalParagraph>Clerk manages email verification, optional Google sign-in, account profiles and sessions. Google sign-in requests basic identity permissions only. OpenFit no longer requests Google Health API access. Native session credentials use secure platform storage; web sessions use Clerk-managed browser cookies.</LegalParagraph>
    </LegalSection>
    <LegalSection title="Device health">
      <LegalParagraph>With your permission, OpenFit reads activity, workouts, sleep, heart and body measurements, and nutrition records from Apple Health on iPhone or Health Connect on Android. You choose which data types to allow. OpenFit uses these records for dashboard cards, date ranges and widgets. It does not write records to either health store.</LegalParagraph>
      <LegalParagraph>Dashboard health records are processed on your phone and held in memory while the app runs. Widget summaries and preferences are stored locally. The web app cannot read your phone&apos;s health records, and OpenFit does not automatically upload or sync these records to a server.</LegalParagraph>
      <LegalParagraph>Signing out or selecting Disconnect device health clears the health cache and widget summaries. This does not delete records in Apple Health or Health Connect. Revoke permissions in the Health app or Health Connect settings to stop operating-system access. Preferences remain until you clear app data or uninstall the app.</LegalParagraph>
    </LegalSection>
    <LegalSection title="Optional health coach">
      <LegalParagraph>The coach sends your questions and conversation history to Cloudflare AI to generate answers. The Share device health with coach switch is off when you open the coach. When you enable it, each question also sends a 30-day summary of available device health metrics, sleep sessions and workouts. Disable it to stop attaching new summaries. Earlier conversation messages may still contain health information until you delete the conversation.</LegalParagraph>
      <LegalParagraph>Health summaries are processed for the request and are not saved as a separate server health database. Questions and answers, which may include health information, are encrypted at rest in your account&apos;s Cloudflare agent and retained for up to 90 days. Delete the conversation in the coach to remove saved messages sooner. Network requests use HTTPS.</LegalParagraph>
      <LegalParagraph>Voice input is optional. When you record a voice message, OpenFit sends the recording to ElevenLabs for transcription and sends the resulting text to the coach. OpenFit does not keep a server copy of the audio.</LegalParagraph>
      <LegalParagraph>OpenFit is a wellness utility and does not provide medical advice, diagnosis or treatment.</LegalParagraph>
    </LegalSection>
    <LegalSection title="Manual workouts">
      <LegalParagraph>The exercise library and gym log work locally. Exercise names, dates, sets, repetitions, weights and notes stay in SQLite on the phone or browser storage on web. They are not automatically sent to the coach or a fitness provider. Signing out does not erase them. Delete entries in Fitness or clear app or site data.</LegalParagraph>
    </LegalSection>
    <LegalSection title="Optional fitness connections">
      <LegalParagraph>Strava and Garmin connections are available only when the deployment has the required provider approval. This version establishes and revokes account connections only; it does not import activity records. The app receives the provider account label, connection state, date and granted permissions. Access and refresh credentials are encrypted in the per-user Cloudflare agent and are not returned to the app.</LegalParagraph>
      <LegalParagraph>Strava remains disabled unless the operator has written clearance for this use under its API Policy effective June 1, 2026. When enabled, it requests basic read permission. Garmin permissions depend on the approved provider configuration. Neither connection implies provider endorsement.</LegalParagraph>
      <LegalParagraph>Provider credentials and connection metadata are not sent to the coach or AI providers. OpenFit does not combine Strava data with device health, Garmin or manual workouts, and does not use Strava API data to train, evaluate, ground or operate AI systems.</LegalParagraph>
      <LegalParagraph>Disconnect asks the provider to revoke access before deleting the local server credential. If revocation fails, the credential remains available for retry. After revoking access directly with the provider, Remove from OpenFit erases the stored connection without claiming remote revocation. For an activated Strava integration, deletion requests, revocation or account deletion require removal of Strava-related personal data within 30 days unless a longer retention period is legally required, with written confirmation.</LegalParagraph>
    </LegalSection>
    <LegalSection title="Sharing and deletion">
      <LegalParagraph>We do not sell personal or health data, share health data with advertisers, or use it to train general-purpose AI models. Clerk handles authentication; Cloudflare handles account services and the optional coach; ElevenLabs handles voice transcription when requested.</LegalParagraph>
      <LegalParagraph>To request account and server-data deletion, contact {OPENFIT_CONTACT_EMAIL} using the account email. Disconnect fitness providers and delete your coach conversation in the app when possible. Signing out ends the local session but does not delete the Clerk account or revoke Google sign-in consent.</LegalParagraph>
      <LegalParagraph>On upgrade, OpenFit removes locally stored legacy Google credentials. The server no longer uses Google Health credentials and removes retired credentials when an existing account agent is opened. Earlier coach messages retain the same deletion controls and 90-day retention limit.</LegalParagraph>
    </LegalSection>
    <LegalSection title="Children and changes">
      <LegalParagraph>OpenFit is not intended for children under 13. We update this policy when data handling changes; the effective date appears above.</LegalParagraph>
    </LegalSection>
  </LegalPage>;
}
