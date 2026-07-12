import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  askHealthCoach,
  connectHealthCoach,
  deleteCoachConversation,
  fetchCoachMessages,
  transcribeCoachRecording,
  type CoachMessage,
} from '@/lib/coach-api';

export function useHealthCoach() {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    Promise.all([connectHealthCoach(), fetchCoachMessages()])
      .then(([, history]) => {
        if (mounted.current) setMessages(history);
      })
      .catch((cause) => {
        if (mounted.current) setError(errorMessage(cause));
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });

    return () => {
      mounted.current = false;
    };
  }, []);

  const send = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || sending) return;

    const optimisticId = `local-${Date.now()}`;
    setError(null);
    setSending(true);
    setMessages((current) => [
      ...current,
      {
        content: text,
        createdAt: new Date().toISOString(),
        id: optimisticId,
        role: 'user',
      },
    ]);

    try {
      const result = await askHealthCoach(text);
      if (!mounted.current) return;
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticId),
        ...result.messages,
      ]);
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      if (mounted.current) setSending(false);
    }
  }, [sending]);

  const clear = useCallback(async () => {
    setError(null);
    try {
      await deleteCoachConversation();
      if (mounted.current) setMessages([]);
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    }
  }, []);

  const toggleRecording = useCallback(async () => {
    setError(null);
    try {
      if (recording) {
        setRecording(false);
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error('Nothing was recorded.');

        setTranscribing(true);
        const transcript = await transcribeCoachRecording(uri);
        if (!transcript) throw new Error("I didn't catch that. Try again or type your meal.");
        await send(transcript);
        return;
      }

      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone access is off. Enable it in Settings to use voice logging.');
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (cause) {
      setRecording(false);
      setError(errorMessage(cause));
    } finally {
      setTranscribing(false);
    }
  }, [recorder, recording, send]);

  return {
    busy: sending || transcribing,
    clear,
    error,
    loading,
    messages,
    recording,
    send,
    toggleRecording,
    transcribing,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The coach could not complete that request.';
}
