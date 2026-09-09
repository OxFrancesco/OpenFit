import { getClerkInstance } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';

export async function clerkSession() {
  const clerk = getClerkInstance({
    publishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    tokenCache,
  });
  if (!clerk) return null;
  if (!clerk.loaded) await clerk.load();
  return clerk.session;
}

export async function clerkAuthHeaders(json = true) {
  const session = await clerkSession();
  const token = await session?.getToken();
  if (!token) throw new Error('Sign in to OpenFit first.');
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}
