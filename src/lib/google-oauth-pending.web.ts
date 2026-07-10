import {
  createPendingGoogleOAuth,
  parsePendingGoogleOAuth,
  type PendingGoogleOAuth,
} from '@/lib/google-oauth-pending-shared';

export type { PendingGoogleOAuth } from '@/lib/google-oauth-pending-shared';

const PENDING_GOOGLE_OAUTH_KEY = 'fitty.google_oauth_pending';

export async function savePendingGoogleOAuth(state: string) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const pending: PendingGoogleOAuth = createPendingGoogleOAuth(state);
  localStorage.setItem(PENDING_GOOGLE_OAUTH_KEY, JSON.stringify(pending));
}

export async function loadPendingGoogleOAuth() {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(PENDING_GOOGLE_OAUTH_KEY);

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
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(PENDING_GOOGLE_OAUTH_KEY);
  }
}
