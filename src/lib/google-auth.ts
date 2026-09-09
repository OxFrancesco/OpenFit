import { fetchApiJson } from '@/lib/api-base';
import { clerkAuthHeaders, clerkSession } from '@/lib/clerk-session';
import type { GoogleTokenResponse } from '@/lib/google-health';

export function isAccessTokenFresh(token: GoogleTokenResponse) {
  return Boolean(token.accessToken && token.expiresIn && token.issuedAt + token.expiresIn - 120 > Date.now() / 1000);
}

export async function fetchClerkGoogleToken(): Promise<GoogleTokenResponse> {
  const session = await clerkSession();
  if (!session) throw new Error('Sign in to OpenFit first.');
  const token = await fetchApiJson<GoogleTokenResponse>('/api/account/google', {
    headers: await clerkAuthHeaders(false),
  });
  if (token.clerkUserId !== session.user.id || (await clerkSession())?.id !== session.id) {
    throw new Error('Your account changed. Please try again.');
  }
  return token;
}

export async function ensureFreshToken(token: GoogleTokenResponse): Promise<GoogleTokenResponse> {
  const session = await clerkSession();
  if (!session || !token.clerkUserId || token.clerkUserId !== session.user.id) {
    throw new Error('Sign in to OpenFit to reconnect Google Health.');
  }
  return isAccessTokenFresh(token) ? token : fetchClerkGoogleToken();
}
