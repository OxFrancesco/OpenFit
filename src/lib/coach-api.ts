import { File } from 'expo-file-system';

import { fetchApiJson, getApiBaseUrl } from '@/lib/api-base';
import { ensureFreshToken } from '@/lib/google-auth';
import { clerkAuthHeaders } from '@/lib/clerk-session';
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
  await requireFreshGoogleToken();

  return fetchApiJson<{ connected: boolean }>('/api/coach/connect', {
    method: 'POST',
    headers: await clerkAuthHeaders(),
    body: JSON.stringify({ clerk: true }),
  });
}

export async function fetchCoachMessages() {
  await requireFreshGoogleToken();
  const data = await fetchApiJson<{ messages: WireMessage[] }>('/api/coach/messages', {
    headers: await clerkAuthHeaders(false),
  });
  return data.messages.map(fromWireMessage);
}

export async function askHealthCoach(question: string, days = 30) {
  await requireFreshGoogleToken();
  const data = await fetchApiJson<{
    answer: string;
    messages: WireMessage[];
  }>('/api/coach/ask', {
    method: 'POST',
    headers: await clerkAuthHeaders(),
    body: JSON.stringify({ question, days }),
  });

  return { ...data, messages: data.messages.map(fromWireMessage) };
}

export async function deleteCoachConversation() {
  await requireFreshGoogleToken();
  const response = await fetch(`${getApiBaseUrl()}/api/coach/messages`, {
    method: 'DELETE',
    headers: await clerkAuthHeaders(false),
  });
  if (!response.ok) {
    throw new Error(await responseError(response));
  }
}

export async function transcribeCoachRecording(uri: string) {
  await requireFreshGoogleToken();
  const isWeb = process.env.EXPO_OS === 'web';
  const bytes = isWeb
    ? new Uint8Array(await (await fetch(uri)).arrayBuffer())
    : new File(uri).bytesSync();
  const contentType = isWeb ? 'audio/webm' : 'audio/m4a';
  const response = await fetch(`${getApiBaseUrl()}/api/coach/transcribe`, {
    method: 'POST',
    headers: {
      ...await clerkAuthHeaders(false),
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


  if (token !== stored) {
    await saveStoredToken(token);
  }
  return token;
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
