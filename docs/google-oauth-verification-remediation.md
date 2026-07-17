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

- [x] Confirm all production authorization URLs and manifests use the exact six-scope contract above.
- [x] Confirm the production OAuth client belongs to Google Cloud project `fitty-1780912487832` (`657456156321`).
- [x] Confirm the deployed privacy policy contains OpenFit's Google Health API Limited Use affirmation.
- [x] In Google Auth Platform → Data Access, remove the obsolete email and Google Health profile scopes.
- [x] Confirm Data Access contains `openid`, the canonical profile permission, and the four exact read-only Google Health scopes.
- [x] Save the Data Access configuration and update the in-review verification request.
- [x] Deploy the aligned web build at `https://avg-francesco-fitty.expo.app` (deployment `d163l2iqaq`).
- [ ] Revoke OpenFit access from the demonstration Google account to clear historical grants.
- [ ] Start a fresh sign-in and inspect the complete consent details in English.
- [ ] Confirm the fresh request contains all six scopes and no additional scope.
- [ ] Exercise every feature in the demonstration shot list below with the same fresh grant.
- [ ] Capture a new video only after the preceding checks pass.

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

Insert the new video URL and complete the pre-send checklist before sending. Do not paste credentials into this email.

```text
Hello Third-Party Data Safety Team,

Thank you for the guidance. We have updated OpenFit to follow least privilege and aligned the production OAuth request with the Data Access configuration in our Google Cloud project.

We also redeployed the public homepage so it clearly explains OpenFit's purpose and uses the same OpenFit app name shown on the OAuth consent screen.

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
Production URL: https://avg-francesco-fitty.expo.app
Production deployment: d163l2iqaq

OpenFit has no separate local login, subscription, payment requirement, or preconfigured tenant. Reviewers can open the public URL and use Google's OAuth flow with their Google Account; no OpenFit username or password is required.

Reviewer navigation:
1. Open https://avg-francesco-fitty.expo.app.
2. Select “Sign in with Google.”
3. Expand and approve the displayed consent permissions.
4. Review Activity and Metrics, then use the Today, 7D, 14D, 30D, and 90D ranges.
5. Select Metrics → Edit to show sleep, heart/body, Calories eaten, and Hydration cards.
6. Open Health coach from the dashboard header and submit a health-history question.
7. Open Settings → Widgets to review widget metric selection.
8. On iOS, open Settings → Apple Health and select Export to demonstrate the optional user-started Google-to-Apple Health flow.

Please continue the verification review using the updated build and video. We are happy to clarify any remaining item.

Best regards,
Francesco Oddo
Developer, OpenFit
oddofrancesco000@gmail.com
```

## Pre-Send Gate

- [x] The deployed runtime and Google Cloud Data Access list match the six-scope contract exactly.
- [ ] A fresh grant shows only the expected consent permissions.
- [ ] The video URL is accessible without requesting access.
- [x] The submitted production URL is reachable by the reviewer.
- [x] The email explains that no separate OpenFit test credentials are required.
- [ ] The demonstration video placeholder in the reply was replaced.
- [ ] No credential or secret appears in the email, video, or repository.
