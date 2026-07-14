import {
  LegalBullet,
  LegalPage,
  LegalParagraph,
  LegalSection,
  OPENFIT_CONTACT_EMAIL,
  OPENFIT_PROVIDER,
} from '@/components/legal-page';

export default function PrivacyPolicyScreen() {
  return (
    <LegalPage title="OpenFit Privacy Policy" updated="July 14, 2026">
      <LegalSection title="Who We Are">
        <LegalParagraph>
          OpenFit is provided by {OPENFIT_PROVIDER}. For privacy or support questions, contact{' '}
          {OPENFIT_CONTACT_EMAIL}.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="What OpenFit Does">
        <LegalParagraph>
          OpenFit signs in with Google, reads Google Health data with your permission, and displays
          that data in a configurable dashboard and home-screen widgets.
        </LegalParagraph>
        <LegalParagraph>
          OpenFit also includes an offline exercise library and a manual gym log for sets, reps,
          weight, and optional notes. The manual gym log can be used without connecting Google.
        </LegalParagraph>
        <LegalParagraph>
          The Personal Health-Data Coach uses your questions and relevant Google Health data to help
          you understand your wellness information. On iOS, OpenFit can export selected records to
          Apple Health when you start that sync.
        </LegalParagraph>
        <LegalParagraph>
          OpenFit is a personal wellness utility. It does not provide medical advice, diagnosis, or
          treatment.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Data We Access">
        <LegalBullet>
          Your stable Google account identifier and basic profile name, which are needed for
          sign-in, account connection, and the personalized greeting.
        </LegalBullet>
        <LegalBullet>
          Google Health data you authorize, including activity, sleep, health metrics and
          measurements, and nutrition data.
        </LegalBullet>
        <LegalBullet>Dashboard preferences, widget preferences, cached summaries, and sync status.</LegalBullet>
        <LegalBullet>
          Manual gym entries you create, including the exercise, date, sets, repetitions, weight,
          selected unit, and optional notes.
        </LegalBullet>
        <LegalBullet>
          Questions, messages, and voice recordings you submit when using the Personal Health-Data Coach.
        </LegalBullet>
        <LegalBullet>
          On iOS, Apple Health permissions and Apple Health write results for records you choose to
          export.
        </LegalBullet>
      </LegalSection>

      <LegalSection title="How We Use Data">
        <LegalBullet>Sign you in with Google.</LegalBullet>
        <LegalBullet>Fetch and refresh your Google Health data.</LegalBullet>
        <LegalBullet>Display your dashboard, cards, rings, and widgets.</LegalBullet>
        <LegalBullet>Save your preferences.</LegalBullet>
        <LegalBullet>Search the exercise library and calculate your local training history and volume.</LegalBullet>
        <LegalBullet>
          Process your questions and relevant Google Health data through our Cloudflare-based
          Personal Health-Data Coach to generate responses.
        </LegalBullet>
        <LegalBullet>
          Send voice recordings to ElevenLabs for speech-to-text transcription before submitting
          the resulting text to the coach.
        </LegalBullet>
        <LegalBullet>
          Export supported Google Health weight, sleep, and workout records to Apple Health on iOS
          when you start the export.
        </LegalBullet>
        <LegalBullet>Avoid rewriting unchanged Apple Health records.</LegalBullet>
      </LegalSection>

      <LegalSection title="Storage">
        <LegalParagraph>
          On native platforms, OpenFit stores OAuth tokens and app preferences in local secure
          platform storage. Widget data, cached summaries, and Apple Health sync ledger entries are
          stored locally on your device.
        </LegalParagraph>
        <LegalParagraph>
          On web, OAuth tokens and preferences may be stored in browser storage.
        </LegalParagraph>
        <LegalParagraph>
          Manual gym entries are stored only on your current device: in a local SQLite database on
          native platforms and in browser storage on web. They are not sent to the coach or a
          third-party fitness provider.
        </LegalParagraph>
        <LegalParagraph>
          OpenFit server routes process OAuth authorization codes and token refresh requests so the
          app can connect to Google.
        </LegalParagraph>
        <LegalParagraph>
          When you use the coach, OpenFit stores an encrypted Google refresh token on Cloudflare so
          the coach can access authorized data when answering your questions.
        </LegalParagraph>
        <LegalParagraph>
          Coach messages are encrypted at rest and retained for up to 90 days unless you delete the
          conversation sooner.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="How We Protect Your Data">
        <LegalParagraph>
          OpenFit encrypts data in transit using HTTPS/TLS when communicating with Google APIs and
          OpenFit server routes. OAuth client secrets are kept on the server and are not included in
          the app.
        </LegalParagraph>
        <LegalParagraph>
          On iOS and Android, OAuth tokens are stored using the operating system&apos;s protected
          Keychain or Keystore through Expo SecureStore. Coach refresh tokens and messages are
          encrypted at rest on Cloudflare.
        </LegalParagraph>
        <LegalParagraph>
          The coach fetches relevant Google Health data when needed and processes it with your
          question through Cloudflare infrastructure and AI services to generate an answer.
        </LegalParagraph>
        <LegalParagraph>
          On the web, OAuth tokens and preferences are stored in browser local storage and are
          protected by the browser&apos;s same-origin controls and the security of your browser and
          device.
        </LegalParagraph>
        <LegalParagraph>
          Do not use OpenFit on a shared or untrusted device, and sign out when finished. No method
          of storage or transmission is completely secure.
        </LegalParagraph>
        <LegalParagraph>
          We use reasonable technical and organizational safeguards to prevent unauthorized access,
          alteration, disclosure, or destruction.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Data Retention and Deletion">
        <LegalBullet>
          Local OAuth tokens remain on your device or in your browser until you sign out, the tokens
          expire or are revoked, you clear app or browser data, or you uninstall OpenFit.
        </LegalBullet>
        <LegalBullet>
          Google Health dashboard data is held in an in-memory cache only while the app is running.
          Widget summaries and Apple Health sync ledger entries remain locally until they are
          replaced, cleared by the app, or removed when you clear app data or uninstall OpenFit.
        </LegalBullet>
        <LegalBullet>
          Dashboard and widget preferences remain locally until you clear app or browser data or
          uninstall OpenFit.
        </LegalBullet>
        <LegalBullet>
          Manual gym entries remain locally until you delete an entry, clear app or browser data,
          or uninstall OpenFit.
        </LegalBullet>
        <LegalBullet>
          The encrypted server-side Google refresh token remains while your coach connection is
          active. Revoking OpenFit in your Google Account prevents further Google data access.
        </LegalBullet>
        <LegalBullet>
          Coach messages are retained for up to 90 days. You can delete the full conversation
          sooner from the coach screen, which removes it from every device.
        </LegalBullet>
        <LegalParagraph>
          To delete locally stored Google user data, sign out of OpenFit and clear the app&apos;s data
          or uninstall it. On the web, sign out and clear site data for OpenFit in your browser.
        </LegalParagraph>
        <LegalParagraph>
          You can revoke OpenFit&apos;s access from your Google Account permissions. To request deletion
          of other data associated with your use of OpenFit, contact {OPENFIT_CONTACT_EMAIL}.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Sharing">
        <LegalParagraph>
          OpenFit uses Google APIs for sign-in, token exchange, token refresh, and Google Health
          data access. Cloudflare infrastructure stores encrypted coach tokens and messages.
        </LegalParagraph>
        <LegalParagraph>
          Cloudflare AI services process questions, conversation history, and relevant Google Health
          data to generate coach responses.
        </LegalParagraph>
        <LegalParagraph>
          Voice recordings are sent to ElevenLabs for transcription. On iOS, OpenFit uses Apple
          Health only when you grant permission and start the export.
        </LegalParagraph>
        <LegalParagraph>
          Garmin and Strava are shown as informational, approval-gated connections. OpenFit does
          not currently authenticate with them or receive their data.
        </LegalParagraph>
        <LegalParagraph>
          We do not sell personal data. We do not share Google Health data with advertisers.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Google Health API Limited Use">
        <LegalParagraph>
          OpenFit&apos;s use of Google Health API information complies with the Google Health API
          Developer and User Data Policy, including its Limited Use requirements.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Your Choices">
        <LegalParagraph>
          You can revoke Google access from your Google account settings. You can revoke Apple
          Health permissions in the iOS Health app or iOS Settings.
        </LegalParagraph>
        <LegalParagraph>
          Signing out removes local Google OAuth tokens and clears current health summaries from
          the app and widgets. It does not delete your local manual gym log. You can delete gym
          entries from Fitness and stored coach messages from the coach screen.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Children">
        <LegalParagraph>OpenFit is not intended for children under 13.</LegalParagraph>
      </LegalSection>

      <LegalSection title="Changes">
        <LegalParagraph>
          We may update this policy as OpenFit changes. The effective date above shows when this
          policy was last updated.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
