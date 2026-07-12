type GoogleIdTokenClaims = {
  aud: string;
  exp: number;
  iss: string;
  sub: string;
};

type Jwk = JsonWebKey & { kid?: string };

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let cachedKeys: { expiresAt: number; keys: Jwk[] } | null = null;

export async function requireGoogleSubject(request: Request) {
  const idToken = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!idToken) {
    throw new CoachApiError(401, 'Sign in with Google to use the coach.');
  }

  const claims = await verifyGoogleIdToken(idToken);
  if (claims.exp <= Math.floor(Date.now() / 1000)) {
    const accessToken = request.headers.get('X-Google-Access-Token');
    if (!accessToken || (await googleAccessTokenSubject(accessToken)) !== claims.sub) {
      throw new CoachApiError(401, 'The Google session has expired. Sign in again.');
    }
  }
  return claims.sub;
}

export function getHealthAgentConfig() {
  const baseUrl = process.env.HEALTH_AGENT_URL?.replace(/\/+$/, '');
  const token = process.env.HEALTH_AGENT_API_TOKEN;

  if (!baseUrl || !token) {
    throw new CoachApiError(
      503,
      'The health coach is not configured on this server yet. Set HEALTH_AGENT_URL and HEALTH_AGENT_API_TOKEN.'
    );
  }

  return { baseUrl, token };
}

export async function healthAgentFetch(subject: string, path: string, init?: RequestInit) {
  const { baseUrl, token } = getHealthAgentConfig();
  return fetch(
    `${baseUrl}/agents/fitty-health-agent/${encodeURIComponent(subject)}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : null),
        ...init?.headers,
      },
    }
  );
}

export class CoachApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'CoachApiError';
  }
}

export function coachErrorResponse(error: unknown) {
  if (error instanceof CoachApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: 'The coach could not complete that request.' }, { status: 500 });
}

export async function forwardAgentJson(response: Response) {
  const body = await response.text();
  return new Response(body || null, {
    status: response.status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json; charset=utf-8',
    },
  });
}

async function verifyGoogleIdToken(token: string): Promise<GoogleIdTokenClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new CoachApiError(401, 'The Google session is invalid. Sign in again.');
  }

  const header = decodeJwtPart<{ alg?: string; kid?: string }>(parts[0]);
  const claims = decodeJwtPart<Partial<GoogleIdTokenClaims>>(parts[1]);
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new CoachApiError(503, 'Google sign-in is not configured on this server.');
  }
  if (header.alg !== 'RS256' || !header.kid) {
    throw new CoachApiError(401, 'The Google session uses an unsupported signature.');
  }

  let key = (await getGoogleKeys()).find((candidate) => candidate.kid === header.kid);
  if (!key) {
    cachedKeys = null;
    key = (await getGoogleKeys()).find((candidate) => candidate.kid === header.kid);
  }
  if (!key) {
    throw new CoachApiError(401, 'The Google session signing key is no longer valid. Sign in again.');
  }

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    key,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    base64UrlBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );

  if (
    !valid ||
    claims.aud !== clientId ||
    !claims.iss ||
    !GOOGLE_ISSUERS.has(claims.iss) ||
    !claims.exp ||
    !claims.sub
  ) {
    throw new CoachApiError(401, 'The Google session has expired. Sign in again.');
  }

  return claims as GoogleIdTokenClaims;
}

async function googleAccessTokenSubject(accessToken: string) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;

  const profile = (await response.json()) as { sub?: string };
  return profile.sub ?? null;
}

async function getGoogleKeys() {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) {
    return cachedKeys.keys;
  }

  const response = await fetch(GOOGLE_JWKS_URL);
  if (!response.ok) {
    throw new CoachApiError(503, 'Google identity verification is temporarily unavailable.');
  }

  const { keys } = (await response.json()) as { keys?: Jwk[] };
  if (!keys?.length) {
    throw new CoachApiError(503, 'Google identity verification returned no signing keys.');
  }

  const maxAge = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] ?? 300);
  cachedKeys = { keys, expiresAt: Date.now() + Math.min(maxAge, 3600) * 1000 };
  return keys;
}

function decodeJwtPart<T>(part: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlBytes(part))) as T;
  } catch {
    throw new CoachApiError(401, 'The Google session is malformed. Sign in again.');
  }
}

function base64UrlBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
