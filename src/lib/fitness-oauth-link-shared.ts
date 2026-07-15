import type { ConnectableFitnessProviderId } from '@/lib/fitness-connections-contract';

const FITNESS_LINK_TTL_MS = 15 * 60 * 1000;
const LINK_VERIFIER_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type PendingFitnessOAuthLink = {
  createdAt: number;
  linkVerifier: string;
  provider: ConnectableFitnessProviderId;
};

export async function createFitnessOAuthLinkProof(): Promise<{
  linkChallenge: string;
  linkVerifier: string;
}> {
  const linkVerifier = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(linkVerifier)
  );
  return {
    linkChallenge: bytesToBase64Url(new Uint8Array(digest)),
    linkVerifier,
  };
}

export function createPendingFitnessOAuthLink(
  provider: ConnectableFitnessProviderId,
  linkVerifier: string,
  now = Date.now()
): PendingFitnessOAuthLink {
  if (!LINK_VERIFIER_PATTERN.test(linkVerifier)) {
    throw new Error('The fitness connection verifier is invalid.');
  }
  return { createdAt: now, linkVerifier, provider };
}

export function parsePendingFitnessOAuthLink(
  raw: string,
  expectedProvider: ConnectableFitnessProviderId,
  now = Date.now()
): PendingFitnessOAuthLink | null {
  try {
    const value = JSON.parse(raw) as Partial<PendingFitnessOAuthLink>;
    if (
      value.provider !== expectedProvider ||
      typeof value.createdAt !== 'number' ||
      !Number.isSafeInteger(value.createdAt) ||
      value.createdAt > now ||
      value.createdAt + FITNESS_LINK_TTL_MS <= now ||
      typeof value.linkVerifier !== 'string' ||
      !LINK_VERIFIER_PATTERN.test(value.linkVerifier)
    ) {
      return null;
    }
    return value as PendingFitnessOAuthLink;
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
