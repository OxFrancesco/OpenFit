import {
  LegalBullet,
  LegalPage,
  LegalParagraph,
  LegalSection,
  OPENFIT_CONTACT_EMAIL,
} from '@/components/legal-page';

export default function SupportScreen() {
  return (
    <LegalPage title="OpenFit Support" updated="September 10, 2026">
      <LegalSection title="Contact">
        <LegalParagraph>Email: {OPENFIT_CONTACT_EMAIL}</LegalParagraph>
      </LegalSection>

      <LegalSection title="What OpenFit Does">
        <LegalParagraph>
          OpenFit shows device health data in a configurable dashboard with activity rings, metric
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
          On Android, connect Health Connect from the dashboard and choose the data types OpenFit may read.
        </LegalBullet>
        <LegalBullet>
          On iPhone, connect Apple Health from the dashboard. Missing records or denied read permissions appear as unavailable data. OpenFit does not write health records.
        </LegalBullet>
        <LegalBullet>
          Manual gym log: Entries stay on the current device in local SQLite storage or, on web, in
          browser storage. Delete individual entries in Fitness; clearing app or site data removes
          the remaining local log.
        </LegalBullet>
        <LegalBullet>
          Strava and Garmin: Sign in to OpenFit first. The connection is available only when the
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
          To disconnect device health, use Settings. Revoke access in Apple Health or Health Connect settings. Google sign-in is separate from health permissions.
        </LegalBullet>
        <LegalBullet>
          Revoke Apple Health: Open the iOS Health app or iOS Settings, find OpenFit under Health
          permissions, and turn off access.
        </LegalBullet>
      </LegalSection>

      <LegalSection title="Data Deletion">
        <LegalParagraph>
          Email {OPENFIT_CONTACT_EMAIL} with the subject OpenFit data deletion request. OpenFit
          stores manual gym data locally on your device, while coach messages and any connected
          Strava or Garmin credential are stored in the account-specific server agent. Delete
          local gym entries or clear app/site data, disconnect each fitness provider, and identify
          the OpenFit account used with OpenFit so support can locate the correct server record.
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
