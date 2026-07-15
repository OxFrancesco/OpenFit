# OpenFit Health Agent

Cloudflare Worker Agent for reading and answering questions over Google Health API data through a per-user Durable Object. The same isolated agent owns Strava and Garmin OAuth connections, but those credentials never enter the coach's AI context.

## Shape

- Runtime: Cloudflare Workers + Agents SDK + SQLite Durable Objects.
- Auth: bearer token for API calls; the app passes its Google OAuth refresh token to the per-user agent.
- Google tokens: refresh tokens are AES-GCM encrypted before being stored in agent state.
- Fitness provider tokens: Strava and Garmin access/refresh tokens are AES-GCM encrypted in the same per-user agent state.
- OAuth transactions: one-use state and pending, client-bound completions expire after 10 minutes in agent SQLite. Provider codes are encrypted while pending; Garmin PKCE verifiers never leave the worker.
- Coach messages: AES-GCM encrypted at rest, retained for up to 90 days, and user-deletable.

## Setup

```sh
cd workers/health-agent
bun install
bun run types
```

Update `wrangler.jsonc`:

- `GOOGLE_CLIENT_ID`
- `STRAVA_CLIENT_ID`
- `GARMIN_CLIENT_ID`
- partner-confirmed `GARMIN_*_URL` values
- `ALLOWED_ORIGINS`
- `AI_MODEL` if you want a different Workers AI text model

Provider connections are disabled by default. Strava requires both `STRAVA_POLICY_APPROVED=true` after written clearance and `STRAVA_WEBHOOK_READY=true` after verified deauthorization cleanup exists. Garmin requires `GARMIN_PARTNER_APPROVED=true` plus partner-confirmed endpoint values. Do not infer Garmin endpoints before partner approval.

Set secrets:

```sh
bunx wrangler secret put GOOGLE_CLIENT_SECRET
bunx wrangler secret put STRAVA_CLIENT_SECRET
bunx wrangler secret put GARMIN_CLIENT_SECRET
bunx wrangler secret put HEALTH_AGENT_API_TOKEN
bunx wrangler secret put TOKEN_ENCRYPTION_KEY
```

Use a random encryption key:

```sh
openssl rand -base64 32
```

For local development, keep equivalent values in an uncommitted `.dev.vars` file.

Deploy:

```sh
bun run deploy
```

## Agent Endpoints

Agent routes use Cloudflare's standard path:

```text
/agents/fitty-health-agent/{userId}/{endpoint}
```

All data endpoints require:

```text
Authorization: Bearer <HEALTH_AGENT_API_TOKEN>
```

Useful endpoints:

- `GET /status`
- `POST /ask` with `{ "question": "How did my sleep trend this month?", "days": 30 }`
- `GET /messages` to restore the user's coach conversation
- `DELETE /messages` to erase the user's coach conversation
- `POST /snapshot` with `{ "days": 30 }`
- `POST /data-points/list`
- `POST /data-points/rollup`
- `GET /fitness/connections`
- `POST /fitness/oauth/{strava|garmin}/start`
- `POST /fitness/oauth/{strava|garmin}/complete`
- `POST /fitness/oauth/{strava|garmin}/finalize`
- `DELETE /fitness/connections/{strava|garmin}`

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

## Notes

The Expo app owns the Google consent flow and securely connects its refresh token to the matching per-user agent. The worker does not request Google OAuth scopes itself.

Strava and Garmin consent flows are owned by the worker through trusted server-side BFF routes. Client secrets and provider credentials must never be returned to or stored by the Expo app. Provider credentials are deliberately excluded from `answerQuestion`, `fetchHealthContext`, snapshots, and all model input.

`HEALTH_AGENT_API_TOKEN` is a coarse bearer secret. Do not ship it in the mobile app; replace it with user-scoped auth or call this worker from trusted server code before exposing it to multiple users.

The answer endpoint is not medical advice. It summarizes and compares the Google Health data available to the worker.
