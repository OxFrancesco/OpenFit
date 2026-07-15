import {
  LegalBullet,
  LegalPage,
  LegalParagraph,
  LegalSection,
  OPENFIT_CONTACT_EMAIL,
} from '@/components/legal-page';

export default function SupportScreen() {
  return (
    <LegalPage title="OpenFit Support" updated="July 14, 2026">
      <LegalSection title="Contact">
        <LegalParagraph>Email: {OPENFIT_CONTACT_EMAIL}</LegalParagraph>
      </LegalSection>

      <LegalSection title="What OpenFit Does">
        <LegalParagraph>
          OpenFit shows Google Health data in a configurable dashboard with activity rings, metric
          cards, and home-screen widgets. It also provides a searchable exercise library, a
          device-local manual gym log, and approval-gated Strava and Garmin account connections.
          The current Strava and Garmin integrations are connection-only and do not import or sync
          provider activities.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Common Questions">
        <LegalBullet>
          Medical advice: OpenFit is a personal wellness utility and does not provide medical
          advice, diagnosis, or treatment.
        </LegalBullet>
        <LegalBullet>
          Google data: OpenFit accesses the Google Health data you authorize through Google sign-in.
        </LegalBullet>
        <LegalBullet>
          Apple Health: On iOS, OpenFit can write supported weight, sleep, and workout records to
          Apple Health when you start the export and grant HealthKit permission.
        </LegalBullet>
        <LegalBullet>
          Manual gym log: Entries stay on the current device in local SQLite storage or, on web, in
          browser storage. Delete individual entries in Fitness; clearing app or site data removes
          the remaining local log.
        </LegalBullet>
        <LegalBullet>
          Strava and Garmin: Sign in with Google first. The connection is available only when the
          hosted server has valid provider credentials and the required approval. Strava additionally
          requires written clearance for this use under its June 1, 2026 API Policy; Garmin requires
          Garmin Connect Developer Program approval.
        </LegalBullet>
        <LegalBullet>
          Disconnect Strava or Garmin: In Fitness, choose Disconnect for the provider. OpenFit asks
          the provider to revoke access or delete the registration before deleting the encrypted
          per-user credential. If that request fails, revoke OpenFit in the provider account first,
          then choose Remove from OpenFit to erase OpenFit&apos;s encrypted credential. This fallback does not
          itself revoke provider access. Contact support if either step remains unavailable.
        </LegalBullet>
        <LegalBullet>
          Disconnect Google: Sign out in OpenFit and revoke OpenFit access from your Google account
          permissions page.
        </LegalBullet>
        <LegalBullet>
          Revoke Apple Health: Open the iOS Health app or iOS Settings, find OpenFit under Health
          permissions, and turn off access.
        </LegalBullet>
      </LegalSection>

      <LegalSection title="Data Deletion">
        <LegalParagraph>
          Email {OPENFIT_CONTACT_EMAIL} with the subject OpenFit data deletion request. OpenFit
          stores manual gym data locally on your device, while Google coach state and any connected
          Strava or Garmin credential are stored in the Google-account-specific server agent. Delete
          local gym entries or clear app/site data, disconnect each fitness provider, and identify
          the Google account used with OpenFit so support can locate the correct server record.
        </LegalParagraph>
        <LegalParagraph>
          If in-app provider disconnect is unavailable, include that in the request. For an activated
          Strava integration, support must permanently delete Strava-related personal data after a
          user request, revocation, or Strava account deletion within 30 days unless a longer period
          is legally required, and provide written confirmation when deletion is complete.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
