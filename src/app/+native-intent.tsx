import { normalizeFitnessOAuthRedirectPath } from '@/lib/fitness-oauth-return';
import { normalizeGoogleOAuthRedirectPath } from '@/lib/google-oauth-return';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return (
      normalizeFitnessOAuthRedirectPath(path) ??
      normalizeGoogleOAuthRedirectPath(path) ??
      path
    );
  } catch {
    return '/';
  }
}
