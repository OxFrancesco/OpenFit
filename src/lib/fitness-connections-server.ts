import {
  CoachApiError,
  healthAgentFetch,
  requireGoogleSubject,
} from '@/lib/coach-server';
import type {
  ConnectableFitnessProviderId,
  FitnessConnectionState,
  FitnessConnectionSummary,
  FitnessConnectionsResponse,
  FitnessOAuthCompletionParams,
  FitnessOAuthStartResponse,
  FitnessUnavailableReason,
} from '@/lib/fitness-connections-contract';

const FITNESS_OAUTH_STATE_VERSION = 1;
const FITNESS_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const FITNESS_OAUTH_STATE_PREFIX = 'v1';
const FITNESS_OAUTH_STATE_AAD = new TextEncoder().encode('fitty:fitness-oauth-state:v1');
const FITNESS_OAUTH_PATH = '/fitness-oauth';
const FITNESS_LINK_VALUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const NATIVE_RETURN_URIS = new Set([
  'fitty://fitness-oauth',
  'com.francescooddo.fitty://fitness-oauth',
]);
const CONNECTION_STATES = new Set<FitnessConnectionState>([
  'connected',
  'disconnected',
  'reauth-required',
  'unavailable',
]);
const UNAVAILABLE_REASONS = new Set<FitnessUnavailableReason>([
  'not-configured',
  'approval-required',
  'policy-disabled',
]);
const SAFE_COMPLETION_ERRORS = new Set([
  'access_denied',
  'authorization_cancelled',
  'connection_failed',
  'insufficient_scope',
  'missing_code',
  'provider_unavailable',
  'reauth_required',
]);

export type FitnessOAuthStatePayload = {
  v: 1;
  subject: string;
  provider: ConnectableFitnessProviderId;
  returnUri: string;
  linkChallenge: string;
  expiresAt: number;
  nonce: string;
};

type FitnessOAuthStateInput = Pick<
  FitnessOAuthStatePayload,
  'subject' | 'provider' | 'returnUri' | 'linkChallenge'
>;

type CallbackCompletionBody = {
  state: string;
  code?: string;
  error?: string;
  scope?: string;
  linkChallenge: string;
};

export async function handleFitnessConnectionsGet(request: Request) {
  try {
    const subject = await requireGoogleSubject(request);
    const response = await healthAgentFetch(subject, '/fitness/connections');
    const data = await readAgentJson(response);

    if (!response.ok) {
      return agentErrorResponse(response.status, data);
    }

    const connections = sanitizeConnectionsResponse(data);
    if (!connections) {
      throw new CoachApiError(502, 'The fitness connection service returned an invalid response.');
    }

    return noStoreJson(applyFitnessBffAvailability(connections));
  } catch (error) {
    return fitnessErrorResponse(error);
  }
}

export function withFitnessApiCors(request: Request, response: Response) {
  const origin = request.headers.get('Origin');
  const headers = new Headers(response.headers);

  if (origin && isAllowedFitnessApiOrigin(origin, request.url)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.append('Vary', 'Origin');
  }
  headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Google-Access-Token'
  );
  headers.set('Access-Control-Allow-Methods', 'DELETE, GET, OPTIONS, POST');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function handleFitnessApiOptions(request: Request) {
  return withFitnessApiCors(request, new Response(null, { status: 204 }));
}

export async function handleFitnessOAuthStart(
  request: Request,
  provider: ConnectableFitnessProviderId
) {
  try {
    const subject = await requireGoogleSubject(request);
    const body = await readJsonObject(request);
    const returnUri = typeof body.returnUri === 'string' ? body.returnUri : '';
    const linkChallenge =
      typeof body.linkChallenge === 'string' ? body.linkChallenge : '';
    if (!FITNESS_LINK_VALUE_PATTERN.test(linkChallenge)) {
      throw new CoachApiError(400, 'The fitness connection proof is invalid.');
    }
    const redirectUri = getFitnessProviderRedirectUri(provider);
    if (provider === 'garmin') {
      getGarminAuthorizationUrl();
    }

    assertAllowedFitnessReturnUri(returnUri, provider);

    const state = await createFitnessOAuthState({
      subject,
      provider,
      returnUri,
      linkChallenge,
    });
    const response = await healthAgentFetch(subject, `/fitness/oauth/${provider}/start`, {
      method: 'POST',
      body: JSON.stringify({ state, redirectUri }),
    });
    const data = await readAgentJson(response);

    if (!response.ok) {
      return agentErrorResponse(response.status, data);
    }

    const authorizationUrl = readSafeAuthorizationUrl(data, provider, state, redirectUri);
    if (!authorizationUrl) {
      throw new CoachApiError(502, 'The fitness provider returned an invalid authorization URL.');
    }

    return noStoreJson({ authorizationUrl } satisfies FitnessOAuthStartResponse);
  } catch (error) {
    return fitnessErrorResponse(error);
  }
}

export async function handleFitnessDisconnect(
  request: Request,
  provider: ConnectableFitnessProviderId
) {
  try {
    const subject = await requireGoogleSubject(request);
    const forceLocal = new URL(request.url).searchParams.get('forceLocal') === 'true';
    const query = forceLocal ? '?forceLocal=true' : '';
    const response = await healthAgentFetch(subject, `/fitness/connections/${provider}${query}`, {
      method: 'DELETE',
    });
    const data = await readAgentJson(response);

    if (!response.ok) {
      return agentErrorResponse(response.status, data);
    }

    const summary = sanitizeConnectionSummary(readWrappedConnection(data), provider);
    if (!summary) {
      throw new CoachApiError(502, 'The fitness connection service returned an invalid response.');
    }

    return noStoreJson(summary);
  } catch (error) {
    return fitnessErrorResponse(error);
  }
}

export async function handleFitnessOAuthFinalize(
  request: Request,
  provider: ConnectableFitnessProviderId
) {
  try {
    const subject = await requireGoogleSubject(request);
    const body = await readJsonObject(request);
    const completionId =
      typeof body.completionId === 'string' ? body.completionId : '';
    const linkVerifier =
      typeof body.linkVerifier === 'string' ? body.linkVerifier : '';
    if (
      !FITNESS_LINK_VALUE_PATTERN.test(completionId) ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(linkVerifier)
    ) {
      throw new CoachApiError(400, 'The fitness connection completion proof is invalid.');
    }

    const response = await healthAgentFetch(
      subject,
      `/fitness/oauth/${provider}/finalize`,
      {
        method: 'POST',
        body: JSON.stringify({ completionId, linkVerifier }),
      }
    );
    const data = await readAgentJson(response);
    if (!response.ok) {
      return agentErrorResponse(response.status, data);
    }

    const summary = sanitizeConnectionSummary(readWrappedConnection(data), provider);
    if (!summary) {
      throw new CoachApiError(502, 'The fitness connection service returned an invalid response.');
    }
    return noStoreJson(summary);
  } catch (error) {
    return fitnessErrorResponse(error);
  }
}

export function applyFitnessBffAvailability(
  response: FitnessConnectionsResponse
): FitnessConnectionsResponse {
  return {
    connections: response.connections.map((connection) => {
      if (connection.state === 'connected' || isFitnessBffConfigured(connection.provider)) {
        return connection;
      }
      return {
        grantedScopes: [],
        provider: connection.provider,
        state: 'unavailable',
        unavailableReason: 'not-configured',
      };
    }),
  };
}

export async function handleFitnessOAuthCallback(
  request: Request,
  expectedProvider: ConnectableFitnessProviderId
) {
  const requestUrl = new URL(request.url);
  const encryptedState = readBoundedQueryParam(requestUrl, 'state', 12_000);

  if (!encryptedState) {
    return invalidCallbackResponse();
  }

  let state: FitnessOAuthStatePayload;
  try {
    state = await readFitnessOAuthState(encryptedState, expectedProvider);
    assertAllowedFitnessReturnUri(state.returnUri, expectedProvider);
  } catch {
    return invalidCallbackResponse();
  }

  const providerError = readBoundedQueryParam(requestUrl, 'error', 128);
  const code = readBoundedQueryParam(requestUrl, 'code', 8_192);
  const scope = readBoundedQueryParam(requestUrl, 'scope', 2_048);
  const callbackError = providerError ?? (code ? null : 'missing_code');
  const completionBody: CallbackCompletionBody = {
    state: encryptedState,
    linkChallenge: state.linkChallenge,
    ...(code && !callbackError ? { code } : null),
    ...(callbackError ? { error: callbackError } : null),
    ...(scope ? { scope } : null),
  };

  let completion: FitnessOAuthCompletionParams;
  try {
    const response = await healthAgentFetch(
      state.subject,
      `/fitness/oauth/${expectedProvider}/complete`,
      {
        method: 'POST',
        body: JSON.stringify(completionBody),
      }
    );
    const data = await readAgentJson(response);

    if (!response.ok) {
      completion = {
        provider: expectedProvider,
        status: isCancellationError(callbackError) ? 'cancelled' : 'error',
        error: sanitizeCompletionError(callbackError ?? readAgentErrorCode(data)),
      };
    } else if (callbackError) {
      completion = {
        provider: expectedProvider,
        status: isCancellationError(callbackError) ? 'cancelled' : 'error',
        error: sanitizeCompletionError(callbackError),
      };
    } else {
      const completionId = readPendingCompletionId(data);
      completion = completionId
        ? {
            provider: expectedProvider,
            status: 'connected',
            completionId,
          }
        : {
            provider: expectedProvider,
            status: 'error',
            error: 'connection_failed',
          };
    }
  } catch {
    completion = {
      provider: expectedProvider,
      status: isCancellationError(callbackError) ? 'cancelled' : 'error',
      error: sanitizeCompletionError(callbackError),
    };
  }

  return fitnessOAuthRedirectResponse(
    buildFitnessOAuthCompletionUrl(state.returnUri, completion)
  );
}

export async function createFitnessOAuthState(
  input: FitnessOAuthStateInput,
  now = Date.now()
) {
  assertProvider(input.provider);
  assertAllowedFitnessReturnUri(input.returnUri, input.provider);

  if (!input.subject || input.subject.length > 512) {
    throw new CoachApiError(400, 'The signed-in Google account is invalid.');
  }

  const payload: FitnessOAuthStatePayload = {
    v: FITNESS_OAUTH_STATE_VERSION,
    subject: input.subject,
    provider: input.provider,
    returnUri: input.returnUri,
    expiresAt: now + FITNESS_OAUTH_STATE_TTL_MS,
    nonce: crypto.randomUUID(),
    linkChallenge: input.linkChallenge,
  };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getFitnessOAuthStateKey();
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: FITNESS_OAUTH_STATE_AAD },
    key,
    plaintext
  );

  return [
    FITNESS_OAUTH_STATE_PREFIX,
    bytesToBase64Url(iv),
    bytesToBase64Url(new Uint8Array(ciphertext)),
  ].join('.');
}

export async function readFitnessOAuthState(
  state: string,
  expectedProvider: ConnectableFitnessProviderId,
  now = Date.now()
): Promise<FitnessOAuthStatePayload> {
  assertProvider(expectedProvider);

  const parts = state.split('.');
  if (
    parts.length !== 3 ||
    parts[0] !== FITNESS_OAUTH_STATE_PREFIX ||
    !parts[1] ||
    !parts[2] ||
    state.length > 12_000
  ) {
    throw new CoachApiError(400, 'The fitness connection state is invalid.');
  }

  try {
    const key = await getFitnessOAuthStateKey();
    const iv = base64UrlToBytes(parts[1]);
    if (iv.byteLength !== 12) {
      throw new Error('Invalid IV');
    }
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: FITNESS_OAUTH_STATE_AAD },
      key,
      base64UrlToBytes(parts[2])
    );
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;

    if (!isFitnessOAuthStatePayload(payload)) {
      throw new Error('Invalid state payload');
    }
    if (payload.provider !== expectedProvider) {
      throw new CoachApiError(400, 'The fitness connection provider does not match.');
    }
    if (payload.expiresAt <= now || payload.expiresAt > now + FITNESS_OAUTH_STATE_TTL_MS) {
      throw new CoachApiError(400, 'The fitness connection request has expired.');
    }

    assertAllowedFitnessReturnUri(payload.returnUri, payload.provider);
    return payload;
  } catch (error) {
    if (error instanceof CoachApiError) {
      throw error;
    }
    throw new CoachApiError(400, 'The fitness connection state is invalid.');
  }
}

export function assertAllowedFitnessReturnUri(
  returnUri: string,
  provider: ConnectableFitnessProviderId
) {
  assertProvider(provider);

  if (NATIVE_RETURN_URIS.has(returnUri)) {
    return;
  }

  let candidate: URL;
  try {
    candidate = new URL(returnUri);
  } catch {
    throw new CoachApiError(400, 'The fitness connection return URI is not allowed.');
  }

  if (
    (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') ||
    candidate.pathname !== FITNESS_OAUTH_PATH ||
    candidate.username ||
    candidate.password ||
    candidate.search ||
    candidate.hash
  ) {
    throw new CoachApiError(400, 'The fitness connection return URI is not allowed.');
  }

  const callbackOrigin = new URL(getFitnessProviderRedirectUri(provider)).origin;
  if (candidate.origin === callbackOrigin) {
    return;
  }

  if (isLoopbackHost(candidate.hostname)) {
    // Local Expo web can call a remotely hosted BFF. No token or code is ever
    // returned to this URI; only the sanitized completion status is included.
    return;
  }

  throw new CoachApiError(400, 'The fitness connection return URI is not allowed.');
}

export function buildFitnessOAuthCompletionUrl(
  returnUri: string,
  completion: FitnessOAuthCompletionParams
) {
  const url = new URL(returnUri);
  url.search = '';
  url.hash = '';
  url.searchParams.set('provider', completion.provider);
  url.searchParams.set('status', completion.status);

  if (completion.status !== 'connected' && completion.error) {
    url.searchParams.set('error', sanitizeCompletionError(completion.error));
  }
  if (
    completion.status === 'connected' &&
    FITNESS_LINK_VALUE_PATTERN.test(completion.completionId)
  ) {
    url.searchParams.set('completion', completion.completionId);
  }

  return url;
}

export function sanitizeCompletionError(error: string | null | undefined) {
  if (!error) {
    return 'connection_failed';
  }

  const normalized = error.trim().toLowerCase().replaceAll('-', '_');
  if (normalized === 'user_denied' || normalized === 'consent_denied' || normalized === 'cancelled') {
    return 'authorization_cancelled';
  }
  return SAFE_COMPLETION_ERRORS.has(normalized) ? normalized : 'connection_failed';
}

function getFitnessProviderRedirectUri(provider: ConnectableFitnessProviderId) {
  const environmentName = provider === 'strava' ? 'STRAVA_REDIRECT_URI' : 'GARMIN_REDIRECT_URI';
  const redirectUri =
    provider === 'strava' ? process.env.STRAVA_REDIRECT_URI : process.env.GARMIN_REDIRECT_URI;

  if (!redirectUri) {
    throw new CoachApiError(503, `${providerLabel(provider)} is not configured on this server.`);
  }

  try {
    const url = new URL(redirectUri);
    const expectedPath = `/api/fitness/${provider}/callback`;
    const validProtocol =
      url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHost(url.hostname));

    if (
      !validProtocol ||
      url.pathname !== expectedPath ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error('Invalid redirect URI');
    }
  } catch {
    throw new CoachApiError(
      503,
      `${environmentName} must be the exact public ${providerLabel(provider)} callback URL.`
    );
  }

  return redirectUri;
}

function isFitnessBffConfigured(provider: ConnectableFitnessProviderId) {
  if (!process.env.FITNESS_OAUTH_STATE_KEY || process.env.FITNESS_OAUTH_STATE_KEY.length < 32) {
    return false;
  }
  try {
    getFitnessProviderRedirectUri(provider);
    if (provider === 'garmin') {
      getGarminAuthorizationUrl();
    }
    return true;
  } catch {
    return false;
  }
}

function getGarminAuthorizationUrl() {
  const configured = process.env.GARMIN_AUTHORIZATION_URL;
  if (!configured) {
    throw new CoachApiError(503, 'Garmin authorization is not configured on this server.');
  }
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      throw new Error('Invalid URL');
    }
    return url;
  } catch {
    throw new CoachApiError(503, 'GARMIN_AUTHORIZATION_URL must be an exact HTTPS URL.');
  }
}

async function getFitnessOAuthStateKey() {
  const stateSecret = process.env.FITNESS_OAUTH_STATE_KEY;
  if (!stateSecret || stateSecret.length < 32) {
    throw new CoachApiError(
      503,
      'FITNESS_OAUTH_STATE_KEY must be configured with at least 32 characters.'
    );
  }

  const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stateSecret));
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function isFitnessOAuthStatePayload(value: unknown): value is FitnessOAuthStatePayload {
  if (!isRecord(value)) return false;

  return (
    value.v === FITNESS_OAUTH_STATE_VERSION &&
    typeof value.subject === 'string' &&
    value.subject.length > 0 &&
    value.subject.length <= 512 &&
    (value.provider === 'strava' || value.provider === 'garmin') &&
    typeof value.returnUri === 'string' &&
    typeof value.linkChallenge === 'string' &&
    FITNESS_LINK_VALUE_PATTERN.test(value.linkChallenge) &&
    typeof value.expiresAt === 'number' &&
    Number.isSafeInteger(value.expiresAt) &&
    typeof value.nonce === 'string' &&
    /^[0-9a-f-]{36}$/i.test(value.nonce)
  );
}

function sanitizeConnectionsResponse(value: unknown): FitnessConnectionsResponse | null {
  if (!isRecord(value) || !Array.isArray(value.connections)) {
    return null;
  }

  const connections: FitnessConnectionSummary[] = [];
  const seen = new Set<ConnectableFitnessProviderId>();

  for (const item of value.connections) {
    const summary = sanitizeConnectionSummary(item);
    if (summary && !seen.has(summary.provider)) {
      seen.add(summary.provider);
      connections.push(summary);
    }
  }

  return connections.length ? { connections } : null;
}

function sanitizeConnectionSummary(
  value: unknown,
  expectedProvider?: ConnectableFitnessProviderId
): FitnessConnectionSummary | null {
  if (!isRecord(value)) return null;

  const provider = value.provider;
  const state = value.state;
  if (
    (provider !== 'strava' && provider !== 'garmin') ||
    (expectedProvider && provider !== expectedProvider) ||
    typeof state !== 'string' ||
    !CONNECTION_STATES.has(state as FitnessConnectionState) ||
    !Array.isArray(value.grantedScopes) ||
    !value.grantedScopes.every((scope) => typeof scope === 'string' && scope.length <= 256)
  ) {
    return null;
  }

  const unavailableReason = value.unavailableReason;
  if (
    unavailableReason !== undefined &&
    (typeof unavailableReason !== 'string' ||
      !UNAVAILABLE_REASONS.has(unavailableReason as FitnessUnavailableReason))
  ) {
    return null;
  }

  const connectedAt = boundedOptionalString(value.connectedAt, 64);
  const externalAccountLabel = boundedOptionalString(value.externalAccountLabel, 256);
  const detail = boundedOptionalString(value.detail, 512);

  return {
    provider,
    state: state as FitnessConnectionState,
    grantedScopes: value.grantedScopes,
    ...(connectedAt ? { connectedAt } : null),
    ...(externalAccountLabel ? { externalAccountLabel } : null),
    ...(unavailableReason ? { unavailableReason: unavailableReason as FitnessUnavailableReason } : null),
    ...(detail ? { detail } : null),
  };
}

function readWrappedConnection(value: unknown) {
  if (isRecord(value) && 'connection' in value) {
    return value.connection;
  }
  return value;
}

function readSafeAuthorizationUrl(
  value: unknown,
  provider: ConnectableFitnessProviderId,
  state: string,
  redirectUri: string
) {
  if (!isRecord(value) || typeof value.authorizationUrl !== 'string') {
    return null;
  }

  try {
    const url = new URL(value.authorizationUrl);
    const expectedEndpoint =
      provider === 'strava'
        ? new URL('https://www.strava.com/oauth/authorize')
        : getGarminAuthorizationUrl();
    if (
      url.protocol !== 'https:' ||
      url.origin !== expectedEndpoint.origin ||
      url.pathname !== expectedEndpoint.pathname ||
      url.username ||
      url.password ||
      url.hash ||
      url.searchParams.get('state') !== state ||
      url.searchParams.get('redirect_uri') !== redirectUri ||
      url.searchParams.get('response_type') !== 'code'
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function buildCallbackHeaders(contentType?: string) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
  if (contentType) headers.set('Content-Type', contentType);
  return headers;
}

function invalidCallbackResponse() {
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connection failed</title></head><body><main><h1>Connection could not be completed</h1><p>Return to OpenFit and try again.</p></main></body></html>',
    {
      status: 400,
      headers: buildCallbackHeaders('text/html; charset=utf-8'),
    }
  );
}

function fitnessOAuthRedirectResponse(url: URL) {
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    const headers = buildCallbackHeaders();
    headers.set('Location', url.toString());
    return new Response(null, { status: 302, headers });
  }

  const target = url.toString();
  const safeTarget = escapeHtml(target);
  const scriptTarget = JSON.stringify(target).replaceAll('<', '\\u003c');
  const nonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(18)));
  const headers = buildCallbackHeaders('text/html; charset=utf-8');
  headers.set(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
  );

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Opening OpenFit</title>
  <style nonce="${nonce}">body{min-height:100vh;margin:0;display:grid;place-items:center;font-family:system-ui,sans-serif;text-align:center}main{max-width:28rem;padding:1.5rem}a{display:inline-block;padding:.8rem 1.1rem;border:1px solid;border-radius:999px;color:inherit}</style>
</head>
<body>
  <main>
    <h1>Opening OpenFit</h1>
    <p>Your fitness connection is ready to return to the app.</p>
    <a href="${safeTarget}">Open OpenFit</a>
  </main>
  <script nonce="${nonce}">window.location.replace(${scriptTarget});</script>
</body>
</html>`,
    { headers }
  );
}

function noStoreJson(value: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return Response.json(value, { ...init, headers });
}

function fitnessErrorResponse(error: unknown) {
  if (error instanceof CoachApiError) {
    return noStoreJson({ error: error.message }, { status: error.status });
  }
  return noStoreJson({ error: 'The fitness connection request could not be completed.' }, { status: 500 });
}

function agentErrorResponse(status: number, data: unknown) {
  const safeStatus = status >= 400 && status <= 599 ? status : 502;
  const code = readAgentErrorCode(data);
  const message =
    code === 'approval_required'
      ? 'This fitness provider requires partner approval before it can be connected.'
      : code === 'policy_disabled'
        ? 'This fitness provider is disabled by policy.'
        : code === 'not_configured'
          ? 'This fitness provider is not configured yet.'
          : 'The fitness provider could not complete that request.';
  return noStoreJson({ error: message }, { status: safeStatus });
}

async function readAgentJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function readJsonObject(request: Request) {
  try {
    const value = (await request.json()) as unknown;
    if (!isRecord(value)) throw new Error('Invalid body');
    return value;
  } catch {
    throw new CoachApiError(400, 'Send a valid JSON request body.');
  }
}

function readAgentErrorCode(value: unknown) {
  if (!isRecord(value)) return null;
  const details = value.details;
  if (isRecord(details)) {
    if (Array.isArray(details.missingScopes)) return 'insufficient_scope';
    if (typeof details.unavailableReason === 'string') {
      return details.unavailableReason.replaceAll('-', '_');
    }
  }
  const error = value.error;
  if (typeof error === 'string' && error.length <= 128) return error;
  if (isRecord(error) && typeof error.code === 'string' && error.code.length <= 128) {
    return error.code;
  }
  return typeof value.code === 'string' && value.code.length <= 128 ? value.code : null;
}

function readPendingCompletionId(value: unknown) {
  if (!isRecord(value) || typeof value.completionId !== 'string') return null;
  return FITNESS_LINK_VALUE_PATTERN.test(value.completionId) ? value.completionId : null;
}

function readBoundedQueryParam(url: URL, key: string, maxLength: number) {
  const value = url.searchParams.get(key);
  return value && value.length <= maxLength ? value : null;
}

function boundedOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : undefined;
}

function providerLabel(provider: ConnectableFitnessProviderId) {
  return provider === 'strava' ? 'Strava' : 'Garmin';
}

function isCancellationError(error: string | null | undefined) {
  return (
    error === 'access_denied' ||
    error === 'user_denied' ||
    error === 'consent_denied' ||
    error === 'cancelled'
  );
}

function assertProvider(
  provider: string
): asserts provider is ConnectableFitnessProviderId {
  if (provider !== 'strava' && provider !== 'garmin') {
    throw new CoachApiError(400, 'The fitness provider is not supported.');
  }
}

function isLoopbackHost(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function isAllowedFitnessApiOrigin(origin: string, requestUrl: string) {
  try {
    const candidate = new URL(origin);
    const requestOrigin = new URL(requestUrl).origin;
    return (
      (candidate.protocol === 'http:' || candidate.protocol === 'https:') &&
      !candidate.username &&
      !candidate.password &&
      !candidate.pathname.replaceAll('/', '') &&
      !candidate.search &&
      !candidate.hash &&
      (candidate.origin === requestOrigin || isLoopbackHost(candidate.hostname))
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid base64url');
  }
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
