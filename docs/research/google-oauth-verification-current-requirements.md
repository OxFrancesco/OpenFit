# Current Google OAuth verification requirements

Verified against current first-party Google documentation on 2026-07-17.

## Console locations

- **Scope configuration:** select the production project, then open **Google Auth Platform → Data Access** at <https://console.cloud.google.com/auth/scopes>. Click **Add or remove scopes**, select or manually enter every scope the production client requests, and click **Update**. Remove obsolete scopes with the delete icon. Google states that scopes removed from this page must also be removed from OAuth requests; requested scopes that are not registered can trigger the unverified-app warning. [Manage App Data Access](https://support.google.com/cloud/answer/15549135?hl=en)
- **Audience and publishing status:** open **Google Auth Platform → Audience** at <https://console.cloud.google.com/auth/audience>. A public application should be **External** and **In production**. [Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=en)
- **Verification state:** use the Google Auth Platform Verification Center after selecting the same production project. Google requires every production scope to be declared in Data Access and the project scope list to match the scopes requested by the app. [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), [OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies)

## Scope alignment checklist

1. Select the production Google Cloud project.
2. In **Data Access**, make the configured scope strings exactly match the production authorization request.
3. Delete every scope the production app no longer requests.
4. If an expected scope is missing from the picker, first confirm the corresponding API is enabled; otherwise use **Manually add scopes**.
5. Confirm no other OAuth client in the verification project requests an undeclared or obsolete scope.

Google's policy requires the Cloud project configuration to match the scopes requested by the application and requires the smallest set necessary for the user-facing feature. [OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies), [Requesting Minimum Scopes](https://support.google.com/cloud/answer/13807380?hl=en)

## Audience, test users, and publishing

- **Testing / External** is intended for development. Only listed test users can authorize non-basic scopes, there is a hard limit of 100 test users, and authorizations (including refresh tokens) expire after seven days.
- **In production / External** is the correct state for a public app in verification. Google says development, testing, and staging apps are not applicable for verification and directs developers to publish before preparing/submitting. [Submitting your app for verification](https://support.google.com/cloud/answer/13461325?hl=en)
- Cloud **test users** and Google **reviewer access** are different. Once the app is in production, the Cloud test-user list is not used. If Fitty has its own sign-in, enrollment, or allowlist, authorize the reviewer email supplied in Google's review email there. If Google specifically requires a separate staging project, its in-app-testing instructions say to configure that project's publishing status as **In Production**. [In-app Testing](https://support.google.com/cloud/answer/13807382?hl=en)

## Demo video

The replacement video must show:

1. The same submitted application, including its name and branding.
2. The complete end-to-end OAuth grant flow.
3. The entire Google consent screen in **English**.
4. The exact scopes submitted for verification.
5. The browser address bar containing the relevant OAuth client ID.
6. The visible, user-facing OpenFit functionality powered by **each** requested sensitive scope.
7. Every OAuth flow and OAuth client in the project if more than one client is assigned to the project.

Voice or on-screen narration is recommended to identify each scope-backed feature. [Manage App Data Access](https://support.google.com/cloud/answer/15549135?hl=en), [Demo Video](https://support.google.com/cloud/answer/13804565?hl=en)

For a new Verification Center submission, Google's production-readiness guide expects a YouTube link, commonly an **Unlisted** upload. For a replacement requested by the review team, Google explicitly accepts an accessible YouTube, Google Drive, or other accessible link sent by replying directly to the review email thread. [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), [Demo Video](https://support.google.com/cloud/answer/13804565?hl=en)

## Reviewer access and reply contents

Reply in the existing verification email thread with:

- the production login URL;
- confirmation that the reviewer email from Google's message is allowlisted in OpenFit, or a fully authorized local test username and password;
- step-by-step navigation from login through OAuth consent to every reviewed feature;
- any extra input required to exercise those features;
- the accessible replacement video link.

If a local test account is supplied, disable two-factor authentication and remove other blockers. Google specifically requires sufficient authorization to reach the consent flow and test application functionality. [In-app Testing](https://support.google.com/cloud/answer/13807382?hl=en)

## Recommended execution order

1. Align Data Access scopes with the deployed authorization request.
2. Confirm Audience is External / In production.
3. Allowlist the reviewer in Fitty's access layer or prepare a blocker-free local test account.
4. Revoke the old user grant and run a fresh OAuth flow so the current consent screen is displayed.
5. Record the English consent screen and every scope-backed user-facing feature.
6. Upload the video with reviewer-accessible permissions.
7. Reply in the original verification thread with the video, access details, and navigation instructions.
