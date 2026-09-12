# Device health migration

OpenFit uses Clerk for accounts, Apple Health on iPhone, and Health Connect on Android. Google sign-in requests identity only. The live Clerk authorization URL was verified on September 10, 2026 with openid, email and profile, and no health scopes. The app does not use the Google Health cloud API or export records to Apple Health.

## Data flow

Health permission is separate from sign-in. Read access stays on the phone. The dashboard and widgets use native records. Disconnecting clears OpenFit's connection marker, cached dashboard and widget values. Users revoke OS permissions in their health app.

The coach works without health access. Its health-sharing switch starts off. When enabled, each question sends a bounded summary of the selected period to the existing Cloudflare AI worker. The worker stores encrypted conversation messages for 90 days. It does not fetch health records from Google. Previous conversation messages can contain health information shared earlier.

Email-only accounts work. Existing Google-linked accounts retain their current conversation and fitness-connection storage identifier. Strava and Garmin remain separate, approval-gated connection flows.

## Platform limits

- Android exposes today, 7, 14 and 30 days. It does not request older-history permission. It requests `READ_HEALTH_DATA_IN_BACKGROUND` so the 30-minute widget update can read Health Connect while the app is closed; when the user declines, widgets retain the latest foreground snapshot. Summed metrics (steps, calories, distance) render as `--` once the local date passes the day they were read, so yesterday's totals never pose as today's. Declare the background permission in the Play Console Health Connect form.
- iPhone also supports 90 days. HealthKit does not reveal whether individual read permissions were denied. Missing records remain empty rather than zero.
- Web supports accounts, coach conversations and training screens. It cannot read HealthKit or Health Connect. Device health does not sync to the web dashboard.
- Native health modules require a new app build. An over-the-air JavaScript update cannot install them.
- This migration is read-only. It removes the previous Google-to-Apple export.

## Retired access

The old Google OAuth and health API routes return HTTP 410. Startup removes locally stored Google tokens. The worker removes the retired Google credential field when an existing account agent wakes. This is lazy cleanup, not proof that every dormant account has already been visited.

## Provider and release checklist

1. Verified in the active Clerk instance. keep Google scopes limited to openid, email and profile. Confirm the actual Google consent URL contains no health scopes.
2. Verified in Google Cloud project fitty-1780912487832. All four restricted scopes were removed and the verification request updated. The Verification Center now states that data-access verification is not required. Branding remains under review. No CASA assessment was purchased.
3. Existing grants retained by Google or Clerk are not revoked automatically. Users can revoke the old Google application grant and sign in again with identity only.
4. Validate read permissions and real records on physical iPhone and Android devices, including denied permissions, sleep overlap and widget refresh.
5. Complete the Health Connect declaration in Google Play and update store privacy answers before submitting native builds. No paid CASA assessment is part of this migration.

Earlier Google Health OAuth and Apple export documents describe the retired implementation and are not release instructions.
