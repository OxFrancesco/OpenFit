import { describe, expect, it } from 'bun:test';

import {
  normalizeFitnessOAuthParams,
  normalizeFitnessOAuthRedirectPath,
} from './fitness-oauth-return.ts';

describe('fitness OAuth app return', () => {
  const completionId = 'C'.repeat(43);

  it('accepts only known provider completion values', () => {
    expect(
      normalizeFitnessOAuthParams({
        provider: 'strava',
        status: 'connected',
        completion: completionId,
      })
    ).toEqual({
      provider: 'strava',
      status: 'connected',
      completionId,
    });
    expect(normalizeFitnessOAuthParams({ provider: 'strava', status: 'connected' })).toBeNull();
    expect(
      normalizeFitnessOAuthParams({
        provider: 'unknown',
        status: 'connected',
        completion: completionId,
      })
    ).toBeNull();
    expect(normalizeFitnessOAuthParams({ provider: 'garmin', status: 'unexpected' })).toBeNull();
  });

  it('normalizes custom-scheme host callbacks to the Expo route', () => {
    expect(
      normalizeFitnessOAuthRedirectPath(
        `fitty://fitness-oauth?provider=garmin&status=connected&completion=${completionId}`
      )
    ).toBe(
      `/fitness-oauth?provider=garmin&status=connected&completion=${completionId}`
    );
  });

  it('does not reinterpret unrelated or incomplete deep links', () => {
    expect(normalizeFitnessOAuthRedirectPath('fitty://coach?provider=strava&status=connected')).toBeNull();
    expect(normalizeFitnessOAuthRedirectPath('fitty://fitness-oauth?provider=strava')).toBeNull();
  });
});
