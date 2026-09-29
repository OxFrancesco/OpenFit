import { requireClerkUser } from '@/lib/clerk-server';
import { MAX_SCHEDULE_BYTES, scheduleInputSchema } from '@/lib/workout-schedule';
import { analyzeSchedule, ScheduleError } from '@/lib/workout-schedule-server';
import { AccountError } from '../../../../shared/account-identity';

const MAX_BODY_BYTES = Math.ceil(MAX_SCHEDULE_BYTES / 3) * 4 + 30_000;
export async function POST(request: Request) {
  try {
    await requireClerkUser(request);
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new ScheduleError(503, 'Schedule import is not configured on this server.');
    if (!request.headers.get('Content-Type')?.includes('application/json')) throw new ScheduleError(415, 'Send the schedule as JSON.');
    const reader = request.body?.getReader();
    if (!reader) throw new ScheduleError(400, 'Add a schedule first.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new ScheduleError(413, 'Choose a file smaller than 8 MB.'); }
      chunks.push(chunk.value);
    }
    let body: unknown;
    try { body = JSON.parse(await new Blob(chunks.map(chunk => new Uint8Array(chunk))).text()); }
    catch { throw new ScheduleError(400, 'The schedule request is unreadable.'); }
    const parsed = scheduleInputSchema.safeParse(body);
    if (!parsed.success) throw new ScheduleError(400, 'Add a schedule as text, JPEG, PNG, WebP, or PDF, up to 8 MB.');
    return Response.json(await analyzeSchedule(parsed.data, key), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = error instanceof ScheduleError || error instanceof AccountError;
    return Response.json({ error: known ? error.message : 'Could not import the schedule. Please try again.' }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
