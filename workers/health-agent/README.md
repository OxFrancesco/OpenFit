# OpenFit health agent

The Cloudflare worker handles coach conversations and optional fitness connections in per-account Durable Objects. Expo server routes verify Clerk sessions and call the worker with a server-only bearer token. Google Health cloud access is retired.

The worker uses `TOKEN_ENCRYPTION_KEY` for encrypted messages and fitness credentials. Configure `HEALTH_AGENT_CLERK_API_TOKEN` on both the worker and Expo Hosting. Never place either value in the mobile app. Keep the personal Cloudflare account pinned in `wrangler.jsonc`.

```sh
bun install
bun run check
bun run test
bun run deploy
```

Agent endpoints use `/agents/fitty-health-agent/{accountStorageId}` and require the server bearer token. Existing Google-linked accounts preserve their old storage identifier; email-only accounts use the Clerk user ID.

- `GET /status` reports account availability, not device permissions.
- `POST /ask` accepts a question and an optional bounded `deviceHealth` summary. Without that summary the worker does not obtain new health data.
- `GET /messages` and `DELETE /messages` manage encrypted conversations.
- Previous Google connection, snapshot and data-point endpoints return 410.
- Fitness connection endpoints retain the provider approval flags in Wrangler configuration. Both Strava flags must be true before activation; Garmin needs partner approval and confirmed endpoint settings.

The coach does not receive fitness credentials or provider data. Conversation messages expire after 90 days. Legacy Google credentials are discarded when an existing agent starts. See [migration checks](../../docs/device-health-migration.md).

Fitness OAuth request and response shapes:

```text
GET /fitness/connections
  -> { "connections": [{ "provider", "state", "connectedAt"?, "externalAccountLabel"?, "grantedScopes", "unavailableReason"? }] }

POST /fitness/oauth/{provider}/start
  <- { "state": "...", "redirectUri": "https://..." }
  -> { "authorizationUrl": "https://..." }

POST /fitness/oauth/{provider}/complete
  <- { "state": "...", "code"?: "...", "error"?: "...", "scope"?: "...", "linkChallenge": "<base64url SHA-256>" }
  -> { "provider", "state": "pending", "completionId": "..." }

POST /fitness/oauth/{provider}/finalize
  <- { "completionId": "...", "linkVerifier": "<client-held verifier>" }
  -> { "provider", "state": "connected", "connectedAt", "externalAccountLabel"?, "grantedScopes" }

DELETE /fitness/connections/{provider}
  -> the resulting sanitized connection summary

DELETE /fitness/connections/{provider}?forceLocal=true
  -> erases only the encrypted local credential after the user has revoked OpenFit at the provider
```

The caller may forward Strava's callback `scope` parameter to `/complete`, but `/complete` only creates an encrypted pending record. The authenticated app must prove the client-held verifier at `/finalize` before the worker exchanges the provider code and stores credentials. The token response remains authoritative and Strava requires only the minimal `read` scope. Garmin uses server-generated S256 PKCE and partner-confirmed endpoints, then resolves the immutable Garmin user ID and granted permissions before saving the connection. Normal disconnect revokes the provider registration before local deletion. Forced local deletion is an authenticated fallback for a user who already revoked OpenFit directly at the provider.
