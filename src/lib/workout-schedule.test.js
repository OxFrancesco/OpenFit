import { describe, expect, test } from 'bun:test';
import { analyzeSchedule, SCHEDULE_READER_MODEL, SCHEDULE_MATCHER_MODEL } from './workout-schedule-server';
import { scheduleInputSchema, workoutScheduleSchema } from './workout-schedule';
import { POST } from '../app/api/workouts/import+api';

const entry = { day: 'Monday', originalName: 'Panca piana con bilanciere', displayName: 'Barbell bench press', translatedName: 'Barbell bench press', prescription: '4 × 8–10, 60 kg, rest 90 seconds', notes: 'Superset A' };
const extraction = { title: 'Gym schedule', sourceLanguage: 'Italian', entries: [entry], warnings: [] };
function readerResponse(data = extraction, finish = 'stop') {
  return Response.json({ choices: [{ message: { content: JSON.stringify(data) }, finish_reason: finish }] });
}
function matcherResponse(choice = 'barbell-bench-press', confidence = 0.95, probabilities = { 'barbell-bench-press': 0.98, no_match: 0.02 }) {
  return Response.json({ answers: { entry_0: { type: 'choice', choice, confidence, probabilities } } });
}
function transport(responses) {
  const requests = [];
  const requestFetch = Object.assign(async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const response = responses.shift();
    if (!response) throw new Error('Unexpected provider request');
    return response;
  }, { preconnect: fetch.preconnect });
  return { requests, requestFetch };
}
describe('schedule import', () => {
  test('Luna reads and translates, then JEV matches without changing the prescription', async () => {
    const { requests, requestFetch } = transport([readerResponse(), matcherResponse()]);
    const result = await analyzeSchedule({ text: 'Lunedì: panca piana 4x8-10', language: 'English' }, 'test-key', requestFetch);
    expect(requests.map(request => request.body.model)).toEqual([SCHEDULE_READER_MODEL, SCHEDULE_MATCHER_MODEL]);
    expect(SCHEDULE_READER_MODEL).toBe('openai/gpt-6-luna');
    expect(requests[0].body.messages).toEqual(expect.arrayContaining([expect.objectContaining({ role: 'system', content: expect.stringContaining('Translate') })]));
    expect(result.entries[0]).toMatchObject({ ...entry, exerciseId: 'barbell-bench-press' });
    expect(workoutScheduleSchema.parse(result)).toEqual(result);
  });
  test('uncertain matches stay unresolved with alternatives', async () => {
    const { requestFetch } = transport([readerResponse(), matcherResponse('barbell-bench-press', 0.4, { 'barbell-bench-press': 0.55, no_match: 0.45 })]);
    const result = await analyzeSchedule({ text: 'Panca', language: 'Italian' }, 'test-key', requestFetch);
    expect(result.entries[0].exerciseId).toBeNull();
    expect(result.entries[0].alternatives[0].exerciseId).toBe('barbell-bench-press');
  });
  test('no-match is never replaced with the closest catalog entry', async () => {
    const { requestFetch } = transport([readerResponse(), matcherResponse('no_match', 0.95, { 'barbell-bench-press': 0.02, no_match: 0.98 })]);
    expect((await analyzeSchedule({ text: 'Unknown movement', language: 'English' }, 'test-key', requestFetch)).entries[0].exerciseId).toBeNull();
  });
  test('rejects fabricated catalog IDs and missing decisions', async () => {
    for (const response of [matcherResponse('invented'), Response.json({ answers: {} })]) {
      const { requestFetch } = transport([readerResponse(), response]);
      await expect(analyzeSchedule({ text: 'Panca', language: 'English' }, 'test-key', requestFetch)).rejects.toThrow('unknown exercise');
    }
  });
  test('rejects truncated extraction rather than saving a partial plan', async () => {
    const { requests, requestFetch } = transport([readerResponse(extraction, 'length')]);
    await expect(analyzeSchedule({ text: 'Plan', language: 'English' }, 'test-key', requestFetch)).rejects.toThrow('complete workout schedule');
    expect(requests).toHaveLength(1);
  });
  test('image and PDF data reach Luna but never JEV', async () => {
    for (const mimeType of ['image/png', 'application/pdf']) {
      const { requests, requestFetch } = transport([readerResponse(), matcherResponse()]);
      await analyzeSchedule({ text: '', language: 'English', attachment: { name: 'schedule', mimeType, data: 'YWJjZA==' } }, 'test-key', requestFetch);
      expect(JSON.stringify(requests[0].body)).toContain(`data:${mimeType};base64,YWJjZA==`);
      expect(JSON.stringify(requests[1].body)).not.toContain('YWJjZA==');
    }
  });
  test('bounds input and accepts text-only schedules', () => {
    expect(scheduleInputSchema.safeParse({ text: '' }).success).toBe(false);
    expect(scheduleInputSchema.safeParse({ text: 'a'.repeat(20_001) }).success).toBe(false);
    expect(scheduleInputSchema.safeParse({ text: 'Squat 3x5' }).success).toBe(true);
  });
  test('unauthenticated requests are rejected before provider calls', async () => {
    const response = await POST(new Request('http://localhost/api/workouts/import', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(401);
  });
  test('provider credit failure has a useful redacted message', async () => {
    const { requestFetch } = transport([new Response('secret-provider-response', { status: 402 })]);
    await expect(analyzeSchedule({ text: 'Squat', language: 'English' }, 'test-key', requestFetch)).rejects.toThrow('credit limit');
  });
});
