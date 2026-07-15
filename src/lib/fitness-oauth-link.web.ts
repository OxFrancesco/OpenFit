import type { ConnectableFitnessProviderId } from '@/lib/fitness-connections-contract';
import {
  createPendingFitnessOAuthLink,
  parsePendingFitnessOAuthLink,
} from '@/lib/fitness-oauth-link-shared';

function pendingKey(provider: ConnectableFitnessProviderId) {
  return `fitty.fitness_oauth_pending.${provider}`;
}

export async function savePendingFitnessOAuthLink(
  provider: ConnectableFitnessProviderId,
  linkVerifier: string
) {
  if (typeof sessionStorage === 'undefined') return;
  const pending = createPendingFitnessOAuthLink(provider, linkVerifier);
  sessionStorage.setItem(pendingKey(provider), JSON.stringify(pending));
}

export async function loadPendingFitnessOAuthLink(provider: ConnectableFitnessProviderId) {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(pendingKey(provider));
  if (!raw) return null;
  const pending = parsePendingFitnessOAuthLink(raw, provider);
  if (!pending) await clearPendingFitnessOAuthLink(provider);
  return pending;
}

export async function clearPendingFitnessOAuthLink(provider: ConnectableFitnessProviderId) {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(pendingKey(provider));
  }
}
