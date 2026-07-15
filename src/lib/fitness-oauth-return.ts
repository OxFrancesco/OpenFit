import type {
  ConnectableFitnessProviderId,
  FitnessOAuthCompletionParams,
} from '@/lib/fitness-connections-contract';

type SearchParamValue = string | string[] | undefined;
const APP_SCHEMES = new Set(['fitty:', 'com.francescooddo.fitty:']);
const COMPLETION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type FitnessOAuthRouteParams = {
  provider?: SearchParamValue;
  status?: SearchParamValue;
  error?: SearchParamValue;
  completion?: SearchParamValue;
};

function firstParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function isProvider(value: string | undefined): value is ConnectableFitnessProviderId {
  return value === 'strava' || value === 'garmin';
}

function isStatus(value: string | undefined): value is FitnessOAuthCompletionParams['status'] {
  return value === 'connected' || value === 'cancelled' || value === 'error';
}

export function normalizeFitnessOAuthParams(
  params: FitnessOAuthRouteParams
): FitnessOAuthCompletionParams | null {
  const provider = firstParam(params.provider);
  const status = firstParam(params.status);

  if (!isProvider(provider) || !isStatus(status)) {
    return null;
  }

  if (status === 'connected') {
    const completionId = firstParam(params.completion);
    if (!completionId || !COMPLETION_ID_PATTERN.test(completionId)) {
      return null;
    }
    return { provider, status, completionId };
  }

  const error = firstParam(params.error);
  return { provider, status, ...(error ? { error } : null) };
}

export function toFitnessOAuthRouteParams(params: FitnessOAuthRouteParams) {
  const normalized = normalizeFitnessOAuthParams(params);
  if (!normalized) {
    return {};
  }

  return {
    provider: normalized.provider,
    status: normalized.status,
    ...(normalized.status === 'connected'
      ? { completion: normalized.completionId }
      : null),
    ...(normalized.status !== 'connected' && normalized.error
      ? { error: normalized.error }
      : null),
  };
}

function hasFitnessOAuthParams(searchParams: URLSearchParams) {
  const status = searchParams.get('status') ?? undefined;
  return (
    isProvider(searchParams.get('provider') ?? undefined) &&
    isStatus(status) &&
    (status !== 'connected' ||
      COMPLETION_ID_PATTERN.test(searchParams.get('completion') ?? ''))
  );
}

function isFitnessOAuthUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.replace(/^\/+/, '').toLowerCase();

  return (
    APP_SCHEMES.has(url.protocol) &&
    hasFitnessOAuthParams(url.searchParams) &&
    (hostname === 'fitness-oauth' || pathname === 'fitness-oauth')
  );
}

export function normalizeFitnessOAuthRedirectPath(path: string) {
  const candidates = [() => new URL(path), () => new URL(path, 'fitty://app')];

  for (const createUrl of candidates) {
    try {
      const url = createUrl();
      if (isFitnessOAuthUrl(url)) {
        return `/fitness-oauth?${url.searchParams.toString()}`;
      }
    } catch {
      // Native intents may be arbitrary strings rather than valid URLs.
    }
  }

  const queryStart = path.indexOf('?');
  const rawPath = queryStart >= 0 ? path.slice(0, queryStart) : path;
  const rawQuery = queryStart >= 0 ? path.slice(queryStart + 1) : '';
  const searchParams = new URLSearchParams(rawQuery);

  if (
    rawPath.replace(/^\/+/, '').toLowerCase() === 'fitness-oauth' &&
    hasFitnessOAuthParams(searchParams)
  ) {
    return `/fitness-oauth?${searchParams.toString()}`;
  }

  return null;
}
