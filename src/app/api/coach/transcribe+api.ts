import { CoachApiError, coachErrorResponse, requireAccountSubject } from '@/lib/coach-server';

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const SUPPORTED_AUDIO_TYPES = new Set(['audio/m4a', 'audio/mp4', 'audio/webm']);

export async function POST(request: Request) {
  try {
    await requireAccountSubject(request);
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new CoachApiError(503, 'Voice logging is not configured on this server yet.');
    }

    const contentLength = Number(request.headers.get('Content-Length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES) {
      throw new CoachApiError(413, 'Record a voice note shorter than 15 MB.');
    }

    const contentType = request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
    if (!contentType || !SUPPORTED_AUDIO_TYPES.has(contentType)) {
      throw new CoachApiError(415, 'Use an M4A, MP4, or WebM voice recording.');
    }

    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_AUDIO_BYTES) {
      throw new CoachApiError(400, 'Record a voice note shorter than 15 MB.');
    }

    const form = new FormData();
    form.set('model_id', 'scribe_v1');
    form.set(
      'file',
      new Blob([bytes], { type: contentType }),
      contentType.includes('webm') ? 'nutrition-log.webm' : 'nutrition-log.m4a'
    );

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });
    const text = await response.text();

    if (!response.ok) {
      throw new CoachApiError(502, 'ElevenLabs could not transcribe that recording.');
    }

    const data = text ? (JSON.parse(text) as { text?: string }) : {};
    return Response.json({ text: data.text?.trim() ?? '' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
