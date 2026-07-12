# OpenFit Privacy Policy Draft

Effective date: July 12, 2026

This draft must be reviewed and hosted before store submission. Replace all TODO values before publishing.

## Who We Are

OpenFit is provided by `TODO_LEGAL_NAME`.

Contact: `TODO_SUPPORT_EMAIL`

## What OpenFit Does

OpenFit signs in with Google, reads Google Health data with your permission, and displays that data in a configurable dashboard and home-screen widgets. On iOS, OpenFit can export selected Google Health records into Apple Health when you start that sync.

OpenFit is a personal wellness utility. It does not provide medical advice, diagnosis, or treatment.

## Data We Access

OpenFit may access:

- Google account information needed for sign-in, such as your email address and profile information.
- Google Health data you authorize, including activity, sleep, profile, health metrics and measurements, and nutrition data.
- Dashboard preferences, widget preferences, cached health summaries, and sync status.
- On iOS, Apple Health permissions and Apple Health write results for records you choose to export.

## How We Use Data

We use data to:

- Sign you in with Google.
- Fetch and refresh your Google Health data.
- Display your dashboard, cards, rings, and widgets.
- Save your preferences.
- Export supported Google Health weight, sleep, and workout records to Apple Health on iOS when you start the export.
- Avoid rewriting unchanged Apple Health records.

## Storage

On native platforms, OpenFit stores OAuth tokens and app preferences in local secure platform storage. Widget data, cached summaries, and Apple Health sync ledger entries are stored locally on your device. On web, token and preference data may be stored in browser storage.

OpenFit server routes may process OAuth authorization codes and token refresh requests so the app can connect to Google. Before publishing, verify that the deployed hosting environment does not persist OAuth tokens, request bodies, or health data in logs.

## How We Protect Your Data

OpenFit encrypts data in transit using HTTPS/TLS when communicating with Google APIs and OpenFit server routes. OAuth client secrets are kept on the server and are not included in the app. On iOS and Android, OAuth tokens are stored using the operating system's protected Keychain or Keystore through Expo SecureStore. Access is limited to the app features that need the data.

OpenFit does not maintain a server-side database of your Google Health records. During sign-in, the server temporarily holds the OAuth result in memory for no more than two minutes so the app can retrieve it. The result is deleted immediately after retrieval or when that two-minute period expires. Health data is fetched from Google when needed and processed for the dashboard, widgets, and user-requested Apple Health export.

On the web, OAuth tokens and preferences are stored in browser local storage and are protected by the browser's same-origin controls and the security of your browser and device. Do not use OpenFit on a shared or untrusted device, and sign out when finished. No method of storage or transmission is completely secure, but we use reasonable technical and organizational safeguards to prevent unauthorized access, alteration, disclosure, or destruction.

## Data Retention and Deletion

- OAuth tokens remain on your device or in your browser until you sign out, the tokens expire or are revoked, you clear the app or browser data, or you uninstall the app.
- Google Health dashboard data is held in an in-memory cache only while the app is running. Widget summaries and Apple Health sync ledger entries remain locally until they are replaced, cleared by the app, or removed when you clear app data or uninstall OpenFit.
- Dashboard and widget preferences remain locally until you clear app or browser data or uninstall OpenFit.
- The temporary server-side OAuth callback session is deleted after retrieval and always expires within two minutes. OpenFit does not retain Google Health records in a server-side user database.

To delete locally stored Google user data, sign out of OpenFit and clear the app's data or uninstall it. On the web, sign out and clear site data for OpenFit in your browser. You can also revoke OpenFit's access from your Google Account permissions. To request help with deletion or receive confirmation about data associated with your use of OpenFit, contact `TODO_SUPPORT_EMAIL`.

## Sharing

OpenFit uses Google APIs for sign-in, token exchange, token refresh, and Google Health data access. On iOS, OpenFit uses Apple Health only when you grant permission and start the export.

We do not sell personal data. We do not use health data for advertising.

## Your Choices

You can revoke Google access from your Google account settings. You can revoke Apple Health permissions in the iOS Health app or iOS Settings. Signing out removes stored Google OAuth tokens and clears current health summaries from the app and widgets.

## Children

OpenFit is not intended for children. Set the exact store target audience and age limits before publishing.

## Changes

We may update this policy as OpenFit changes. The hosted policy should show the effective date above.

## Contact

For privacy or support questions, contact `TODO_SUPPORT_EMAIL`.
