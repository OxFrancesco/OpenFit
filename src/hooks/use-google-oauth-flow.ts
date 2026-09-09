import * as ExpoCrypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';

import { fetchApiJson } from '@/lib/api-base';
import {
  type GoogleHealthConfig,
  type GoogleTokenResponse,
} from '@/lib/google-health';
import { buildGoogleAuthUrl } from '@/lib/google-oauth-request';
import {
  clearPendingGoogleOAuth,
  loadPendingGoogleOAuth,
  savePendingGoogleOAuth,
} from '@/lib/google-oauth-pending';
import { googleOAuthStatesMatch } from '@/lib/google-oauth-pending-shared';
import {
  GOOGLE_NATIVE_REDIRECT_URI,
  hasGoogleOAuthParams,
  normalizeGoogleOAuthParams,
  toGoogleOAuthSearchParams,
  type GoogleOAuthRouteParams,
} from '@/lib/google-oauth-return';
import { clearSnapshotCache } from '@/lib/health-cache';
import { saveStoredToken } from '@/lib/token-store';

WebBrowser.maybeCompleteAuthSession();

type AuthState = 'idle' | 'loading' | 'loaded' | 'error';

type GoogleOAuthFlowOptions<Range extends number> = {
  config: GoogleHealthConfig | null;
  loadHealthData: (accessToken: string, range: Range) => Promise<void>;
  range: Range;
  setAuthState: (state: AuthState) => void;
  setConfig: (config: GoogleHealthConfig) => void;
  setConfigError: (error: string | null) => void;
  setError: (error: string | null) => void;
  setToken: (token: GoogleTokenResponse) => void;
  token: GoogleTokenResponse | null;
};

function createOAuthState(appReturnUri: string) {
  return `${ExpoCrypto.randomUUID()}.${encodeURIComponent(appReturnUri)}`;
}

export function isGoogleConfigReady(
  config: GoogleHealthConfig | null
): config is GoogleHealthConfig {
  return Boolean(config?.clientId && config.hasClientSecret && config.redirectUri && config.appReturnUri);
}

export async function fetchGoogleConfig() {
  const route = Platform.OS === 'web' ? '/oauth/config' : '/api/oauth/config';
  return fetchApiJson<GoogleHealthConfig>(`${route}?platform=${Platform.OS}`);
}

export function useGoogleOAuthFlow<Range extends number>({
  config,
  loadHealthData,
  range,
  setAuthState,
  setConfig,
  setConfigError,
  setError,
  setToken,
  token,
}: GoogleOAuthFlowOptions<Range>) {
  const routeParams = useLocalSearchParams<GoogleOAuthRouteParams>();
  const oauthQuery = toGoogleOAuthSearchParams(normalizeGoogleOAuthParams(routeParams)).toString();
  const oauthSearchParams = useMemo(() => new URLSearchParams(oauthQuery), [oauthQuery]);
  const pendingStateRef = useRef<string | null>(null);
  const processedStatesRef = useRef(new Set<string>());

  const resolveConfig = useCallback(async () => {
    const activeConfig = isGoogleConfigReady(config) ? config : await fetchGoogleConfig();
    setConfig(activeConfig);
    setConfigError(null);

    if (!isGoogleConfigReady(activeConfig)) {
      throw new Error('Google OAuth config is incomplete. Check the API server environment.');
    }

    return activeConfig;
  }, [config, setConfig, setConfigError]);

  const completeSignIn = useCallback(
    async (
      searchParams: URLSearchParams,
      activeConfig: GoogleHealthConfig,
      expectedState?: string | null
    ) => {
      const returnedState = searchParams.get('state');
      const oauthError = searchParams.get('error_description') ?? searchParams.get('error');

      if (!returnedState) {
        throw new Error('Google OAuth state was missing. Try signing in again.');
      }

      // Expo Router can retain the original callback params after the browser URL
      // has been cleaned. Range or preference updates then re-render this hook.
      // Ignore an already-completed callback before looking for pending state,
      // which was intentionally cleared after the first successful exchange.
      if (processedStatesRef.current.has(returnedState)) {
        return;
      }

      const pendingState =
        expectedState ??
        pendingStateRef.current ??
        (await loadPendingGoogleOAuth())?.state ??
        null;

      if (!pendingState) {
        throw new Error('Google OAuth session was not found. Start sign-in again.');
      }

      if (!googleOAuthStatesMatch(returnedState, pendingState)) {
        throw new Error('Google OAuth state did not match. Try signing in again.');
      }

      if (oauthError) {
        pendingStateRef.current = null;
        await clearPendingGoogleOAuth().catch(() => undefined);
        throw new Error(oauthError);
      }

      processedStatesRef.current.add(returnedState);

      try {
        const authorizationCode = searchParams.get('code');
        const nextToken = authorizationCode
          ? await fetchApiJson<GoogleTokenResponse>('/oauth/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: authorizationCode, redirectUri: activeConfig.redirectUri }),
            })
          : await fetchApiJson<GoogleTokenResponse>(
              `/api/google/session?state=${encodeURIComponent(returnedState)}`
            );

        clearSnapshotCache();
        pendingStateRef.current = null;
        await clearPendingGoogleOAuth().catch(() => undefined);
        setToken(nextToken);
        setAuthState('loaded');
        await saveStoredToken(nextToken).catch(() => undefined);
        await loadHealthData(nextToken.accessToken, range);
      } catch (signInError) {
        processedStatesRef.current.delete(returnedState);
        throw signInError;
      }
    },
    [loadHealthData, range, setAuthState, setToken]
  );

  useEffect(() => {
    if (!hasGoogleOAuthParams(oauthSearchParams)) {
      return;
    }

    let ignore = false;

    async function completeRouteOAuth() {
      setAuthState('loading');
      setError(null);

      try {
        const activeConfig = await resolveConfig();
        if (!ignore) {
          await completeSignIn(oauthSearchParams, activeConfig);
        }
      } catch (routeError) {
        if (!ignore) {
          setError(routeError instanceof Error ? routeError.message : String(routeError));
          setAuthState('error');
        }
      } finally {
        if (!ignore) {
          if (Platform.OS === 'web') {
            window.history.replaceState({}, document.title, '/');
          } else {
            router.replace('/');
          }
        }
      }
    }

    void completeRouteOAuth();

    return () => {
      ignore = true;
    };
  }, [completeSignIn, oauthSearchParams, resolveConfig, setAuthState, setError]);

  return useCallback(async () => {
    setAuthState('loading');
    setError(null);

    try {
      const activeConfig = await resolveConfig();
      const appReturnUri = activeConfig.appReturnUri || GOOGLE_NATIVE_REDIRECT_URI;
      const nextState = createOAuthState(appReturnUri);
      pendingStateRef.current = nextState;
      await savePendingGoogleOAuth(nextState);

      const authorizationUrl = buildGoogleAuthUrl(activeConfig, nextState);

      if (Platform.OS === 'web') {
        window.location.assign(authorizationUrl);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, appReturnUri);

      if (result.type !== 'success') {
        pendingStateRef.current = null;
        await clearPendingGoogleOAuth().catch(() => undefined);
        setAuthState(token ? 'loaded' : 'idle');
        return;
      }

      await completeSignIn(new URL(result.url).searchParams, activeConfig, nextState);
    } catch (signInError) {
      pendingStateRef.current = null;
      await clearPendingGoogleOAuth().catch(() => undefined);
      setError(signInError instanceof Error ? signInError.message : String(signInError));
      setAuthState('error');
    }
  }, [completeSignIn, resolveConfig, setAuthState, setError, token]);
}
