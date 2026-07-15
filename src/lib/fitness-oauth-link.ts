import * as SecureStore from 'expo-secure-store';

import type { ConnectableFitnessProviderId } from '@/lib/fitness-connections-contract';
import {
  createPendingFitnessOAuthLink,
  parsePendingFitnessOAuthLink,
} from '@/lib/fitness-oauth-link-shared';

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

function pendingKey(provider: ConnectableFitnessProviderId) {
  return `fitty.fitness_oauth_pending.${provider}`;
}

export async function savePendingFitnessOAuthLink(
  provider: ConnectableFitnessProviderId,
  linkVerifier: string
) {
  const pending = createPendingFitnessOAuthLink(provider, linkVerifier);
  await SecureStore.setItemAsync(pendingKey(provider), JSON.stringify(pending), STORE_OPTIONS);
}

export async function loadPendingFitnessOAuthLink(provider: ConnectableFitnessProviderId) {
  const raw = await SecureStore.getItemAsync(pendingKey(provider), STORE_OPTIONS);
  if (!raw) return null;
  const pending = parsePendingFitnessOAuthLink(raw, provider);
  if (!pending) await clearPendingFitnessOAuthLink(provider);
  return pending;
}

export async function clearPendingFitnessOAuthLink(provider: ConnectableFitnessProviderId) {
  await SecureStore.deleteItemAsync(pendingKey(provider), STORE_OPTIONS);
}
