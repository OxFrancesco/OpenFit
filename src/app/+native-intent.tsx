import { normalizeFitnessOAuthRedirectPath } from '@/lib/fitness-oauth-return';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return (
      normalizeFitnessOAuthRedirectPath(path) ??
      path
    );
  } catch {
    return '/';
  }
}
