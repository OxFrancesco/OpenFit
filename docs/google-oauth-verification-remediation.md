# Google OAuth Verification Remediation Packet

Use this packet only after the matching production build is deployed. Do not send the reply template or record the final video while any runtime, consent-screen, or Console scope differs from this contract.

## Final Runtime Scope Contract

Every production OAuth entry point must request exactly these six strings:

```text
openid
profile
https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
https://www.googleapis.com/auth/googlehealth.sleep.readonly
https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly
https://www.googleapis.com/auth/googlehealth.nutrition.readonly
```

Do not request `email`, Google Health profile or location access, any write-only scope, or any scope reserved for a future feature.

## Maximum User-Facing Scope Justifications

These descriptions connect each backend read to the complete production experience. They describe read-only use and do not claim that OpenFit writes to Google Health.

| Scope | Maximum user-facing use |
| --- | --- |
| `openid` | Authenticates the Google account and provides the stable Google subject used to associate the user with their OpenFit session and saved Personal Health-Data Coach conversation. |
| `profile` | Reads the account's basic profile name so the dashboard can show a personalized greeting. OpenFit does not request the account email address. |
| `googlehealth.activity_and_fitness.readonly` | Reads steps, energy, distance, active time, and workouts for activity rings, dashboard cards, date ranges, widgets, coach context, and user-started workout export to Apple Health on iOS. |
| `googlehealth.sleep.readonly` | Reads sleep sessions and duration for the Sleep card, date-range views, coach context, and user-started sleep export to Apple Health on iOS. |
| `googlehealth.health_metrics_and_measurements.readonly` | Reads heart and body measurements for dashboard cards, widgets, coach context, and user-started weight export to Apple Health on iOS. |
| `googlehealth.nutrition.readonly` | Reads calorie-consumption and hydration records for configurable Nutrition dashboard cards, widgets, and date-range views. |

The Apple Health export is a separate, user-started iOS action. It reads the already-authorized Google data and writes selected weight, sleep, and workout records to Apple Health; it never writes to Google Health.

## Google Cloud Data Access Alignment

Complete every item against the deployed build:

- [ ] Confirm all production authorization URLs and manifests use the exact six-scope contract above.
- [ ] Confirm iOS, Android, and web OAuth clients belong to the Google Cloud project submitted for verification.
- [ ] Confirm the deployed privacy policy contains OpenFit's Google Health API Limited Use affirmation.
- [ ] In Google Auth Platform → Data Access, remove every scope outside the six-scope contract.
- [ ] Add any missing scope from the contract and confirm an exact string match.
- [ ] Save the Data Access configuration and allow time for the change to propagate.
- [ ] Deploy the aligned build and record its version, build number, and test URL.
- [ ] Revoke OpenFit access from the demonstration Google account to clear historical grants.
- [ ] Start a fresh sign-in and inspect the complete consent details in English.
- [ ] Confirm the fresh request contains all six scopes and no additional scope.
- [ ] Exercise every feature in the demonstration shot list below with the same fresh grant.
- [ ] Capture a new video only after the preceding checks pass.

If Google displays a human-readable permission label instead of a raw scope string, expand the consent details and show the full permission list in the video.

## Test Account Requirements

Create a dedicated reviewer account with representative activity, sleep, body or heart, and nutrition data. Its records must cover the ranges shown in the video.

Before submission, verify that the account:

- is active and can complete Google sign-in;
- is included as an OAuth test user if the app remains in Testing;
- has no two-step verification, phone challenge, passkey-only flow, payment, or subscription blocker;
- has accepted any required Google terms before the reviewer signs in;
- can access every demonstrated OpenFit service without setup by the reviewer; and
- has been tested from a clean install or private browser session using the submitted build.

Never put a password, recovery code, token, client secret, or real credential in this repository, the video, or the email reply. Supply credentials only through Google's secure reviewer field or another approved private channel.

## Step-by-Step Reviewer Navigation

1. Install or open `[PRODUCTION_BUILD_OR_URL]`.
2. On the OpenFit welcome screen, select **Sign in with Google**.
3. Sign in with the test account supplied through `[SECURE_CREDENTIAL_CHANNEL]`.
4. Review the expanded consent details, then grant the six requested permissions.
5. Return to OpenFit and wait for the personalized dashboard greeting and health data to load.
6. Use **Today**, **7D**, **14D**, **30D**, and **90D** to show that the dashboard reads the authorized date range.
7. In **Activity**, show rings for activity data. In **Metrics**, select **Edit** and add activity, sleep, heart or body, **Calories eaten**, and **Hydration** cards.
8. Open the **Health coach** button in the dashboard header to use the Personal Health-Data Coach, then submit a question that uses the populated health history. Show the answer in the app.
9. Return to the dashboard, open **Settings**, and use **Widgets → Edit** to select authorized read-only metrics for widget slots.
10. On a physical iPhone, open **Settings → Apple Health**, choose a range, and select **Export**. Grant HealthKit access and show the user-started Google-to-Apple result.
11. Return to **Settings → Account** to show the connected state. Do not sign out until all evidence is recorded.

If a submitted platform does not support Apple Health, label step 10 as an iOS-only feature and demonstrate it in a separate iPhone segment.

## Demonstration Video Shot List

Record one continuous, unedited-enough-to-follow walkthrough in English. Keep the app name, OAuth project, submitted build, and reviewer account consistent.

1. Show the production URL or build version and the OpenFit welcome screen.
2. Start **Sign in with Google** using an account with no prior OpenFit grant.
3. Show the Google account chooser and the complete expanded consent screen.
4. Slowly show every displayed permission and confirm there are no location or write permissions.
5. Approve consent and show the return to OpenFit.
6. Show the profile-based greeting, proving the `openid` and `profile` experience.
7. Show activity rings and activity cards across at least two date ranges.
8. Show the Sleep card with populated test data.
9. Show representative heart or body measurements.
10. Add and show **Calories eaten** and **Hydration** cards.
11. Ask the Personal Health-Data Coach a question that visibly uses authorized Google Health context.
12. Open **Settings → Widgets**, select a health metric, and show the resulting widget if the recording platform supports it.
13. On iOS, show the user-started **Apple Health → Export** flow for weight, sleep, or workouts.
14. End on **Settings → Account** with the connected state visible.

The narration should name the scope category when its feature appears. Do not show source code as a substitute for user-facing evidence.

## Ready-to-Send Reply to Google

Replace every bracketed placeholder and complete the pre-send checklist before sending. Do not paste credentials into this email.

```text
Subject: Re: Google OAuth verification — scope alignment and updated evidence for OpenFit

Hello Third-Party Data Safety Team,

Thank you for the guidance. We have updated OpenFit to follow least privilege and aligned the production OAuth request with the Data Access configuration in our Google Cloud project.

The deployed application now requests only these scopes:

openid
profile
https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
https://www.googleapis.com/auth/googlehealth.sleep.readonly
https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly
https://www.googleapis.com/auth/googlehealth.nutrition.readonly

We removed email, Google Health profile and location access, and all Google Health write-only scopes.

The application reads authorized data for its dashboard, date-range cards, widgets, Personal Health-Data Coach, and optional user-started Google-to-Apple Health export on iOS. It does not write to Google Health.

Updated demonstration video: [DEMO_VIDEO_URL]
Production build or URL: [PRODUCTION_BUILD_OR_URL]
Build version: [VERSION_AND_BUILD]

Active test credentials have been supplied through [SECURE_CREDENTIAL_CHANNEL]. They are not included in this email.

The account has no phone, payment, or two-step-verification blocker and contains representative data for each requested Google Health category.

Reviewer navigation:
1. Open [PRODUCTION_BUILD_OR_URL].
2. Select “Sign in with Google.”
3. Use the test account supplied through [SECURE_CREDENTIAL_CHANNEL].
4. Expand and approve the displayed consent permissions.
5. Review Activity and Metrics, then use the Today, 7D, 14D, 30D, and 90D ranges.
6. Select Metrics → Edit to show sleep, heart/body, Calories eaten, and Hydration cards.
7. Open Health coach from the dashboard header and submit a health-history question.
8. Open Settings → Widgets to review widget metric selection.
9. On iOS, open Settings → Apple Health and select Export to demonstrate the optional user-started Google-to-Apple Health flow.

Please continue the verification review using the updated build and video. We are happy to clarify any remaining item.

Best regards,
[NAME]
[ROLE_OR_COMPANY]
[CONTACT_EMAIL]
```

## Pre-Send Gate

- [ ] The deployed runtime and Google Cloud Data Access list match the six-scope contract exactly.
- [ ] A fresh grant shows only the expected consent permissions.
- [ ] The video URL is accessible without requesting access.
- [ ] The submitted build or URL is reachable by the reviewer.
- [ ] Secure test credentials were tested immediately before submission.
- [ ] Every bracketed placeholder in the reply was replaced.
- [ ] No credential or secret appears in the email, video, or repository.
