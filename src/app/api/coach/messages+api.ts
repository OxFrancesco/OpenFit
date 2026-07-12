import {
  coachErrorResponse,
  forwardAgentJson,
  healthAgentFetch,
  requireGoogleSubject,
} from '@/lib/coach-server';

export async function GET(request: Request) {
  try {
    const subject = await requireGoogleSubject(request);
    return forwardAgentJson(await healthAgentFetch(subject, '/messages'));
  } catch (error) {
    return coachErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const subject = await requireGoogleSubject(request);
    return forwardAgentJson(await healthAgentFetch(subject, '/messages', { method: 'DELETE' }));
  } catch (error) {
    return coachErrorResponse(error);
  }
}
