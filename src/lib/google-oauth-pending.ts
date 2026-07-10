import * as SecureStore from 'expo-secure-store';

import {
  createPendingGoogleOAuth,
  parsePendingGoogleOAuth,
  type PendingGoogleOAuth,
} from '@/lib/google-oauth-pending-shared';

export type { PendingGoogleOAuth } from '@/lib/google-oauth-pending-shared';

const PENDING_GOOGLE_OAUTH_KEY = 'fitty.google_oauth_pending';

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function savePendingGoogleOAuth(state: string) {
  const pending: PendingGoogleOAuth = createPendingGoogleOAuth(state);
  await SecureStore.setItemAsync(PENDING_GOOGLE_OAUTH_KEY, JSON.stringify(pending), STORE_OPTIONS);
}

export async function loadPendingGoogleOAuth() {
  const raw = await SecureStore.getItemAsync(PENDING_GOOGLE_OAUTH_KEY, STORE_OPTIONS);

  if (!raw) {
    return null;
  }

  const pending = parsePendingGoogleOAuth(raw);
  if (!pending) {
    await clearPendingGoogleOAuth();
    return null;
  }

  return pending;
}

export async function clearPendingGoogleOAuth() {
  await SecureStore.deleteItemAsync(PENDING_GOOGLE_OAUTH_KEY, STORE_OPTIONS);
}
