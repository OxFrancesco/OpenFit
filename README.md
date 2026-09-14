# OpenFit

[![Download for Android](https://img.shields.io/badge/Download_for_Android-OpenFit.apk-2e7d32?style=for-the-badge&logo=android&logoColor=white)](https://github.com/OxFrancesco/OpenFit/releases/latest/download/OpenFit.apk)

Android 8 or newer, ARM64 devices. Download the APK on your phone, open it, and allow installation from your browser when Android asks. Install future versions over the existing app to keep your data. See [release notes](https://github.com/OxFrancesco/OpenFit/releases/latest).

OpenFit reads Apple Health on iPhone and Health Connect on Android. Clerk manages email and optional Google sign-in. Health permission is separate from the account. The Google Health cloud integration and the Apple Health export are retired.

The dashboard has configurable activity rings, metric cards and home-screen widgets. The exercise catalog and gym log work locally. Settings exports available device health, gym logs and goals as Markdown with a ready-made AI prompt. The web app supports accounts, training and local gym-log exports, but cannot read phone health records.

## Run locally

Use Bun and the Expo SDK 56 versioned documentation. Reuse an existing project server before starting another.

```sh
bun install
bun run start
bun run android
bun run ios
```

Native health modules need a development or release build. Expo Go and a JavaScript-only update cannot install them.

The app uses `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_BASE_URL`. Server routes use `CLERK_SECRET_KEY`, `HEALTH_AGENT_URL`, and `HEALTH_AGENT_CLERK_API_TOKEN`. Keep secrets in local environment files and the hosting provider. Legacy Google client secrets are unused.

## Validate

```sh
bun run lint
bunx tsc --noEmit
bun run test
bun run --cwd workers/health-agent check
bunx expo export --platform web
```

These checks do not establish physical-device permission or real-record behavior. Test both native platforms before a store release.

## Health behavior

Android supports up to 30 days. Widgets refresh while OpenFit is in the foreground and, when the user grants Health Connect background read, every 30 minutes from the widget task handler. Summed widget metrics reset to `--` after local midnight until the next read. iPhone also supports 90 days. Missing health records remain empty. The app does not write to either health store. Workouts recorded by other apps appear read-only under Workouts > History.

The built-in coach has been removed. Markdown exports are created locally and include 30 days of available device health, all gym logs saved on the device, daily goals and a prompt. Users choose where to share the file. Account credentials and Strava/Garmin connections are excluded. Strava and Garmin remain connection-only and require the existing provider approval flags.

See [device health migration](docs/device-health-migration.md) for privacy behavior, retired-token cleanup, Google verification cleanup and release requirements. Existing Google-linked accounts retain their previous server storage identifier. Email-only accounts use the Clerk user identifier.

## Deploy

The web app uses Expo Hosting. Export first, then deploy to the existing project.

```sh
bunx eas-cli deploy --prod --non-interactive --environment production
```

The [health agent](workers/health-agent/README.md) uses the personal Cloudflare account pinned in its Wrangler config. Reports publish through `/Volumes/T6-7/Coding/Personal/Reports`.
