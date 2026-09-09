import { describe, expect, test } from 'bun:test';
import { GOOGLE_HEALTH_SCOPES, selectGoogleAccount, selectGoogleToken } from '../../shared/clerk-google';

const account = { id: 'idn_a', external_account_id: 'eac_a', provider: 'oauth_google', provider_user_id: 'google-a' };
describe('Clerk Google account binding', () => {
  test('preserves the Google subject used by existing coach conversations', () => {
    expect(selectGoogleAccount({ external_accounts: [account] })).toEqual({ id: 'eac_a', subject: 'google-a' });
  });
  test('rejects another Google account and ambiguous accounts', () => {
    expect(() => selectGoogleAccount({ external_accounts: [account] }, 'google-b')).toThrow();
    expect(() => selectGoogleAccount({ external_accounts: [account, { ...account, id: 'eac_b', provider_user_id: 'google-b' }] })).toThrow();
  });
  test('ignores non-Google accounts', () => {
    expect(() => selectGoogleAccount({ external_accounts: [{ ...account, provider: 'oauth_github' }] })).toThrow();
  });
  test('requires a provider token belonging to the selected external account', () => {
    expect(() => selectGoogleToken([{ external_account_id: 'eac_b', token: 'test', scopes: GOOGLE_HEALTH_SCOPES }], 'eac_a')).toThrow();
  });
  test('rejects partial Health permission grants', () => {
    expect(() => selectGoogleToken([{ external_account_id: 'eac_a', token: 'test', scopes: GOOGLE_HEALTH_SCOPES.slice(0, 3) }], 'eac_a')).toThrow('permissions');
  });
  test('accepts complete grants', () => {
    expect(selectGoogleToken([{ external_account_id: 'eac_a', token: 'test', scopes: GOOGLE_HEALTH_SCOPES }], 'eac_a').accessToken).toBe('test');
  });
  test('rejects malformed provider responses', () => {
    for (const value of [null, {}, 'bad', [{ token: 'test' }]]) expect(() => selectGoogleToken(value, 'eac_a')).toThrow();
  });
});

test('broker verifies provider identity before returning Health access', async () => {
  const { googleTokenForClerkUser } = await import('../../shared/clerk-google');
  const originalFetch = globalThis.fetch;
  const paths = [];
  globalThis.fetch = async (url) => {
    paths.push(url);
    if (url.endsWith('/users/user_a')) return Response.json({ external_accounts: [account] });
    if (url.endsWith('/oauth_access_tokens/oauth_google')) return Response.json([{ external_account_id: 'eac_a', token: 'test', scopes: GOOGLE_HEALTH_SCOPES }]);
    return Response.json({ sub: 'google-b' });
  };
  try {
    await expect(googleTokenForClerkUser('test-secret', 'user_a')).rejects.toThrow('verification failed');
    expect(paths[1]).toBe('https://api.clerk.com/v1/users/user_a/oauth_access_tokens/oauth_google');
  } finally { globalThis.fetch = originalFetch; }
});
