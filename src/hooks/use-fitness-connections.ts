import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  disconnectFitnessConnection,
  fetchFitnessConnections,
  finalizeFitnessConnection,
  startFitnessConnection,
} from '@/lib/fitness-connections-client';
import type {
  ConnectableFitnessProviderId,
  FitnessConnectionSummary,
  FitnessOAuthCompletionParams,
} from '@/lib/fitness-connections-contract';
import {
  clearPendingFitnessOAuthLink,
  loadPendingFitnessOAuthLink,
  savePendingFitnessOAuthLink,
} from '@/lib/fitness-oauth-link';
import { createFitnessOAuthLinkProof } from '@/lib/fitness-oauth-link-shared';
import {
  normalizeFitnessOAuthParams,
  type FitnessOAuthRouteParams,
} from '@/lib/fitness-oauth-return';

WebBrowser.maybeCompleteAuthSession();

const NATIVE_RETURN_URI = 'fitty://fitness-oauth';

function fitnessOAuthReturnUri() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/fitness-oauth`;
  }

  return NATIVE_RETURN_URI;
}

function messageFromCompletion(completion: FitnessOAuthCompletionParams) {
  if (completion.status === 'connected') {
    return null;
  }
  if (completion.status === 'cancelled') {
    return `${completion.provider === 'strava' ? 'Strava' : 'Garmin'} connection was cancelled.`;
  }
  switch (completion.error) {
    case 'authorization_cancelled':
    case 'access_denied':
      return `${completion.provider === 'strava' ? 'Strava' : 'Garmin'} connection was cancelled.`;
    case 'insufficient_scope':
      return 'The provider did not grant the permissions OpenFit requested.';
    case 'provider_unavailable':
      return 'This provider is not available on the server yet.';
    case 'reauth_required':
      return 'Reconnect this provider to continue.';
    default:
      return 'The fitness connection could not be completed. Try again.';
  }
}

export function useFitnessConnections(googleConnected: boolean) {
  const routeParams = useLocalSearchParams<FitnessOAuthRouteParams>();
  const routeProvider = routeParams.provider;
  const routeStatus = routeParams.status;
  const routeError = routeParams.error;
  const routeCompletion = routeParams.completion;
  const completion = useMemo(
    () =>
      normalizeFitnessOAuthParams({
        provider: routeProvider,
        status: routeStatus,
        error: routeError,
        completion: routeCompletion,
      }),
    [routeCompletion, routeError, routeProvider, routeStatus]
  );
  const [connections, setConnections] = useState<FitnessConnectionSummary[]>([]);
  const [busyProvider, setBusyProvider] = useState<ConnectableFitnessProviderId | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [failedDisconnectProvider, setFailedDisconnectProvider] =
    useState<ConnectableFitnessProviderId | null>(null);
  const operationRef = useRef<ConnectableFitnessProviderId | null>(null);
  const refreshRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestRef.current;
    // Keep state changes on the asynchronous side of effects that call refresh.
    await Promise.resolve();

    if (!googleConnected) {
      if (requestId === refreshRequestRef.current) {
        setConnections([]);
        setRequestError(null);
        setFailedDisconnectProvider(null);
        setLoading(false);
      }
      return;
    }

    if (requestId === refreshRequestRef.current) {
      setLoading(true);
    }
    try {
      const response = await fetchFitnessConnections();
      if (requestId === refreshRequestRef.current) {
        setConnections(response.connections);
        setRequestError(null);
      }
    } catch (caughtError) {
      if (requestId === refreshRequestRef.current) {
        setRequestError(caughtError instanceof Error ? caughtError.message : String(caughtError));
      }
    } finally {
      if (requestId === refreshRequestRef.current) {
        setLoading(false);
      }
    }
  }, [googleConnected]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const finalizeCompletion = useCallback(
    async (connectedCompletion: Extract<FitnessOAuthCompletionParams, { status: 'connected' }>) => {
      const pending = await loadPendingFitnessOAuthLink(connectedCompletion.provider);
      if (!pending) {
        throw new Error('This fitness connection was started in another app session. Start again.');
      }

      try {
        await finalizeFitnessConnection(
          connectedCompletion.provider,
          connectedCompletion.completionId,
          pending.linkVerifier
        );
      } finally {
        await clearPendingFitnessOAuthLink(connectedCompletion.provider);
      }
    },
    []
  );

  useEffect(() => {
    if (!completion) {
      return;
    }

    let active = true;
    const activeCompletion = completion;

    async function processCompletion() {
      await Promise.resolve();
      if (!active) return;

      setBusyProvider(activeCompletion.provider);
      try {
        if (activeCompletion.status === 'connected') {
          await finalizeCompletion(activeCompletion);
          if (active) {
            setCompletionMessage(null);
            await refresh();
          }
        } else {
          await clearPendingFitnessOAuthLink(activeCompletion.provider);
          if (active) {
            setCompletionMessage(messageFromCompletion(activeCompletion));
          }
        }
      } catch (caughtError) {
        if (active) {
          setCompletionMessage(
            caughtError instanceof Error ? caughtError.message : String(caughtError)
          );
        }
      } finally {
        if (active) {
          setBusyProvider(null);
          router.setParams({
            provider: undefined,
            status: undefined,
            error: undefined,
            completion: undefined,
          });
        }
      }
    }

    void processCompletion();

    return () => {
      active = false;
    };
  }, [completion, finalizeCompletion, refresh]);

  const connect = useCallback(
    async (provider: ConnectableFitnessProviderId) => {
      if (operationRef.current) {
        return;
      }
      if (!googleConnected) {
        router.push('/');
        return;
      }

      operationRef.current = provider;
      setBusyProvider(provider);
      setFailedDisconnectProvider(null);
      setCompletionMessage(null);
      setRequestError(null);
      try {
        const returnUri = fitnessOAuthReturnUri();
        const { linkChallenge, linkVerifier } = await createFitnessOAuthLinkProof();
        await savePendingFitnessOAuthLink(provider, linkVerifier);
        const { authorizationUrl } = await startFitnessConnection(
          provider,
          returnUri,
          linkChallenge
        );

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.assign(authorizationUrl);
          return;
        }

        const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, returnUri);

        if (result.type !== 'success') {
          await clearPendingFitnessOAuthLink(provider);
          setCompletionMessage(
            messageFromCompletion({ provider, status: 'cancelled' })
          );
          return;
        }

        const callback = new URL(result.url);
        const callbackCompletion = normalizeFitnessOAuthParams({
          provider: callback.searchParams.get('provider') ?? undefined,
          status: callback.searchParams.get('status') ?? undefined,
          error: callback.searchParams.get('error') ?? undefined,
          completion: callback.searchParams.get('completion') ?? undefined,
        });
        if (!callbackCompletion) {
          throw new Error('The fitness provider returned an invalid completion response.');
        }

        const completionError = messageFromCompletion(callbackCompletion);
        if (completionError) {
          await clearPendingFitnessOAuthLink(provider);
          throw new Error(completionError);
        }
        if (callbackCompletion.status !== 'connected') {
          throw new Error('The fitness provider returned an invalid completion response.');
        }
        await finalizeCompletion(callbackCompletion);
        await refresh();
      } catch (caughtError) {
        await clearPendingFitnessOAuthLink(provider).catch(() => undefined);
        setRequestError(caughtError instanceof Error ? caughtError.message : String(caughtError));
      } finally {
        operationRef.current = null;
        setBusyProvider(null);
      }
    },
    [finalizeCompletion, googleConnected, refresh]
  );

  const runDisconnect = useCallback(
    async (provider: ConnectableFitnessProviderId, forceLocal: boolean) => {
      if (operationRef.current) {
        return;
      }
      operationRef.current = provider;
      setBusyProvider(provider);
      setCompletionMessage(null);
      setRequestError(null);
      try {
        await disconnectFitnessConnection(provider, forceLocal);
        setFailedDisconnectProvider(null);
        await refresh();
      } catch (caughtError) {
        setFailedDisconnectProvider(provider);
        const providerError = caughtError instanceof Error ? caughtError.message : String(caughtError);
        setRequestError(
          forceLocal
            ? providerError
            : `${providerError} Revoke OpenFit in your provider account, then choose Remove from OpenFit.`
        );
      } finally {
        operationRef.current = null;
        setBusyProvider(null);
      }
    },
    [refresh]
  );

  const disconnect = useCallback(
    (provider: ConnectableFitnessProviderId) => runDisconnect(provider, false),
    [runDisconnect]
  );

  const removeLocal = useCallback(
    (provider: ConnectableFitnessProviderId) => runDisconnect(provider, true),
    [runDisconnect]
  );

  return {
    busyProvider,
    completion,
    connect,
    connections,
    disconnect,
    error: completionMessage ?? requestError,
    failedDisconnectProvider,
    loading,
    operationInProgress: busyProvider !== null,
    refresh,
    removeLocal,
  };
}
