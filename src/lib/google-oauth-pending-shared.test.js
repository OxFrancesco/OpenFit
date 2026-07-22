import { describe, expect, it } from 'bun:test';

import { googleOAuthStatesMatch } from './google-oauth-pending-shared.ts';

describe('Google OAuth callback state', () => {
  it('accepts the same nonce and equivalent return-URI encoding', () => {
    expect(
      googleOAuthStatesMatch(
        'nonce.https://avg-francesco-fitty.expo.app',
        'nonce.https%3A%2F%2Favg-francesco-fitty.expo.app'
      )
    ).toBe(true);
  });

  it('rejects a different nonce or return URI', () => {
    expect(
      googleOAuthStatesMatch(
        'other.https://avg-francesco-fitty.expo.app',
        'nonce.https%3A%2F%2Favg-francesco-fitty.expo.app'
      )
    ).toBe(false);
    expect(
      googleOAuthStatesMatch(
        'nonce.https://attacker.example',
        'nonce.https%3A%2F%2Favg-francesco-fitty.expo.app'
      )
    ).toBe(false);
  });
});
