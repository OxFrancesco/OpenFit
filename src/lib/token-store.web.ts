import { clerkSession } from './clerk-session';
import type { GoogleTokenResponse } from '@/lib/google-health';

/** Web counterpart of token-store.ts — SecureStore is unavailable in browsers. */

const TOKEN_KEY = 'fitty.google_token';

export async function saveStoredToken(token: GoogleTokenResponse) {
  if (!token.clerkUserId || token.clerkUserId !== (await clerkSession())?.user.id) return;
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

export async function loadStoredToken(): Promise<GoogleTokenResponse | null> {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(TOKEN_KEY);

  if (!raw) {
    return null;
  }

  try {
    const token = JSON.parse(raw) as GoogleTokenResponse;
    if (!token.clerkUserId || token.clerkUserId !== (await clerkSession())?.user.id) return null;
    return token;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

export async function clearStoredToken() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
}
