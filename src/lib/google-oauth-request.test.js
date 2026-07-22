import { describe, expect, it } from 'bun:test';

import { buildGoogleAuthUrl, GOOGLE_HEALTH_SCOPES } from './google-oauth-request.ts';

const EXPECTED_PRODUCTION_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.nutrition.readonly',
];

describe('Google OAuth authorization request', () => {
  it('requests only the production Google Health permissions', () => {
    expect(GOOGLE_HEALTH_SCOPES).toEqual(EXPECTED_PRODUCTION_SCOPES);
  });

  it('does not merge previously granted permissions into a new authorization', () => {
    const authorizationUrl = new URL(
      buildGoogleAuthUrl(
        {
          clientId: 'test-client.apps.googleusercontent.com',
          redirectUri: 'https://openfit.example/api/google/callback',
        },
        'csrf-state'
      )
    );

    expect(authorizationUrl.searchParams.get('scope')?.split(' ')).toEqual(
      EXPECTED_PRODUCTION_SCOPES
    );
    expect(authorizationUrl.searchParams.has('include_granted_scopes')).toBe(false);
  });
});
