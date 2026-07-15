import { fetchApiJson } from '@/lib/api-base';
import type {
  ConnectableFitnessProviderId,
  FitnessConnectionSummary,
  FitnessConnectionsResponse,
  FitnessOAuthStartResponse,
} from '@/lib/fitness-connections-contract';
import { ensureFreshToken } from '@/lib/google-auth';
import { loadStoredToken, saveStoredToken } from '@/lib/token-store';

export async function fetchFitnessConnections() {
  return fetchApiJson<FitnessConnectionsResponse>('/api/fitness/connections', {
    headers: await fitnessConnectionAuthHeaders(false),
  });
}

export async function startFitnessConnection(
  provider: ConnectableFitnessProviderId,
  returnUri: string,
  linkChallenge: string
) {
  return fetchApiJson<FitnessOAuthStartResponse>(`/api/fitness/${provider}/start`, {
    method: 'POST',
    headers: await fitnessConnectionAuthHeaders(),
    body: JSON.stringify({ linkChallenge, returnUri }),
  });
}

export async function finalizeFitnessConnection(
  provider: ConnectableFitnessProviderId,
  completionId: string,
  linkVerifier: string
) {
  return fetchApiJson<FitnessConnectionSummary>(`/api/fitness/${provider}/finalize`, {
    method: 'POST',
    headers: await fitnessConnectionAuthHeaders(),
    body: JSON.stringify({ completionId, linkVerifier }),
  });
}

export async function disconnectFitnessConnection(
  provider: ConnectableFitnessProviderId,
  forceLocal = false
) {
  const query = forceLocal ? '?forceLocal=true' : '';
  return fetchApiJson<FitnessConnectionSummary>(`/api/fitness/${provider}${query}`, {
    method: 'DELETE',
    headers: await fitnessConnectionAuthHeaders(false),
  });
}

async function fitnessConnectionAuthHeaders(json = true) {
  const stored = await loadStoredToken();
  if (!stored) {
    throw new Error('Connect Google Health before adding another fitness service.');
  }

  const token = await ensureFreshToken(stored);
  if (!token.idToken) {
    throw new Error('Reconnect Google so OpenFit can verify your fitness connections.');
  }

  if (token !== stored) {
    await saveStoredToken(token);
  }

  return {
    Authorization: `Bearer ${token.idToken}`,
    'X-Google-Access-Token': token.accessToken,
    ...(json ? { 'Content-Type': 'application/json' } : null),
  };
}
