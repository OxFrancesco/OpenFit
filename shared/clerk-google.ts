export const GOOGLE_HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.nutrition.readonly',
];

export class GoogleConnectionError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function selectGoogleAccount(user: unknown, expectedSubject?: string) {
  if (!record(user) || !Array.isArray(user.external_accounts)) {
    throw new GoogleConnectionError(502, 'Could not read your Google connection.');
  }
  const accounts = user.external_accounts.filter((account: unknown): account is Record<string, unknown> =>
    record(account) && account.provider === 'oauth_google' && typeof account.provider_user_id === 'string'
  );
  const matching = expectedSubject
    ? accounts.filter(account => account.provider_user_id === expectedSubject)
    : accounts;
  if (matching.length !== 1) {
    throw new GoogleConnectionError(409, 'Connect one Google account with Health access in your OpenFit account.');
  }
  const account = matching[0];
  if (typeof account.id !== 'string' || typeof account.provider_user_id !== 'string') {
    throw new GoogleConnectionError(502, 'Could not verify your Google connection.');
  }
  return { id: typeof account.external_account_id === 'string' ? account.external_account_id : account.id, subject: account.provider_user_id };
}

async function clerkJson(secret: string | undefined, path: string): Promise<unknown> {
  if (!secret) throw new GoogleConnectionError(503, 'Account access is not configured on this server.');
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) {
    throw new GoogleConnectionError(response.status === 404 ? 401 : 503, 'Could not refresh your Google connection. Reconnect Google in Account.');
  }
  return response.json();
}

export async function googleAccountForClerkUser(secret: string | undefined, userId: string, expectedSubject?: string) {
  return selectGoogleAccount(await clerkJson(secret, `/users/${encodeURIComponent(userId)}`), expectedSubject);
}

export function selectGoogleToken(value: unknown, accountId: string) {
  const tokens = Array.isArray(value) ? value : record(value) && Array.isArray(value.data) ? value.data : [];
  const token = tokens.find((item: unknown) => record(item) && item.external_account_id === accountId);
  if (!record(token) || typeof token.token !== 'string' || !token.token) {
    throw new GoogleConnectionError(409, 'Reconnect Google in Account to allow Health access.');
  }
  const scopes = Array.isArray(token.scopes) ? token.scopes.filter((scope): scope is string => typeof scope === 'string') : [];
  if (!GOOGLE_HEALTH_SCOPES.every(scope => scopes.includes(scope))) {
    throw new GoogleConnectionError(409, 'Google Health permissions are missing. Reconnect Google and allow all Health permissions.');
  }
  return { accessToken: token.token, scope: scopes.join(' '), expiresAt: typeof token.expires_at === 'number' ? token.expires_at : undefined };
}

export async function googleTokenForClerkUser(secret: string | undefined, userId: string, expectedSubject?: string) {
  const account = await googleAccountForClerkUser(secret, userId, expectedSubject);
  const token = selectGoogleToken(await clerkJson(secret, `/users/${encodeURIComponent(userId)}/oauth_access_tokens/oauth_google`), account.id);
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  const profile: unknown = response.ok ? await response.json() : null;
  if (!record(profile) || profile.sub !== account.subject) {
    throw new GoogleConnectionError(401, 'Google account verification failed. Reconnect Google in Account.');
  }
  return {
    ...token,
    clerkUserId: userId,
    googleSubject: account.subject,
    issuedAt: Math.floor(Date.now() / 1000),
    expiresIn: token.expiresAt ? Math.max(0, Math.floor(token.expiresAt / 1000) - Math.floor(Date.now() / 1000)) : 0,
    tokenType: 'Bearer',
    profile: {
      name: typeof profile.name === 'string' ? profile.name : undefined,
      givenName: typeof profile.given_name === 'string' ? profile.given_name : undefined,
      email: typeof profile.email === 'string' ? profile.email : undefined,
    },
  };
}
