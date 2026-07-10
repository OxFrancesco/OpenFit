export const GOOGLE_NATIVE_REDIRECT_URI = 'fitty://oauth';

export const GOOGLE_OAUTH_PARAM_KEYS = [
  'code',
  'state',
  'error',
  'error_description',
  'status',
] as const;

const APP_SCHEMES = new Set(['fitty:', 'com.francescooddo.fitty:']);

type GoogleOAuthParamKey = (typeof GOOGLE_OAUTH_PARAM_KEYS)[number];
type SearchParamValue = string | string[] | undefined;

export type GoogleOAuthRouteParams = Partial<Record<GoogleOAuthParamKey, SearchParamValue>>;

function firstParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeGoogleOAuthParams(params: GoogleOAuthRouteParams) {
  const normalized: Partial<Record<GoogleOAuthParamKey, string>> = {};

  for (const key of GOOGLE_OAUTH_PARAM_KEYS) {
    const value = firstParam(params[key]);
    if (value) {
      normalized[key] = value;
    }
  }

  return normalized;
}

export function toGoogleOAuthSearchParams(params: GoogleOAuthRouteParams) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(normalizeGoogleOAuthParams(params))) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  return searchParams;
}

export function hasGoogleOAuthParams(searchParams: URLSearchParams) {
  return GOOGLE_OAUTH_PARAM_KEYS.some((key) => searchParams.has(key));
}

function isOAuthUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.replace(/^\/+/, '').toLowerCase();

  return (
    APP_SCHEMES.has(url.protocol) &&
    hasGoogleOAuthParams(url.searchParams) &&
    (hostname === 'oauth' || pathname === 'oauth')
  );
}

export function normalizeGoogleOAuthRedirectPath(path: string) {
  const candidates = [() => new URL(path), () => new URL(path, 'fitty://app')];

  for (const createUrl of candidates) {
    try {
      const url = createUrl();
      if (isOAuthUrl(url)) {
        return `/${url.search}`;
      }
    } catch {
      // Native intents may be arbitrary strings rather than valid URLs.
    }
  }

  const queryStart = path.indexOf('?');
  const rawPath = queryStart >= 0 ? path.slice(0, queryStart) : path;
  const rawQuery = queryStart >= 0 ? path.slice(queryStart + 1) : '';
  const searchParams = new URLSearchParams(rawQuery);

  if (rawPath.replace(/^\/+/, '').toLowerCase() === 'oauth' && hasGoogleOAuthParams(searchParams)) {
    return `/?${searchParams.toString()}`;
  }

  return null;
}
