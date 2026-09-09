# OpenFit (Fitty)

OpenFit is an Expo and React Native app for people who want a clearer view of their Google Health data and gym training across iOS, Android, and web. The repository name is `fitty`, but the installed app name in `app.json` is `OpenFit`.

The app signs in with Google, reads Google Health API data, and turns it into a configurable health dashboard and Personal Health-Data Coach. It also includes a searchable exercise catalog, a device-local gym log, and approval-gated connection flows for Strava and Garmin. The current Strava and Garmin work is connection-only: it does not import or sync provider activity data.

## what the app does

OpenFit is built around these pieces:

- A Google Health dashboard with date ranges for today, 7 days, 14 days, 30 days, and 90 days.
- Configurable rings, cards, and widget metric slots, so the user can decide which metrics matter on the dashboard and on the home screen.
- Native widgets for iOS and Android that show the latest synced metric values outside the app.
- A Personal Health-Data Coach that answers user questions using relevant authorized Google Health context and keeps encrypted conversation history across devices.
- An iOS-only Apple Health export that writes Google Health weight, sleep, and workout records to HealthKit after the user starts the sync.
- A searchable exercise library and local workout history for sets, repetitions, weight, units, and notes.
- Server-owned Strava and Garmin OAuth connections that return only sanitized connection status to the app and remain disabled until their provider-specific approval gates are satisfied.

The app requests read-only Google scopes. It does not write data back to Google Health. The Apple Health flow is one-way:

```text
Google Health API -> OpenFit normalization and sync ledger -> Apple HealthKit
```

That export is intentionally limited. It supports weight, sleep, and workouts because those map cleanly to HealthKit records. It does not mirror steps, heart-rate streams, active energy streams, or distance totals yet because those are easier to duplicate or double count without a stronger import history.

## main features

- Google sign-in through OAuth, using the app's Expo Router API routes for config, callback, token exchange, and token refresh.
- Google Health read-only access for activity and fitness, sleep, health metrics and measurements, and nutrition.
- A per-user Cloudflare health agent with encrypted Google refresh-token, Strava/Garmin credential, and coach-message storage.
- A searchable catalog of gym exercises and a manual workout log stored only on the current device.
- Strava and Garmin connection flows through authenticated Expo BFF routes, with one-use callback state and Garmin S256 PKCE.
- Strict separation between Strava/Garmin credentials and the coach: provider credentials and provider data are not added to AI context or combined with Google Health, another provider, or manual gym logs.
- Metric catalog for steps, calories, distance, floors, elevation, sedentary time, swim strokes, VO2, heart rate, HRV, oxygen saturation, respiratory rate, body metrics, nutrition, hydration, and sleep.
- Dashboard customization for ring metrics, goals, and visible metric cards.
- Snapshot caching so the dashboard can show recent data quickly while it refreshes.
- iOS widget support through `expo-widgets`.
- Android widget support through `react-native-android-widget`.
- Local Expo module in `modules/apple-health-sync` for HealthKit authorization and writes.
- HealthKit sync metadata and a small SecureStore ledger to avoid rewriting unchanged Apple Health records.
- Web support with Expo Router server output and Google, Strava, and Garmin OAuth API routes.

## project layout

```text
src/app                 Expo Router screens and API routes
src/app/index.tsx       Main health dashboard
src/app/settings.tsx    Account, widget, and Apple Health sync settings
src/app/api/google      OAuth config, callback, token, refresh, and session routes
src/app/api/fitness     Authenticated Strava/Garmin BFF start, callback, finalize, and disconnect routes
src/components/fitness  Exercise search, connection cards, and workout-log UI
src/components          Dashboard cards, rings, tabs, editors, and shared UI
src/lib                 Health, fitness, OAuth, widget, cache, prefs, and sync logic
src/widgets             iOS and Android widget renderers and task handlers
modules/apple-health-sync
                        Local Expo module that bridges to HealthKit on iOS
workers/health-agent    Per-user credential owner and Google-only coach worker
docs                    Notes for Google Health -> Apple Health sync behavior
app.json                Expo app config, bundle IDs, HealthKit entitlement, widgets
eas.json                EAS build profiles
```

The generated `ios/` and `android/` folders are not committed. Expo prebuild creates them when you run or build the native app.

## stack

- Expo SDK 56
- React 19.2.3
- React Native 0.85.3
- Expo Router
- Bun for dependency installation and scripts
- TypeScript
- Expo API routes for the Google OAuth server pieces and the Strava/Garmin BFF
- HealthKit through a local Expo module on iOS

Expo SDK 56 requires a modern toolchain. The versioned Expo docs list Node.js 22.13.x as the minimum for SDK 56, React Native 0.85, React 19.2.3, Android SDK 36, and Xcode 26.4 or newer for iOS SDK builds.

## prerequisites

Install these before building from source:

- Git
- Bun
- Node.js 22.13.x or newer
- Xcode 26.4 or newer for iOS builds
- Android Studio with Android SDK 36 for Android builds
- An Expo account and EAS CLI if you want cloud builds
- A Google Cloud project with OAuth credentials that can request the Google Health scopes used by the app

For iOS HealthKit export, use a native iOS build. Expo Go can run parts of the JavaScript app, but it cannot include this repo's native HealthKit module or widget targets.

## install from source

Clone the repo and install dependencies:

```bash
git clone <repo-url>
cd Fitty
bun install
```

Create `.env.local` in the project root:

```bash
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-web-client-secret

# Server-only bridge to the per-user Cloudflare health agent.
HEALTH_AGENT_URL=https://openfit-health-agent.your-subdomain.workers.dev
HEALTH_AGENT_API_TOKEN=use-the-same-secret-configured-on-the-worker

# Server-only fitness OAuth BFF configuration.
# Use a random value of at least 32 characters.
FITNESS_OAUTH_STATE_KEY=replace-with-a-long-random-secret
STRAVA_REDIRECT_URI=https://your-domain.example/api/fitness/strava/callback
GARMIN_REDIRECT_URI=https://your-domain.example/api/fitness/garmin/callback

# Server-only; enables Voice Nutrition Logs.
ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

Optional values for native or deployed builds:

```bash
# Use a stable API origin instead of the local Metro origin.
EXPO_PUBLIC_API_BASE_URL=https://your-domain.example

# Force Google to return to a specific OAuth callback.
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=https://your-domain.example/api/google/callback

# Override the native app return URI if you change the scheme.
EXPO_PUBLIC_GOOGLE_APP_RETURN_URI=fitty:/oauth

# Enable extra debug details in the UI.
EXPO_PUBLIC_DEBUG=1
```

When deploying the API routes, set the same OAuth, health-agent, fitness BFF, and ElevenLabs values in the hosting environment. `.env.local` is only for local development. Never expose the health-agent token, fitness state key, provider client secrets, or ElevenLabs key through an `EXPO_PUBLIC_` variable.

## google oauth setup

Create a Web OAuth client in Google Cloud Console. Add every callback URI the app will use as an authorized redirect URI.

For local simulator development, add:

```text
http://localhost:8081/api/google/callback
```

For a deployed build, add:

```text
https://your-domain.example/api/google/callback
```

For native development on a physical device, use a stable callback URI. Google requires exact redirect URI matches, so LAN URLs like `http://192.168.x.x:8081/api/google/callback` only work if that exact URL is added to the OAuth client. In practice, it is usually cleaner to set `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` to a deployed or tunneled API origin.

The native app return URI is different from the Google redirect URI. Google redirects to `/api/google/callback`; that route then sends the user back into the app with `fitty:/oauth`.

## Strava and Garmin connection setup

Google Health is the app's primary fitness-data provider. Strava and Garmin are optional, connection-only integrations in this version: the app can establish, display, and revoke a connection, but it does not fetch, import, display, or sync activity records from either provider.

The connection flow keeps provider secrets and credentials off the client:

```text
OpenFit app
  -> authenticated Expo BFF route with encrypted, 10-minute callback state
  -> per-user Cloudflare health agent
  -> Strava or Garmin OAuth

Provider callback
  -> Expo BFF callback
  -> encrypted, one-use pending authorization in the per-user agent
  -> opaque completion ID returned to the app
  -> authenticated finalize with a client-held verifier
  -> server-side token exchange and encrypted credential storage in the per-user agent
```

The BFF uses the existing `HEALTH_AGENT_URL` and `HEALTH_AGENT_API_TOKEN` bridge. It also requires:

```bash
FITNESS_OAUTH_STATE_KEY=at-least-32-random-characters
STRAVA_REDIRECT_URI=https://your-domain.example/api/fitness/strava/callback
GARMIN_REDIRECT_URI=https://your-domain.example/api/fitness/garmin/callback
GARMIN_AUTHORIZATION_URL=https://partner-confirmed-garmin-authorization-url
```

Each redirect URI must be the exact public callback registered with that provider. HTTPS is required except for a loopback development URL. Native authorization returns to `fitty://fitness-oauth`; web authorization returns to `/fitness-oauth` on the app origin. Those return URLs carry only a sanitized result and, after successful consent, a random one-use completion ID—never an authorization code or provider token. The provider code remains encrypted on the server until the authenticated app proves possession of the verifier created by the initiating app session.

Configure the matching Worker values in `workers/health-agent/wrangler.jsonc` or an uncommitted `workers/health-agent/.dev.vars` file:

```bash
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
STRAVA_POLICY_APPROVED=false
STRAVA_WEBHOOK_READY=false

GARMIN_CLIENT_ID=your-garmin-client-id
GARMIN_CLIENT_SECRET=your-garmin-client-secret
GARMIN_PARTNER_APPROVED=false
GARMIN_AUTHORIZATION_URL=https://partner-confirmed-garmin-authorization-url
GARMIN_TOKEN_URL=https://partner-confirmed-garmin-token-url
GARMIN_USER_ID_URL=https://partner-confirmed-garmin-user-id-url
GARMIN_PERMISSIONS_URL=https://partner-confirmed-garmin-permissions-url
GARMIN_DISCONNECT_URL=https://partner-confirmed-garmin-disconnect-url

HEALTH_AGENT_API_TOKEN=use-the-same-secret-as-the-bff
TOKEN_ENCRYPTION_KEY=replace-with-a-random-encryption-key
```

For a deployed Worker, keep the Google OAuth credentials, provider client secrets, `HEALTH_AGENT_API_TOKEN`, and `TOKEN_ENCRYPTION_KEY` in Wrangler secrets rather than committed vars:

```bash
cd workers/health-agent
bunx wrangler secret put GOOGLE_CLIENT_ID
bunx wrangler secret put GOOGLE_CLIENT_SECRET
bunx wrangler secret put STRAVA_CLIENT_SECRET
bunx wrangler secret put GARMIN_CLIENT_SECRET
bunx wrangler secret put HEALTH_AGENT_API_TOKEN
bunx wrangler secret put TOKEN_ENCRYPTION_KEY
```

Both integrations fail closed. The flags must contain the exact string `true`, and credentials alone do not activate a provider:

- Keep `STRAVA_POLICY_APPROVED=false` unless Strava has given written clearance that expressly permits this OpenFit use under the API Policy effective June 1, 2026. Keep `STRAVA_WEBHOOK_READY=false` until a verified deauthorization webhook can delete the matching server credential. Both flags must be `true` to activate Strava. The implementation never sends Strava credentials or data to the coach and never combines them with Google Health, Garmin, or manual gym logs.
- Keep `GARMIN_PARTNER_APPROVED=false` until Garmin has approved the application for the Garmin Connect Developer Program and supplied valid OAuth credentials and endpoint values. Garmin endpoints are deliberately environment-configured instead of assumed from unapproved documentation. The Worker generates and retains the S256 PKCE verifier; it is never sent to the app.

Strava requests only the basic `read` scope, validates the token response as authoritative, and stores the returned athlete label and identifier. Garmin resolves only the connected user identifier and granted permission names. Neither implementation calls provider activity endpoints in this version.

Provider access and refresh tokens are encrypted inside the account's per-user health agent. The app receives only a sanitized connection summary. Disconnect first asks Strava to revoke the token or Garmin to delete the registration; the encrypted local credential is deleted only after the provider accepts that request. If remote revocation fails, revoke OpenFit in the provider account first, then the UI offers **Remove from OpenFit** to erase the encrypted server credential. For a complete account-deletion request, disconnect each provider and contact the support address in the app so any remaining per-user server records can be removed and, where required, deletion can be confirmed in writing.

## run the app

Start the Expo development server:

```bash
bun run start
```

Run web:

```bash
bun run web
```

Run iOS from source:

```bash
bun run ios
```

Run Android from source:

```bash
bun run android
```

`bun run ios` and `bun run android` compile native projects locally. If `ios/` or `android/` do not exist yet, Expo generates them from `app.json`, the local Expo module, and the configured plugins.

## native build notes

Use a native build for the full app:

- iOS HealthKit export depends on `modules/apple-health-sync`.
- iOS widgets depend on the `expo-widgets` config in `app.json`.
- Android widgets depend on `react-native-android-widget`.
- The app's generated native projects include the bundle ID/package `com.francescooddo.fitty`.

If native config changes and you want a clean generated project, run:

```bash
bunx expo prebuild --clean
```

Then build again:

```bash
bun run ios
# or
bun run android
```

Do not commit the generated `ios/` or `android/` folders unless the project intentionally switches away from the current generated-native-folder workflow.

## eas builds

The repo includes `eas.json` with three profiles:

- `development`: internal distribution with a development client
- `preview`: internal distribution
- `production`: store build with remote auto-incremented versions

Install or run EAS CLI with a version that satisfies `eas.json`:

```bash
bunx eas-cli@latest whoami
```

Build a preview binary:

```bash
bunx eas-cli@latest build --profile preview --platform ios
bunx eas-cli@latest build --profile preview --platform android
```

Build production binaries:

```bash
bunx eas-cli@latest build --profile production --platform ios
bunx eas-cli@latest build --profile production --platform android
```

Run the same EAS build process on your machine:

```bash
bunx eas-cli@latest build --profile production --platform ios --local
bunx eas-cli@latest build --profile production --platform android --local
```

The iOS production profile is configured for App Store Connect app ID `6779281959`. Release builds need the correct Apple and Google Play signing credentials.

If you use the `development` EAS profile, make sure the project includes `expo-dev-client`, because that profile is meant to produce a development-client build.

## checks

Run TypeScript:

```bash
bunx tsc --noEmit
```

Run lint:

```bash
bun run lint
```

Export the iOS JavaScript bundle:

```bash
bunx expo export --platform ios --output-dir dist/ios
```

Build artifacts, dependencies, native generated folders, and local env files are ignored by git.

## troubleshooting

`Missing GOOGLE_CLIENT_ID in .env.local`

The API route cannot see the OAuth environment variables. Check `.env.local` for local development, or the hosting provider's environment settings for deployed API routes.

`redirect_uri_mismatch`

Add the exact callback URI shown by the app to the Google OAuth Web client. The path should end in `/api/google/callback`.

Google sign-in works on web but not on a native device

The native app may be using a LAN or production API origin that is different from the web origin. Set `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` to a stable origin and add that callback to Google Cloud Console.

Strava or Garmin says unavailable

Check both server layers. The Expo BFF needs `FITNESS_OAUTH_STATE_KEY`, the exact provider `*_REDIRECT_URI`, the Garmin authorization URL, and the health-agent bridge values. The Worker needs a 32-character-or-longer encryption key plus the matching client ID and client secret. Strava additionally requires both `STRAVA_POLICY_APPROVED=true` after written Strava clearance and `STRAVA_WEBHOOK_READY=true` after verified deauthorization cleanup exists. Garmin requires `GARMIN_PARTNER_APPROVED=true` and the partner-confirmed endpoint values. The UI deliberately remains unavailable when a credential, endpoint, cleanup, or approval gate is missing.

The fitness provider callback is rejected

Register the exact callback shown above, including the `/api/fitness/{provider}/callback` path. Query strings, fragments, embedded credentials, non-loopback HTTP URLs, and a callback for the wrong provider are rejected. OAuth state expires after ten minutes and cannot be reused.

Apple Health export is unavailable

Apple Health sync only runs on iOS and needs a native build. It will not work as a real HealthKit bridge in Expo Go, on Android, or on web.

Widgets are empty or stale

Open the app, sign in with Google, then sync from the dashboard or settings. Widgets use the latest stored widget data, so they need at least one successful sync before they can show real values.

## references

- Expo SDK 56 docs: https://docs.expo.dev/versions/v56.0.0/
- Expo CLI docs: https://docs.expo.dev/more/expo-cli/
- EAS Build docs: https://docs.expo.dev/build/introduction/
- Strava API Policy effective June 1, 2026: https://www.strava.com/legal/api_policy
- Garmin Connect Developer Program FAQ: https://developer.garmin.com/gc-developer-program/program-faq/
- Google Health to Apple Health implementation notes: `docs/google-health-to-apple-health-sync.md`

## Material UI and OpenFit accounts

The app uses React Native Paper Material 3 controls, Roboto typography, tonal light and dark
colors, a bottom navigation bar on compact screens, and a navigation rail at widths of 840 or
more. Android wallpaper-derived dynamic color is not currently enabled.

OpenFit accounts use Clerk email codes. Google Health authorization remains a separate
connection. Local workouts are device-wide and do not sync with Clerk accounts.

Before starting a checkout, link the development Clerk application and pull its environment:

```sh
bunx clerk link --app app_3J69VZfQwE2gRw1HBLZtoKMDKma
bunx clerk env pull --instance dev --file .env.local
bun install
bun start
```

The client needs `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Keep `CLERK_SECRET_KEY` in ignored
local environment files and server environments only. The development instance uses email
codes and has the Native API enabled. Configure the same authentication methods and native
application identifiers before using a production instance.

The development dummy account is `openfit+clerk_test@example.com`. Clerk's development
verification code is `424242`. Open Settings, select the OpenFit account, and sign in with
that address. These credentials are for the development instance only.

Run project tests with `bun test ./src/ ./workers/`. The explicit directory paths avoid
including tests from codeview reference repositories.
