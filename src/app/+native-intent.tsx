import { normalizeGoogleOAuthRedirectPath } from '@/lib/google-oauth-return';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return normalizeGoogleOAuthRedirectPath(path) ?? path;
  } catch {
    return '/';
  }
}
