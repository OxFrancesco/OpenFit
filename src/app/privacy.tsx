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
          OpenFit can establish optional Strava and Garmin account connections when the hosted
          deployment has the required provider approval. These are connection-only flows in this
          version: OpenFit does not fetch, import, display, or sync Strava or Garmin activity data.
          Google Health remains the app&apos;s fitness-data provider.
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
          If you connect Strava or Garmin, the provider account identifier and label, granted
          permissions, connection date, and OAuth credentials needed to maintain and revoke that
          connection. The current connection flow does not retrieve provider activity records.
        </LegalBullet>
        <LegalBullet>
          When activated, Strava authorization requests only the basic &quot;read&quot; permission.
          OpenFit records the returned athlete identifier, label, and granted permission list, but
          this version does not call the Strava activity endpoints. Garmin permissions are determined by the
          provider-approved app configuration and the user&apos;s consent; OpenFit records the Garmin
          user identifier and granted permission names without fetching activity records.
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
          Establish, show the status of, maintain, and revoke an optional Strava or Garmin account
          connection when that provider is enabled.
        </LegalBullet>
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
          On native platforms, OpenFit stores Google OAuth tokens and app preferences in local
          secure platform storage. Widget data, cached summaries, and Apple Health sync ledger
          entries are stored locally on your device.
        </LegalParagraph>
        <LegalParagraph>
          On web, Google OAuth tokens and preferences may be stored in browser storage.
        </LegalParagraph>
        <LegalParagraph>
          Manual gym entries are stored only on your current device: in a local SQLite database on
          native platforms and in browser storage on web. They are not sent to the coach or a
          third-party fitness provider.
        </LegalParagraph>
        <LegalParagraph>
          OpenFit server routes process Google authorization codes and token refresh requests. For
          Strava and Garmin, authenticated server routes protect short-lived callback state and
          forward the provider&apos;s authorization result to the per-user server agent. The agent
          keeps the authorization code encrypted and pending until the authenticated app proves
          possession of a verifier created by the app session that started the connection.
          Authorization codes, access tokens, and refresh tokens are never returned to the app.
        </LegalParagraph>
        <LegalParagraph>
          A connected Strava or Garmin account&apos;s credentials are encrypted at rest inside the
          Google-account-specific Cloudflare agent. The app receives only a sanitized summary such
          as connection state, connection date, provider account label, and granted permissions.
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
          On iOS and Android, Google OAuth tokens are stored using the operating system&apos;s protected
          Keychain or Keystore through Expo SecureStore. Coach refresh tokens and messages are
          encrypted at rest on Cloudflare.
        </LegalParagraph>
        <LegalParagraph>
          Strava and Garmin credentials are encrypted at rest in the per-user Cloudflare agent.
          They are deliberately excluded from coach prompts, AI model input, Google Health
          snapshots, and manual gym logs. Strava data is never combined with Google Health, Garmin,
          manual workout data, or other customer data.
        </LegalParagraph>
        <LegalParagraph>
          The coach fetches relevant Google Health data when needed and processes it with your
          question through Cloudflare infrastructure and AI services to generate an answer.
        </LegalParagraph>
        <LegalParagraph>
          On the web, Google OAuth tokens and preferences are stored in browser local storage and
          are protected by the browser&apos;s same-origin controls and the security of your browser and
          device. Strava and Garmin credentials are not stored in browser storage.
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
          Local Google OAuth tokens remain on your device or in your browser until you sign out,
          the tokens expire or are revoked, you clear app or browser data, or you uninstall OpenFit.
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
          A Strava or Garmin credential and its limited connection metadata remain encrypted in the
          per-user server agent while that connection is active. Disconnect asks the provider to
          revoke access or delete its registration before OpenFit deletes the encrypted credential.
          If provider revocation fails, OpenFit keeps the credential so the request can be retried
          instead of reporting a successful deletion that did not occur. After you revoke OpenFit
          directly in the provider account, the in-app Remove from OpenFit fallback erases the encrypted
          credential and connection metadata without claiming to perform remote revocation.
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
        <LegalParagraph>
          If Strava or Garmin is connected, disconnect it before requesting full account deletion.
          If normal disconnect fails, revoke OpenFit in the provider account and use Remove from OpenFit.
          A complete deletion request covers the provider credential and connected-account metadata
          stored in the per-user agent. For an activated Strava integration, OpenFit must also delete
          Strava-related personal data after revocation, account deletion, or a user request within
          30 days unless a longer retention period is legally required, and provide written
          confirmation of completed deletion. Contact {OPENFIT_CONTACT_EMAIL} if the in-app
          disconnect is unavailable or to request that confirmation.
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
          If activated and authorized by you, OpenFit communicates with Strava or Garmin only to
          establish, maintain, inspect, or revoke that provider connection. This version does not
          request activity records after connection. Strava may monitor and collect API usage data
          and use that usage data for its business purposes under its API Policy.
        </LegalParagraph>
        <LegalParagraph>
          OpenFit does not disclose Strava or Garmin credentials or data to the Personal
          Health-Data Coach, AI service providers, advertisers, the other fitness provider, or other
          OpenFit users. The app receives only the signed-in user&apos;s sanitized connection summary.
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

      <LegalSection title="Strava Connection Restrictions">
        <LegalParagraph>
          The Strava connection is disabled unless the operator has written clearance from Strava
          that expressly permits this OpenFit use under Strava&apos;s API Policy effective June 1, 2026.
          Configuring OAuth credentials alone does not enable it. This notice does not claim that
          Strava has approved, endorsed, or sponsored OpenFit.
        </LegalParagraph>
        <LegalParagraph>
          If the connection is activated, Strava information may be shown only to the authenticated
          Strava user. OpenFit does not use Strava API materials or data to train, evaluate, ground,
          retrieve for, or operate an AI system, and it does not combine Strava data with Google
          Health, Garmin, manual workout data, or any other customer data.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Your Choices">
        <LegalParagraph>
          You can revoke Google access from your Google account settings. You can revoke Apple
          Health permissions in the iOS Health app or iOS Settings. When available, use Disconnect
          in Fitness to revoke a Strava or Garmin connection.
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
