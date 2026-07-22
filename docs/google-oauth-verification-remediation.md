# Google OAuth Verification Remediation Packet

Use this packet only after the matching production build is deployed. Do not send the reply template or record the final video while any runtime, consent-screen, or Console scope differs from this contract.

## Final Runtime Scope Contract

Every production OAuth entry point must request exactly these six strings:

```text
openid
https://www.googleapis.com/auth/userinfo.profile
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
| `https://www.googleapis.com/auth/userinfo.profile` | Reads the account's basic profile name so the dashboard can show a personalized greeting. OpenFit does not request the account email address. |
| `googlehealth.activity_and_fitness.readonly` | Reads steps, energy, distance, active time, and workouts for activity rings, dashboard cards, date ranges, widgets, coach context, and user-started workout export to Apple Health on iOS. |
| `googlehealth.sleep.readonly` | Reads sleep sessions and duration for the Sleep card, date-range views, coach context, and user-started sleep export to Apple Health on iOS. |
| `googlehealth.health_metrics_and_measurements.readonly` | Reads heart and body measurements for dashboard cards, widgets, coach context, and user-started weight export to Apple Health on iOS. |
| `googlehealth.nutrition.readonly` | Reads calorie-consumption and hydration records for configurable Nutrition dashboard cards, widgets, and date-range views. |

The Apple Health export is a separate, user-started iOS action. It reads the already-authorized Google data and writes selected weight, sleep, and workout records to Apple Health; it never writes to Google Health.

## Google Cloud Data Access Alignment

Complete every item against the deployed build:

- [x] Confirm all production authorization URLs and manifests use the exact six-scope contract above.
- [x] Confirm the production OAuth client belongs to Google Cloud project `fitty-1780912487832` (`657456156321`).
- [x] Confirm the deployed privacy policy contains OpenFit's Google Health API Limited Use affirmation.
- [x] In Google Auth Platform → Data Access, remove the obsolete email and Google Health profile scopes.
- [x] Confirm Data Access contains `openid`, the canonical profile permission, and the four exact read-only Google Health scopes.
- [x] Save the Data Access configuration and update the in-review verification request.
- [x] Deploy the aligned web build at `https://avg-francesco-fitty.expo.app`.
- [x] Revoke OpenFit access from the demonstration Google account to clear historical grants.
- [x] Start a fresh sign-in and inspect the complete consent details in English.
- [x] Confirm the fresh request contains all six scopes and no additional scope.
- [x] Exercise representative scope-backed dashboard features with the same fresh grant.
- [x] Capture a new narrated Helium video after the preceding checks pass.

If Google displays a human-readable permission label instead of a raw scope string, expand the consent details and show the full permission list in the video.

## Reviewer Access

OpenFit has no local application login, subscription, payment gate, or preconfigured tenant. A reviewer opens the public production URL and signs in through Google's own OAuth flow, so there is no OpenFit username or password to supply. State this explicitly in the email reply.

For the demonstration video, use a Google account with representative activity, sleep, body or heart, and nutrition data. Its records must cover the ranges shown in the video.

If Google later specifically requests a dedicated populated account, create one and provide it only through Google's approved secure reviewer channel. Never place a Google password in the email thread.

Before submission, verify that the demonstration account:

- is active and can complete Google sign-in;
- can complete the fresh consent flow without an unexpected recovery challenge;
- has accepted any required Google terms before the reviewer signs in;
- can access every demonstrated OpenFit service; and
- has been tested from a clean install or private browser session using the submitted build.

Never put a password, recovery code, token, client secret, or real credential in this repository, the video, or the email reply. Supply credentials only through Google's secure reviewer field or another approved private channel.

## Step-by-Step Reviewer Navigation

1. Open `https://avg-francesco-fitty.expo.app`.
2. On the OpenFit welcome screen, select **Sign in with Google**.
3. Sign in through Google's OAuth flow with the Google Account you use for review.
4. Review the complete permission list. If Google presents a **See the # services** link, select it first; Google's current granular-consent UI may instead show all four Health permissions directly.
5. Select all four read-only Google Health permissions, then grant consent.
6. Return to OpenFit and wait for the personalized dashboard greeting and health data to load.
7. Use **Today**, **7D**, **14D**, **30D**, and **90D** to show that the dashboard reads the authorized date range.
8. In **Activity**, show rings for activity data. In **Metrics**, select **Edit** and add activity, sleep, heart or body, **Calories eaten**, and **Hydration** cards.
9. Open the **Health coach** button in the dashboard header to use the Personal Health-Data Coach, then submit a question that uses the populated health history. Show the answer in the app.
10. Return to the dashboard, open **Settings**, and use **Widgets → Edit** to select authorized read-only metrics for widget slots.
11. On a physical iPhone, open **Settings → Apple Health**, choose a range, and select **Export**. Grant HealthKit access and show the user-started Google-to-Apple result.
12. Return to **Settings → Account** to show the connected state. Do not sign out until all evidence is recorded.

If a submitted platform does not support Apple Health, label step 11 as an iOS-only feature and demonstrate it in a separate iPhone segment.

## Demonstration Video Shot List

Record one continuous, unedited-enough-to-follow walkthrough in English. Keep the app name, OAuth project, submitted build, and reviewer account consistent.

1. Show the full production URL and the OpenFit welcome screen.
2. Start **Sign in with Google** using an account with no prior OpenFit grant.
3. Show the Google account chooser and the basic-profile consent screen.
4. Show the complete English granular-consent screen. If Google presents a **See the # services** link, select it; otherwise show the directly listed permissions.
5. Pause on all four read-only Health permissions before selecting them, then show them selected.
6. Approve consent and show the return to OpenFit.
7. Show the profile-based greeting, proving the `openid` and `https://www.googleapis.com/auth/userinfo.profile` experience.
8. Show populated activity rings and the selected seven-day range.
9. Show the populated Sleep, total-calorie, and heart-rate cards to evidence the remaining three Health scope categories.
10. End in the production fitness experience.

The narration should name the scope category when its feature appears. Do not show source code as a substitute for user-facing evidence.

## Ready-to-Send Reply to Google

Insert the new video URL and complete the pre-send checklist before sending. Do not paste credentials into this email.

```text
Hello Third-Party Data Safety Team,

Thank you for the guidance. We have updated OpenFit to follow least privilege and aligned the production OAuth request with the Data Access configuration in our Google Cloud project.

We also redeployed the public homepage so it clearly explains OpenFit's purpose and identifies the production integration as OpenFit. Google Cloud branding remains under review, so Google may temporarily identify the OAuth client by its verified production domain during the review flow.

The deployed application now requests only these scopes:

openid
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
https://www.googleapis.com/auth/googlehealth.sleep.readonly
https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly
https://www.googleapis.com/auth/googlehealth.nutrition.readonly

We removed email, Google Health profile and location access, and all Google Health write-only scopes.

Maximum user-facing use of each requested scope:

- openid — Authenticates the Google Account and provides the stable Google subject used to associate the user with their OpenFit session and saved Personal Health-Data Coach conversation.
- https://www.googleapis.com/auth/userinfo.profile — Reads the account's basic profile name so OpenFit can display a personalized dashboard greeting. OpenFit does not request the account email address.
- googlehealth.activity_and_fitness.readonly — Reads steps, active energy, distance, active time, and workouts for activity rings, dashboard cards, selectable date ranges, widgets, Personal Health-Data Coach context, and the optional user-started workout export to Apple Health on iOS.
- googlehealth.sleep.readonly — Reads sleep sessions and duration for the Sleep dashboard card, selectable date ranges, Personal Health-Data Coach context, and the optional user-started sleep export to Apple Health on iOS.
- googlehealth.health_metrics_and_measurements.readonly — Reads heart and body measurements for dashboard cards, widgets, Personal Health-Data Coach context, and the optional user-started weight export to Apple Health on iOS.
- googlehealth.nutrition.readonly — Reads calorie-consumption and hydration records for configurable Nutrition dashboard cards, widgets, and selectable date-range views.

The Apple Health export is a separate user-started iOS action. It reads already-authorized Google data and writes selected weight, sleep, or workout records to Apple Health. It never writes to Google Health.

Updated demonstration video: [DEMO_VIDEO_URL]
Consent-screen permission details begin at: 00:23
Production URL: https://avg-francesco-fitty.expo.app

The new video starts with a fresh OAuth grant and shows Google's complete English granular-consent screen. In the current Google UI the four Health permissions are listed directly rather than behind a “See the # services” link. The video pauses on the complete unselected list, shows all four selected, then demonstrates the corresponding populated activity, sleep, nutrition, and health-metric dashboard features.

OpenFit has no separate local login, subscription, payment requirement, or preconfigured tenant. Reviewers can open the public URL and use Google's OAuth flow with their Google Account; no OpenFit username or password is required.

Reviewer navigation:
1. Open https://avg-francesco-fitty.expo.app.
2. Select “Sign in with Google.”
3. Select the Google Account to use for review.
4. Review the complete permission list. If Google presents a “See the # services” link, click it first; otherwise the four Health permissions are already listed directly.
5. Select the four read-only Google Health permissions, then grant consent.
6. Wait for OpenFit to return to the personalized dashboard and load the authorized data.
7. Open Activity and use the Today, 7D, 14D, 30D, and 90D ranges to review activity-and-fitness data.
8. In Metrics, select Edit and add or review Sleep, heart/body measurements, Calories eaten, and Hydration cards.
9. Open Health coach from the dashboard header and submit a question using the authorized health history.
10. Open Settings → Widgets to review the authorized metric selections.
11. On iOS, open Settings → Apple Health, select a range, and select Export to demonstrate the optional user-started Google-to-Apple Health flow.
12. Open Settings → Account to confirm that the Google Account is connected.

If you specifically require a dedicated Google Account containing representative health data, please identify the approved secure reviewer channel through which it should be provided. We will not place a Google Account password or other credential in this email thread.

Please continue the verification review using the updated build and video. We are happy to clarify any remaining item.

Best regards,
Francesco Oddo
Developer, OpenFit
oddofrancesco000@gmail.com
```

## Pre-Send Gate

- [x] The deployed runtime and Google Cloud Data Access list match the six-scope contract exactly.
- [x] A fresh grant shows only the expected consent permissions.
- [ ] The video URL is accessible without requesting access.
- [x] The submitted production URL is reachable by the reviewer.
- [x] The email explains that no separate OpenFit test credentials are required.
- [ ] The demonstration video placeholder in the reply was replaced.
- [x] No reusable credential or secret appears in the email, video, or repository.
