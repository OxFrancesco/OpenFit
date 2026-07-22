# OpenFit Privacy Policy Draft

Effective date: July 14, 2026

This is a store-submission working copy. The hosted OpenFit privacy policy is the authoritative version and must be reviewed alongside this draft before submission.

## Who We Are

OpenFit is provided by Francesco Oddo.

Contact: oddofrancesco000@gmail.com

## What OpenFit Does

OpenFit signs in with Google, reads Google Health data with your permission, and displays that data in a configurable dashboard and home-screen widgets.

The Personal Health-Data Coach uses your questions and relevant Google Health data to help you understand your wellness information. On iOS, OpenFit can export selected records to Apple Health when you start that sync.

OpenFit is a personal wellness utility. It does not provide medical advice, diagnosis, or treatment.

## Data We Access

OpenFit may access:

- Your stable Google account identifier and basic profile name, which are needed for sign-in, account connection, and the personalized greeting.
- Google Health data you authorize, including activity, sleep, health metrics and measurements, and nutrition data.
- Dashboard preferences, widget preferences, cached health summaries, and sync status.
- Questions, messages, and voice recordings you submit when using the Personal Health-Data Coach.
- On iOS, Apple Health permissions and Apple Health write results for records you choose to export.

## How We Use Data

We use data to:

- Sign you in with Google.
- Fetch and refresh your Google Health data.
- Display your dashboard, cards, rings, and widgets.
- Save your preferences.
- Process your questions and relevant Google Health data through our Cloudflare-based Personal Health-Data Coach to generate responses.
- Send voice recordings to ElevenLabs for speech-to-text transcription before submitting the resulting text to the coach.
- Export supported Google Health weight, sleep, and workout records to Apple Health on iOS when you start the export.
- Avoid rewriting unchanged Apple Health records.

## Storage

On native platforms, OpenFit stores OAuth tokens and app preferences in local secure platform storage. Widget data, cached summaries, and Apple Health sync ledger entries are stored locally on your device.

On web, OAuth tokens and preferences may be stored in browser storage.

OpenFit server routes process OAuth authorization codes and token refresh requests so the app can connect to Google.

When you use the coach, OpenFit stores an encrypted Google refresh token on Cloudflare so the coach can access authorized data when answering your questions.

Coach messages are encrypted at rest and retained for up to 90 days unless you delete the conversation sooner.

## How We Protect Your Data

OpenFit encrypts data in transit using HTTPS/TLS when communicating with Google APIs and OpenFit server routes. OAuth client secrets are kept on the server and are not included in the app.

On iOS and Android, OAuth tokens are stored using the operating system's protected Keychain or Keystore through Expo SecureStore. Coach refresh tokens and messages are encrypted at rest on Cloudflare.

The coach fetches relevant Google Health data when needed and processes it with your question through Cloudflare infrastructure and AI services to generate an answer.

On the web, OAuth tokens and preferences are stored in browser local storage and are protected by the browser's same-origin controls and the security of your browser and device.

Do not use OpenFit on a shared or untrusted device, and sign out when finished. No method of storage or transmission is completely secure.

We use reasonable technical and organizational safeguards to prevent unauthorized access, alteration, disclosure, or destruction.

## Data Retention and Deletion

- Local OAuth tokens remain on your device or in your browser until you sign out, the tokens expire or are revoked, you clear app or browser data, or you uninstall OpenFit.
- Google Health dashboard data is held in an in-memory cache only while the app is running. Widget summaries and Apple Health sync ledger entries remain locally until they are replaced, cleared by the app, or removed when you clear app data or uninstall OpenFit.
- Dashboard and widget preferences remain locally until you clear app or browser data or uninstall OpenFit.
- The encrypted server-side Google refresh token remains while your coach connection is active. Revoking OpenFit in your Google Account prevents further Google data access.
- Coach messages are retained for up to 90 days. You can delete the full conversation sooner from the coach screen, which removes it from every device.

To delete locally stored Google user data, sign out of OpenFit and clear the app's data or uninstall it. On the web, sign out and clear site data for OpenFit in your browser.

You can revoke OpenFit's access from your Google Account permissions. To request deletion of other data associated with your use of OpenFit, contact oddofrancesco000@gmail.com.

## Sharing

OpenFit uses Google APIs for sign-in, token exchange, token refresh, and Google Health data access. Cloudflare infrastructure stores encrypted coach tokens and messages.

Cloudflare AI services process questions, conversation history, and relevant Google Health data to generate coach responses.

Voice recordings are sent to ElevenLabs for transcription. On iOS, OpenFit uses Apple Health only when you grant permission and start the export.

We do not sell personal data. We do not use health data for advertising.

## Google Health API Limited Use

OpenFit's use of Google Health API information complies with the Google Health API Developer and User Data Policy, including its Limited Use requirements.

## Your Choices

You can revoke Google access from your Google account settings. You can revoke Apple Health permissions in the iOS Health app or iOS Settings.

Signing out removes local Google OAuth tokens and clears current health summaries from the app and widgets. You can delete stored coach messages from the coach screen.

## Children

OpenFit is not intended for children. Set the exact store target audience and age limits before publishing.

## Changes

We may update this policy as OpenFit changes. The hosted policy should show the effective date above.

## Contact

For privacy or support questions, contact oddofrancesco000@gmail.com.
