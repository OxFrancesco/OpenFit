import { fetchHealthSnapshot, healthSourceName } from './health-source';
import { File } from 'expo-file-system';

import { fetchApiJson, getApiBaseUrl } from '@/lib/api-base';
import { clerkAuthHeaders } from '@/lib/clerk-session';

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

  return fetchApiJson<{ connected: boolean }>('/api/coach/connect', {
    method: 'POST',
    headers: await clerkAuthHeaders(),
    body: JSON.stringify({ clerk: true }),
  });
}

export async function fetchCoachMessages() {
  const data = await fetchApiJson<{ messages: WireMessage[] }>('/api/coach/messages', {
    headers: await clerkAuthHeaders(false),
  });
  return data.messages.map(fromWireMessage);
}

export async function askHealthCoach(question: string, days = 30, shareHealth = false) {
  const deviceHealth = shareHealth ? await fetchHealthSnapshot({ days }) : undefined;
  const data = await fetchApiJson<{
    answer: string;
    messages: WireMessage[];
  }>('/api/coach/ask', {
    method: 'POST',
    headers: await clerkAuthHeaders(),
    body: JSON.stringify({ question, days, deviceHealth: deviceHealth ? { source: healthSourceName, range: deviceHealth.rangeLabel, metrics: deviceHealth.metrics.map(({ id, label, unit, value, status }) => ({ id, label, unit, value, status })), sleepSessions: deviceHealth.sleepSessions.slice(0, 100).map(({ startTime, endTime, minutesAsleep, minutesInSleepPeriod }) => ({ startTime, endTime, minutesAsleep, minutesInSleepPeriod })), exercises: deviceHealth.exercises.slice(0, 100).map(({ name, startTime, endTime, activeMinutes }) => ({ name: name.slice(0, 120), startTime, endTime, activeMinutes })) } : undefined }),
  });

  return { ...data, messages: data.messages.map(fromWireMessage) };
}

export async function deleteCoachConversation() {
  const response = await fetch(`${getApiBaseUrl()}/api/coach/messages`, {
    method: 'DELETE',
    headers: await clerkAuthHeaders(false),
  });
  if (!response.ok) {
    throw new Error(await responseError(response));
  }
}

export async function transcribeCoachRecording(uri: string) {
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
