# OpenFit Health Agent

Cloudflare Worker Agent for reading and answering questions over Google Health API data through a per-user Durable Object.

## Shape

- Runtime: Cloudflare Workers + Agents SDK + SQLite Durable Objects.
- Auth: bearer token for API calls; the app passes its Google OAuth refresh token to the per-user agent.
- Google tokens: refresh tokens are AES-GCM encrypted before being stored in agent state.
- Coach messages: AES-GCM encrypted at rest, retained for up to 90 days, and user-deletable.

## Setup

```sh
cd workers/health-agent
bun install
bun run types
```

Update `wrangler.jsonc`:

- `GOOGLE_CLIENT_ID`
- `ALLOWED_ORIGINS`
- `AI_MODEL` if you want a different Workers AI text model

Set secrets:

```sh
bunx wrangler secret put GOOGLE_CLIENT_SECRET
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

## Notes

The Expo app owns the Google consent flow and securely connects its refresh token to the matching per-user agent. The worker does not request Google OAuth scopes itself.

`HEALTH_AGENT_API_TOKEN` is a coarse bearer secret. Do not ship it in the mobile app; replace it with user-scoped auth or call this worker from trusted server code before exposing it to multiple users.

The answer endpoint is not medical advice. It summarizes and compares the Google Health data available to the worker.
