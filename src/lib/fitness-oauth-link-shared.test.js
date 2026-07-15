import { describe, expect, test } from 'bun:test';

import {
  createFitnessOAuthLinkProof,
  createPendingFitnessOAuthLink,
  parsePendingFitnessOAuthLink,
} from './fitness-oauth-link-shared.ts';

describe('fitness OAuth client link proof', () => {
  test('creates a verifier and matching SHA-256 challenge', async () => {
    const proof = await createFitnessOAuthLinkProof();
    expect(proof.linkVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(proof.linkChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(proof.linkChallenge).not.toBe(proof.linkVerifier);
  });

  test('accepts only a fresh provider-bound pending verifier', () => {
    const verifier = 'A'.repeat(43);
    const pending = createPendingFitnessOAuthLink('strava', verifier, 1_000);
    const raw = JSON.stringify(pending);

    expect(parsePendingFitnessOAuthLink(raw, 'strava', 1_001)).toEqual(pending);
    expect(parsePendingFitnessOAuthLink(raw, 'garmin', 1_001)).toBeNull();
    expect(parsePendingFitnessOAuthLink(raw, 'strava', 901_000)).toBeNull();
    expect(parsePendingFitnessOAuthLink('{"linkVerifier":"bad"}', 'strava')).toBeNull();
  });
});
