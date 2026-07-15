import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import {
  applyFitnessBffAvailability,
  assertAllowedFitnessReturnUri,
  buildFitnessOAuthCompletionUrl,
  createFitnessOAuthState,
  handleFitnessApiOptions,
  readFitnessOAuthState,
} from './fitness-connections-server.ts';

const STATE_KEY = 'fitty-test-state-key-with-more-than-32-characters';
const LINK_CHALLENGE = 'A'.repeat(43);
const COMPLETION_ID = 'B'.repeat(43);
const STRAVA_REDIRECT_URI = 'https://fitty.example/api/fitness/strava/callback';
const GARMIN_REDIRECT_URI = 'https://fitty.example/api/fitness/garmin/callback';
const originalEnvironment = {
  FITNESS_OAUTH_STATE_KEY: process.env.FITNESS_OAUTH_STATE_KEY,
  STRAVA_REDIRECT_URI: process.env.STRAVA_REDIRECT_URI,
  GARMIN_REDIRECT_URI: process.env.GARMIN_REDIRECT_URI,
  GARMIN_AUTHORIZATION_URL: process.env.GARMIN_AUTHORIZATION_URL,
};

describe('fitness OAuth BFF state', () => {
  beforeEach(() => {
    process.env.FITNESS_OAUTH_STATE_KEY = STATE_KEY;
    process.env.STRAVA_REDIRECT_URI = STRAVA_REDIRECT_URI;
    process.env.GARMIN_REDIRECT_URI = GARMIN_REDIRECT_URI;
    process.env.GARMIN_AUTHORIZATION_URL = 'https://partner.example/garmin/authorize';
  });

  afterEach(() => {
    restoreEnvironment('FITNESS_OAUTH_STATE_KEY', originalEnvironment.FITNESS_OAUTH_STATE_KEY);
    restoreEnvironment('STRAVA_REDIRECT_URI', originalEnvironment.STRAVA_REDIRECT_URI);
    restoreEnvironment('GARMIN_REDIRECT_URI', originalEnvironment.GARMIN_REDIRECT_URI);
    restoreEnvironment(
      'GARMIN_AUTHORIZATION_URL',
      originalEnvironment.GARMIN_AUTHORIZATION_URL
    );
  });

  test('round-trips an authenticated, encrypted state payload', async () => {
    const state = await createFitnessOAuthState(
      {
        subject: 'google-subject-123',
        provider: 'strava',
        returnUri: 'fitty://fitness-oauth',
        linkChallenge: LINK_CHALLENGE,
      },
      1_000
    );

    expect(state).not.toContain('google-subject-123');
    expect(state).not.toContain('fitty://fitness-oauth');
    expect(await readFitnessOAuthState(state, 'strava', 1_001)).toMatchObject({
      v: 1,
      subject: 'google-subject-123',
      provider: 'strava',
      returnUri: 'fitty://fitness-oauth',
      linkChallenge: LINK_CHALLENGE,
      expiresAt: 601_000,
    });
  });

  test('rejects ciphertext tampering', async () => {
    const state = await createFitnessOAuthState({
      subject: 'google-subject-123',
      provider: 'strava',
      returnUri: 'fitty://fitness-oauth',
      linkChallenge: LINK_CHALLENGE,
    });
    const parts = state.split('.');
    const ciphertext = parts[2];
    const index = Math.floor(ciphertext.length / 2);
    parts[2] = `${ciphertext.slice(0, index)}${ciphertext[index] === 'A' ? 'B' : 'A'}${ciphertext.slice(index + 1)}`;

    await expect(readFitnessOAuthState(parts.join('.'), 'strava')).rejects.toThrow(
      'fitness connection state is invalid'
    );
  });

  test('rejects expired state', async () => {
    const state = await createFitnessOAuthState(
      {
        subject: 'google-subject-123',
        provider: 'strava',
        returnUri: 'fitty://fitness-oauth',
        linkChallenge: LINK_CHALLENGE,
      },
      1_000
    );

    await expect(readFitnessOAuthState(state, 'strava', 601_000)).rejects.toThrow(
      'fitness connection request has expired'
    );
  });

  test('rejects provider mismatch', async () => {
    const state = await createFitnessOAuthState({
      subject: 'google-subject-123',
      provider: 'strava',
      returnUri: 'fitty://fitness-oauth',
      linkChallenge: LINK_CHALLENGE,
    });

    await expect(readFitnessOAuthState(state, 'garmin')).rejects.toThrow(
      'fitness connection provider does not match'
    );
  });

  test('allows only exact native or same-origin web return routes', () => {
    expect(() =>
      assertAllowedFitnessReturnUri('fitty://fitness-oauth', 'strava')
    ).not.toThrow();
    expect(() =>
      assertAllowedFitnessReturnUri('https://fitty.example/fitness-oauth', 'strava')
    ).not.toThrow();
    expect(() =>
      assertAllowedFitnessReturnUri('http://localhost:8081/fitness-oauth', 'strava')
    ).not.toThrow();
    expect(() =>
      assertAllowedFitnessReturnUri('fitty://fitness-oauth/extra', 'strava')
    ).toThrow('return URI is not allowed');
    expect(() =>
      assertAllowedFitnessReturnUri('https://attacker.example/fitness-oauth', 'strava')
    ).toThrow('return URI is not allowed');
    expect(() =>
      assertAllowedFitnessReturnUri('https://fitty.example/fitness-oauth?next=https://attacker.example', 'strava')
    ).toThrow('return URI is not allowed');
  });

  test('emits only sanitized callback fields', () => {
    const url = buildFitnessOAuthCompletionUrl('fitty://fitness-oauth', {
      provider: 'strava',
      status: 'error',
      error: '\"><script>window.location="https://attacker.example"</script>',
    });

    expect([...url.searchParams.keys()].sort()).toEqual(['error', 'provider', 'status']);
    expect(url.searchParams.get('provider')).toBe('strava');
    expect(url.searchParams.get('status')).toBe('error');
    expect(url.searchParams.get('error')).toBe('connection_failed');
    expect(url.toString()).not.toContain('script');
    expect(url.toString()).not.toContain('attacker.example');
  });

  test('returns only an opaque completion ID for a pending connection', () => {
    const url = buildFitnessOAuthCompletionUrl('fitty://fitness-oauth', {
      provider: 'garmin',
      status: 'connected',
      completionId: COMPLETION_ID,
    });

    expect([...url.searchParams.keys()].sort()).toEqual([
      'completion',
      'provider',
      'status',
    ]);
    expect(url.searchParams.get('completion')).toBe(COMPLETION_ID);
    expect(url.toString()).not.toContain('code=');
    expect(url.toString()).not.toContain('token=');
  });

  test('allows authenticated fitness API preflight only from same-origin or loopback web apps', () => {
    const local = handleFitnessApiOptions(
      new Request('https://fitty.example/api/fitness/connections', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:8084' },
      })
    );
    expect(local.status).toBe(204);
    expect(local.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8084');
    expect(local.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(local.headers.get('Access-Control-Allow-Headers')).toContain('X-Google-Access-Token');

    const attacker = handleFitnessApiOptions(
      new Request('https://fitty.example/api/fitness/connections', {
        method: 'OPTIONS',
        headers: { Origin: 'https://attacker.example' },
      })
    );
    expect(attacker.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  test('fails disconnected providers closed when the BFF layer is incomplete', () => {
    delete process.env.FITNESS_OAUTH_STATE_KEY;

    expect(
      applyFitnessBffAvailability({
        connections: [
          { provider: 'strava', state: 'disconnected', grantedScopes: [] },
          {
            provider: 'garmin',
            state: 'connected',
            grantedScopes: ['ACTIVITY_EXPORT'],
            connectedAt: '2026-07-14T10:00:00.000Z',
          },
        ],
      })
    ).toEqual({
      connections: [
        {
          provider: 'strava',
          state: 'unavailable',
          grantedScopes: [],
          unavailableReason: 'not-configured',
        },
        {
          provider: 'garmin',
          state: 'connected',
          grantedScopes: ['ACTIVITY_EXPORT'],
          connectedAt: '2026-07-14T10:00:00.000Z',
        },
      ],
    });
  });
});

function restoreEnvironment(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
