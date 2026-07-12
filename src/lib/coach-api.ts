import { File } from 'expo-file-system';

import { fetchApiJson, getApiBaseUrl } from '@/lib/api-base';
import { ensureFreshToken } from '@/lib/google-auth';
import type { GoogleTokenResponse } from '@/lib/google-health';
import { loadStoredToken, saveStoredToken } from '@/lib/token-store';

export type CoachMessage = {
  content: string;
  createdAt: string;
  id: string;
  role: 'assistant' | 'user';
};

type WireMessage = {
  content: string;
  created_at: string;
  id: string;
  role: CoachMessage['role'];
};

export async function connectHealthCoach() {
  const token = await requireFreshGoogleToken();
  if (!token.refreshToken) {
    throw new Error('Reconnect Google Health to use the coach across devices.');
  }

  return fetchApiJson<{ connected: boolean }>('/api/coach/connect', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      refreshToken: token.refreshToken,
      scope: token.scope,
      tokenType: token.tokenType,
    }),
  });
}

export async function fetchCoachMessages() {
  const token = await requireFreshGoogleToken();
  const data = await fetchApiJson<{ messages: WireMessage[] }>('/api/coach/messages', {
    headers: authHeaders(token, false),
  });
  return data.messages.map(fromWireMessage);
}

export async function askHealthCoach(question: string, days = 30) {
  const token = await requireFreshGoogleToken();
  const data = await fetchApiJson<{
    answer: string;
    messages: WireMessage[];
  }>('/api/coach/ask', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ question, days }),
  });

  return { ...data, messages: data.messages.map(fromWireMessage) };
}

export async function deleteCoachConversation() {
  const token = await requireFreshGoogleToken();
  const response = await fetch(`${getApiBaseUrl()}/api/coach/messages`, {
    method: 'DELETE',
    headers: authHeaders(token, false),
  });
  if (!response.ok) {
    throw new Error(await responseError(response));
  }
}

export async function transcribeCoachRecording(uri: string) {
  const token = await requireFreshGoogleToken();
  const isWeb = process.env.EXPO_OS === 'web';
  const bytes = isWeb
    ? new Uint8Array(await (await fetch(uri)).arrayBuffer())
    : new File(uri).bytesSync();
  const contentType = isWeb ? 'audio/webm' : 'audio/m4a';
  const response = await fetch(`${getApiBaseUrl()}/api/coach/transcribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.idToken}`,
      'X-Google-Access-Token': token.accessToken,
      'Content-Type': contentType,
    },
    body: bytes as unknown as BodyInit,
  });

  if (!response.ok) {
    throw new Error(await responseError(response));
  }

  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? '';
}

async function requireFreshGoogleToken(): Promise<GoogleTokenResponse> {
  const stored = await loadStoredToken();
  if (!stored) {
    throw new Error('Sign in with Google to use the coach.');
  }

  const token = await ensureFreshToken(stored);
  if (!token.idToken) {
    throw new Error('Reconnect Google so OpenFit can verify your coach session.');
  }

  if (token !== stored) {
    await saveStoredToken(token);
  }
  return token;
}

function authHeaders(token: GoogleTokenResponse, json = true) {
  return {
    Authorization: `Bearer ${token.idToken}`,
    'X-Google-Access-Token': token.accessToken,
    ...(json ? { 'Content-Type': 'application/json' } : null),
  };
}

function fromWireMessage(message: WireMessage): CoachMessage {
  return {
    content: message.content,
    createdAt: message.created_at,
    id: message.id,
    role: message.role,
  };
}

async function responseError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `Request failed with status ${response.status}`;
}
