import { secureEqual } from "./crypto";
import { HttpError } from "./http";

export const FITNESS_PROVIDERS = ["strava", "garmin"] as const;

export type FitnessProvider = (typeof FITNESS_PROVIDERS)[number];
export type FitnessConnectionState = "connected" | "disconnected" | "unavailable";
export type FitnessUnavailableReason = "approval-required" | "not-configured" | "policy-disabled";

export type FitnessOAuthEnv = {
  GARMIN_AUTHORIZATION_URL?: string;
  GARMIN_CLIENT_ID?: string;
  GARMIN_CLIENT_SECRET?: string;
  GARMIN_DISCONNECT_URL?: string;
  GARMIN_PARTNER_APPROVED?: string;
  GARMIN_PERMISSIONS_URL?: string;
  GARMIN_TOKEN_URL?: string;
  GARMIN_USER_ID_URL?: string;
  STRAVA_CLIENT_ID?: string;
  STRAVA_CLIENT_SECRET?: string;
  STRAVA_POLICY_APPROVED?: string;
  STRAVA_WEBHOOK_READY?: string;
  TOKEN_ENCRYPTION_KEY?: string;
};

export type FitnessConnectionSummary = {
  connectedAt?: string;
  externalAccountLabel?: string;
  grantedScopes: string[];
  provider: FitnessProvider;
  state: FitnessConnectionState;
  unavailableReason?: FitnessUnavailableReason;
};

export type StoredFitnessConnection = {
  connectedAt: string;
  credential: unknown;
  externalAccountLabel?: string;
  grantedScopes: string[];
};

export type ProviderCredential = {
  accessToken: string;
  expiresAt?: number;
  externalAccountId: string;
  externalAccountLabel?: string;
  grantedScopes: string[];
  provider: FitnessProvider;
  refreshToken: string;
  tokenType?: string;
  version: 1;
};

export type FitnessOAuthStartInput = {
  redirectUri: string;
  state: string;
};

export type FitnessOAuthCompleteInput = {
  code?: string;
  error?: string;
  linkChallenge: string;
  scope?: string;
  state: string;
};

export type FitnessOAuthFinalizeInput = {
  completionId: string;
  linkVerifier: string;
};

export type FitnessOAuthPendingCompletion = {
  completionId: string;
  provider: FitnessProvider;
  state: "pending";
};

export type PendingFitnessAuthorization = {
  code: string;
  scope?: string;
  version: 1;
};

export type OAuthTransaction = {
  codeVerifier?: string;
  expiresAt: number;
  provider: FitnessProvider;
  redirectUri: string;
  state: string;
};

type Fetch = typeof fetch;

type OAuthTokenPayload = {
  accessToken: string;
  expiresAt?: number;
  refreshToken: string;
  scopes: string[];
  tokenType?: string;
};

export const STRAVA_AUTHORIZATION_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
export const STRAVA_REVOKE_URL = "https://www.strava.com/oauth/revoke";
export const STRAVA_REQUESTED_SCOPES = ["read"] as const;

const OAUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;
const FITNESS_LINK_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const FITNESS_LINK_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export function parseFitnessProvider(value: string): FitnessProvider {
  if (value === "strava" || value === "garmin") {
    return value;
  }
  throw new HttpError(404, "Fitness provider not found");
}

export function parseFitnessOAuthStartInput(value: unknown): FitnessOAuthStartInput {
  const input = requireRecord(value, "body");
  const state = requiredString(input, "state", 12_000);
  if (state.length < 16) {
    throw new HttpError(400, "state must contain at least 16 characters");
  }

  return {
    redirectUri: requireRedirectUri(requiredString(input, "redirectUri", 2048)),
    state
  };
}

export function parseFitnessOAuthCompleteInput(value: unknown): FitnessOAuthCompleteInput {
  const input = requireRecord(value, "body");
  const state = requiredString(input, "state", 12_000);
  if (state.length < 16) {
    throw new HttpError(400, "state must contain at least 16 characters");
  }

  const code = optionalString(input, "code", 4096);
  const error = optionalString(input, "error", 512);
  if (Boolean(code) === Boolean(error)) {
    throw new HttpError(400, "Exactly one of code or error is required");
  }
  const linkChallenge = requiredString(input, "linkChallenge", 43);
  if (!FITNESS_LINK_CHALLENGE_PATTERN.test(linkChallenge)) {
    throw new HttpError(400, "linkChallenge must be a 43-character base64url SHA-256 digest");
  }

  return {
    code,
    error,
    linkChallenge,
    scope: optionalString(input, "scope", 4096),
    state
  };
}

export function parseFitnessOAuthFinalizeInput(value: unknown): FitnessOAuthFinalizeInput {
  const input = requireRecord(value, "body");
  const completionId = requiredString(input, "completionId", 43);
  if (!FITNESS_LINK_CHALLENGE_PATTERN.test(completionId)) {
    throw new HttpError(400, "completionId must be a 43-character base64url value");
  }

  const linkVerifier = requiredString(input, "linkVerifier", 128);
  if (!FITNESS_LINK_VERIFIER_PATTERN.test(linkVerifier)) {
    throw new HttpError(400, "linkVerifier must be a valid 43-128 character verifier");
  }

  return { completionId, linkVerifier };
}

export function parsePendingFitnessAuthorization(value: unknown): PendingFitnessAuthorization {
  const input = requireRecord(value, "pending fitness authorization", 500);
  const code = input.code;
  const scope = input.scope;
  if (
    input.version !== 1 ||
    typeof code !== "string" ||
    !code ||
    code.length > 4096 ||
    (scope !== undefined && (typeof scope !== "string" || !scope || scope.length > 4096))
  ) {
    throw new HttpError(500, "Stored pending fitness authorization is invalid");
  }
  return {
    code,
    scope: scope as string | undefined,
    version: 1
  };
}

export function generateFitnessOAuthCompletionId(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashFitnessLinkVerifier(linkVerifier: string): Promise<string> {
  if (!FITNESS_LINK_VERIFIER_PATTERN.test(linkVerifier)) {
    throw new HttpError(400, "linkVerifier must be a valid 43-128 character verifier");
  }
  return pkceChallenge(linkVerifier);
}

export async function verifyFitnessLinkChallenge(
  linkVerifier: string,
  expectedChallenge: string
): Promise<boolean> {
  if (!FITNESS_LINK_CHALLENGE_PATTERN.test(expectedChallenge)) {
    return false;
  }
  return secureEqual(await hashFitnessLinkVerifier(linkVerifier), expectedChallenge);
}

export function providerUnavailableReason(
  provider: FitnessProvider,
  env: FitnessOAuthEnv
): FitnessUnavailableReason | undefined {
  if (!present(env.TOKEN_ENCRYPTION_KEY) || env.TOKEN_ENCRYPTION_KEY.trim().length < 32) {
    return "not-configured";
  }
  if (provider === "strava") {
    if (!present(env.STRAVA_CLIENT_ID) || !present(env.STRAVA_CLIENT_SECRET)) {
      return "not-configured";
    }
    if (env.STRAVA_POLICY_APPROVED !== "true" || env.STRAVA_WEBHOOK_READY !== "true") {
      return "policy-disabled";
    }
    return undefined;
  }

  if (
    !present(env.GARMIN_CLIENT_ID) ||
    !present(env.GARMIN_CLIENT_SECRET) ||
    !validProviderUrl(env.GARMIN_AUTHORIZATION_URL) ||
    !validProviderUrl(env.GARMIN_TOKEN_URL) ||
    !validProviderUrl(env.GARMIN_USER_ID_URL) ||
    !validProviderUrl(env.GARMIN_PERMISSIONS_URL) ||
    !validProviderUrl(env.GARMIN_DISCONNECT_URL)
  ) {
    return "not-configured";
  }
  if (env.GARMIN_PARTNER_APPROVED !== "true") {
    return "approval-required";
  }
  return undefined;
}

export function connectionSummary(
  provider: FitnessProvider,
  env: FitnessOAuthEnv,
  connection?: Omit<StoredFitnessConnection, "credential">
): FitnessConnectionSummary {
  const unavailableReason = providerUnavailableReason(provider, env);
  if (connection) {
    return {
      connectedAt: connection.connectedAt,
      externalAccountLabel: connection.externalAccountLabel,
      grantedScopes: [...connection.grantedScopes],
      provider,
      state: "connected"
    };
  }
  if (unavailableReason) {
    return {
      grantedScopes: [],
      provider,
      state: "unavailable",
      unavailableReason
    };
  }
  return {
    grantedScopes: [],
    provider,
    state: "disconnected"
  };
}

export async function createOAuthTransaction(
  provider: FitnessProvider,
  input: FitnessOAuthStartInput,
  now = Date.now()
): Promise<OAuthTransaction> {
  return {
    codeVerifier: provider === "garmin" ? (await generatePkcePair()).verifier : undefined,
    expiresAt: now + OAUTH_TRANSACTION_TTL_MS,
    provider,
    redirectUri: input.redirectUri,
    state: input.state
  };
}

export async function buildAuthorizationUrl(
  transaction: OAuthTransaction,
  env: FitnessOAuthEnv
): Promise<string> {
  requireProviderAvailable(transaction.provider, env);

  if (transaction.provider === "strava") {
    const url = new URL(STRAVA_AUTHORIZATION_URL);
    url.search = new URLSearchParams({
      approval_prompt: "auto",
      client_id: requiredEnv(env.STRAVA_CLIENT_ID, "STRAVA_CLIENT_ID"),
      redirect_uri: transaction.redirectUri,
      response_type: "code",
      scope: STRAVA_REQUESTED_SCOPES.join(","),
      state: transaction.state
    }).toString();
    return url.toString();
  }

  if (!transaction.codeVerifier) {
    throw new HttpError(500, "Garmin OAuth transaction is missing its PKCE verifier");
  }
  const challenge = await pkceChallenge(transaction.codeVerifier);
  const url = new URL(
    requiredProviderUrl(env.GARMIN_AUTHORIZATION_URL, "GARMIN_AUTHORIZATION_URL")
  );
  url.search = new URLSearchParams({
    client_id: requiredEnv(env.GARMIN_CLIENT_ID, "GARMIN_CLIENT_ID"),
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: transaction.redirectUri,
    response_type: "code",
    state: transaction.state
  }).toString();
  return url.toString();
}

export async function exchangeAuthorizationCode(
  transaction: OAuthTransaction,
  code: string,
  callbackScope: string | undefined,
  env: FitnessOAuthEnv,
  fetchImpl: Fetch = fetch
): Promise<ProviderCredential> {
  requireProviderAvailable(transaction.provider, env);
  if (transaction.provider === "strava") {
    return exchangeStravaCode(transaction, code, callbackScope, env, fetchImpl);
  }
  return exchangeGarminCode(transaction, code, env, fetchImpl);
}

export async function refreshProviderCredential(
  credential: ProviderCredential,
  env: FitnessOAuthEnv,
  fetchImpl: Fetch = fetch
): Promise<ProviderCredential> {
  // Existing users must remain able to rotate/revoke credentials even if a
  // partner or policy gate is later disabled. Only client configuration is
  // required for these cleanup paths.
  requireProviderClientConfigured(credential.provider, env);
  const token =
    credential.provider === "strava"
      ? await fetchStravaToken(
          new URLSearchParams({
            client_id: requiredEnv(env.STRAVA_CLIENT_ID, "STRAVA_CLIENT_ID"),
            client_secret: requiredEnv(env.STRAVA_CLIENT_SECRET, "STRAVA_CLIENT_SECRET"),
            grant_type: "refresh_token",
            refresh_token: credential.refreshToken
          }),
          fetchImpl
        )
      : await fetchGarminToken(
          new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: credential.refreshToken
          }),
          env,
          fetchImpl
        );

  return {
    ...credential,
    accessToken: token.accessToken,
    expiresAt: token.expiresAt,
    grantedScopes: token.scopes.length ? token.scopes : credential.grantedScopes,
    refreshToken: token.refreshToken || credential.refreshToken,
    tokenType: token.tokenType ?? credential.tokenType
  };
}

export async function revokeProviderCredential(
  credential: ProviderCredential,
  env: FitnessOAuthEnv,
  fetchImpl: Fetch = fetch
): Promise<void> {
  requireProviderClientConfigured(credential.provider, env);
  if (credential.provider === "strava") {
    const response = await fetchImpl(STRAVA_REVOKE_URL, {
      body: new URLSearchParams({
        token: credential.refreshToken,
        token_type_hint: "refresh_token"
      }),
      headers: {
        Authorization: basicClientAuthorization(
          requiredEnv(env.STRAVA_CLIENT_ID, "STRAVA_CLIENT_ID"),
          requiredEnv(env.STRAVA_CLIENT_SECRET, "STRAVA_CLIENT_SECRET")
        ),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    });
    await requireSuccessfulProviderResponse(response, "Strava", "disconnect");
    return;
  }

  const response = await fetchImpl(
    requiredProviderUrl(env.GARMIN_DISCONNECT_URL, "GARMIN_DISCONNECT_URL"),
    {
    headers: { Authorization: `Bearer ${credential.accessToken}` },
    method: "DELETE"
    }
  );
  await requireSuccessfulProviderResponse(response, "Garmin", "disconnect");
}

export function parseProviderCredential(value: unknown, expectedProvider: FitnessProvider): ProviderCredential {
  const input = requireRecord(value, "stored provider credential");
  if (input.version !== 1 || input.provider !== expectedProvider) {
    throw new HttpError(500, "Stored fitness provider credential is invalid");
  }

  const grantedScopes = input.grantedScopes;
  if (!Array.isArray(grantedScopes) || grantedScopes.some((scope) => typeof scope !== "string")) {
    throw new HttpError(500, "Stored fitness provider credential scopes are invalid");
  }

  const expiresAt = input.expiresAt;
  if (expiresAt !== undefined && (typeof expiresAt !== "number" || !Number.isFinite(expiresAt))) {
    throw new HttpError(500, "Stored fitness provider credential expiry is invalid");
  }

  return {
    accessToken: requiredStoredString(input, "accessToken"),
    expiresAt,
    externalAccountId: requiredStoredString(input, "externalAccountId"),
    externalAccountLabel: optionalStoredString(input, "externalAccountLabel"),
    grantedScopes: [...grantedScopes],
    provider: expectedProvider,
    refreshToken: requiredStoredString(input, "refreshToken"),
    tokenType: optionalStoredString(input, "tokenType"),
    version: 1
  };
}

export function parseScopeList(...values: (string | string[] | undefined)[]): string[] {
  const scopes = values.flatMap((value) => {
    if (!value) {
      return [];
    }
    return (Array.isArray(value) ? value : value.split(/[\s,]+/)).map((scope) => scope.trim()).filter(Boolean);
  });
  const unique = [...new Set(scopes)].sort();
  if (unique.length > 100 || unique.some((scope) => scope.length > 256)) {
    throw new HttpError(502, "Fitness provider returned invalid permission scopes");
  }
  return unique;
}

export async function generatePkcePair(): Promise<{ challenge: string; verifier: string }> {
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  return { challenge: await pkceChallenge(verifier), verifier };
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export function credentialNeedsRefresh(credential: ProviderCredential, now = Date.now()): boolean {
  return credential.expiresAt !== undefined && credential.expiresAt <= now + 60_000;
}

function requireProviderAvailable(provider: FitnessProvider, env: FitnessOAuthEnv): void {
  const unavailableReason = providerUnavailableReason(provider, env);
  if (!unavailableReason) {
    return;
  }

  const message =
    unavailableReason === "approval-required"
      ? "Garmin partner approval is required"
      : unavailableReason === "policy-disabled"
        ? "Strava OAuth is disabled until policy approval is recorded"
        : `${provider === "strava" ? "Strava" : "Garmin"} OAuth is not configured`;
  throw new HttpError(503, message, { provider, unavailableReason });
}

function requireProviderClientConfigured(provider: FitnessProvider, env: FitnessOAuthEnv): void {
  const configured =
    provider === "strava"
      ? present(env.STRAVA_CLIENT_ID) && present(env.STRAVA_CLIENT_SECRET)
      : present(env.GARMIN_CLIENT_ID) && present(env.GARMIN_CLIENT_SECRET);
  if (!configured) {
    throw new HttpError(503, `${provider === "strava" ? "Strava" : "Garmin"} OAuth is not configured`, {
      provider,
      unavailableReason: "not-configured"
    });
  }
}

async function exchangeStravaCode(
  transaction: OAuthTransaction,
  code: string,
  callbackScope: string | undefined,
  env: FitnessOAuthEnv,
  fetchImpl: Fetch
): Promise<ProviderCredential> {
  const raw = await fetchProviderJson(
    STRAVA_TOKEN_URL,
    {
      body: new URLSearchParams({
        client_id: requiredEnv(env.STRAVA_CLIENT_ID, "STRAVA_CLIENT_ID"),
        client_secret: requiredEnv(env.STRAVA_CLIENT_SECRET, "STRAVA_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code"
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST"
    },
    "Strava",
    "token exchange",
    fetchImpl
  );
  const token = parseOAuthTokenPayload(raw, "Strava");
  const grantedScopes = parseScopeList(token.scopes);
  const missing = STRAVA_REQUESTED_SCOPES.filter((scope) => !grantedScopes.includes(scope));
  if (missing.length) {
    throw new HttpError(409, "Strava did not grant all requested permissions", {
      missingScopes: missing,
      provider: "strava"
    });
  }
  const callbackScopes = parseScopeList(callbackScope);
  if (
    callbackScopes.length &&
    (callbackScopes.length !== grantedScopes.length ||
      callbackScopes.some((scope) => !grantedScopes.includes(scope)))
  ) {
    throw new HttpError(409, "Strava callback permissions did not match the token response", {
      provider: "strava"
    });
  }

  const athlete = requireRecord(raw.athlete, "Strava athlete");
  const athleteId = stringIdentifier(athlete.id_str ?? athlete.id, "Strava athlete id");
  const name = [stringValue(athlete.firstname), stringValue(athlete.lastname)].filter(Boolean).join(" ");
  const label = boundedExternalLabel(name || stringValue(athlete.username) || `Strava athlete ${athleteId}`);

  return {
    accessToken: token.accessToken,
    expiresAt: token.expiresAt,
    externalAccountId: athleteId,
    externalAccountLabel: label,
    grantedScopes,
    provider: "strava",
    refreshToken: token.refreshToken,
    tokenType: token.tokenType,
    version: 1
  };
}

async function exchangeGarminCode(
  transaction: OAuthTransaction,
  code: string,
  env: FitnessOAuthEnv,
  fetchImpl: Fetch
): Promise<ProviderCredential> {
  if (!transaction.codeVerifier) {
    throw new HttpError(400, "Garmin OAuth transaction is missing its PKCE verifier");
  }

  const token = await fetchGarminToken(
    new URLSearchParams({
      code,
      code_verifier: transaction.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: transaction.redirectUri
    }),
    env,
    fetchImpl
  );
  const [userIdRaw, permissionsRaw] = await Promise.all([
    fetchProviderValue(
      requiredProviderUrl(env.GARMIN_USER_ID_URL, "GARMIN_USER_ID_URL"),
      { headers: { Authorization: `Bearer ${token.accessToken}` } },
      "Garmin",
      "user lookup",
      fetchImpl
    ),
    fetchProviderValue(
      requiredProviderUrl(env.GARMIN_PERMISSIONS_URL, "GARMIN_PERMISSIONS_URL"),
      { headers: { Authorization: `Bearer ${token.accessToken}` } },
      "Garmin",
      "permission lookup",
      fetchImpl
    )
  ]);
  const externalAccountId = parseGarminUserId(userIdRaw);
  const grantedScopes = parseGarminPermissions(permissionsRaw);

  return {
    accessToken: token.accessToken,
    expiresAt: token.expiresAt,
    externalAccountId,
    externalAccountLabel: boundedExternalLabel(`Garmin ${externalAccountId}`),
    grantedScopes,
    provider: "garmin",
    refreshToken: token.refreshToken,
    tokenType: token.tokenType,
    version: 1
  };
}

async function fetchStravaToken(body: URLSearchParams, fetchImpl: Fetch): Promise<OAuthTokenPayload> {
  const raw = await fetchProviderJson(
    STRAVA_TOKEN_URL,
    {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST"
    },
    "Strava",
    "token refresh",
    fetchImpl
  );
  return parseOAuthTokenPayload(raw, "Strava");
}

async function fetchGarminToken(
  body: URLSearchParams,
  env: FitnessOAuthEnv,
  fetchImpl: Fetch
): Promise<OAuthTokenPayload> {
  body.set("client_id", requiredEnv(env.GARMIN_CLIENT_ID, "GARMIN_CLIENT_ID"));
  body.set("client_secret", requiredEnv(env.GARMIN_CLIENT_SECRET, "GARMIN_CLIENT_SECRET"));
  const raw = await fetchProviderJson(
    requiredProviderUrl(env.GARMIN_TOKEN_URL, "GARMIN_TOKEN_URL"),
    {
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    },
    "Garmin",
    "token request",
    fetchImpl
  );
  return parseOAuthTokenPayload(raw, "Garmin");
}

function parseOAuthTokenPayload(raw: Record<string, unknown>, providerName: string): OAuthTokenPayload {
  const accessToken = stringValue(raw.access_token);
  const refreshToken = stringValue(raw.refresh_token);
  if (!accessToken || !refreshToken) {
    throw new HttpError(502, `${providerName} returned an invalid token response`);
  }

  const expiresAtValue = raw.expires_at;
  const expiresInValue = raw.expires_in;
  const expiresAt =
    finiteNumber(expiresAtValue) !== undefined
      ? finiteNumber(expiresAtValue)! * 1000
      : finiteNumber(expiresInValue) !== undefined
        ? Date.now() + finiteNumber(expiresInValue)! * 1000
        : undefined;
  const rawScope = raw.scope;
  const scopes = parseScopeList(
    typeof rawScope === "string"
      ? rawScope
      : Array.isArray(rawScope) && rawScope.every((scope) => typeof scope === "string")
        ? rawScope
        : undefined
  );

  return {
    accessToken,
    expiresAt,
    refreshToken,
    scopes,
    tokenType: stringValue(raw.token_type)
  };
}

function parseGarminUserId(raw: unknown): string {
  if (typeof raw === "string" && raw) {
    return raw;
  }
  const record = requireRecord(raw, "Garmin user response", 502);
  const value = record.userId ?? record.user_id ?? record.id;
  return stringIdentifier(value, "Garmin user id");
}

function parseGarminPermissions(raw: unknown): string[] {
  const value = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).permissions
      : undefined;
  if (!Array.isArray(value)) {
    throw new HttpError(502, "Garmin returned an invalid permission response");
  }
  if (value.some((permission) => typeof permission !== "string")) {
    throw new HttpError(502, "Garmin returned an invalid permission response");
  }
  return parseScopeList(value as string[]);
}

async function fetchProviderJson(
  url: string,
  init: RequestInit,
  providerName: string,
  action: string,
  fetchImpl: Fetch
): Promise<Record<string, unknown>> {
  return requireRecord(
    await fetchProviderValue(url, init, providerName, action, fetchImpl),
    `${providerName} ${action} response`,
    502
  );
}

async function fetchProviderValue(
  url: string,
  init: RequestInit,
  providerName: string,
  action: string,
  fetchImpl: Fetch
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw new HttpError(502, `${providerName} ${action} failed`);
  }

  if (!response.ok) {
    throw new HttpError(502, `${providerName} ${action} failed`, { upstreamStatus: response.status });
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new HttpError(502, `${providerName} ${action} returned invalid JSON`);
  }
  return value;
}

async function requireSuccessfulProviderResponse(
  response: Response,
  providerName: string,
  action: string
): Promise<void> {
  if (!response.ok) {
    throw new HttpError(502, `${providerName} ${action} failed`, { upstreamStatus: response.status });
  }
}

function requireRedirectUri(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, "redirectUri must be a valid URL");
  }

  const localHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
  if (url.protocol !== "https:" && !localHttp) {
    throw new HttpError(400, "redirectUri must use HTTPS (HTTP is allowed only for localhost)");
  }
  if (url.username || url.password || url.hash) {
    throw new HttpError(400, "redirectUri must not contain credentials or a fragment");
  }
  return value;
}

function requireRecord(value: unknown, field: string, status = 400): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(status, `${field} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(input: Record<string, unknown>, key: string, maxLength: number): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${key} must be a non-empty string`);
  }
  if (value.length > maxLength) {
    throw new HttpError(400, `${key} is too long`);
  }
  return value;
}

function optionalString(input: Record<string, unknown>, key: string, maxLength: number): string | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${key} must be a non-empty string`);
  }
  if (value.length > maxLength) {
    throw new HttpError(400, `${key} is too long`);
  }
  return value;
}

function requiredStoredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || !value) {
    throw new HttpError(500, `Stored fitness provider credential ${key} is invalid`);
  }
  return value;
}

function optionalStoredString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(500, `Stored fitness provider credential ${key} is invalid`);
  }
  return value;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function stringIdentifier(value: unknown, field: string): string {
  if ((typeof value === "string" && value) || (typeof value === "number" && Number.isFinite(value))) {
    const identifier = String(value);
    if (identifier.length <= 512) {
      return identifier;
    }
  }
  throw new HttpError(502, `${field} is missing from the provider response`);
}

function boundedExternalLabel(value: string): string {
  return value.trim().slice(0, 256);
}

function requiredProviderUrl(value: string | undefined, name: string): string {
  if (!validProviderUrl(value)) {
    throw new HttpError(503, `${name} must be configured as an exact HTTPS URL`);
  }
  return value;
}

function validProviderUrl(value: string | undefined): value is string {
  if (!present(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function requiredEnv(value: string | undefined, name: string): string {
  if (!present(value)) {
    throw new HttpError(503, `${name} is not configured`);
  }
  return value.trim();
}

function present(value: string | undefined): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function basicClientAuthorization(clientId: string, clientSecret: string): string {
  const bytes = new TextEncoder().encode(`${clientId}:${clientSecret}`);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `Basic ${btoa(binary)}`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
