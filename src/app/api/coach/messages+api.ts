import {
  coachErrorResponse,
  forwardAgentJson,
  healthAgentFetch,
  requireAccountSubject,
} from '@/lib/coach-server';

export async function GET(request: Request) {
  try {
    const subject = await requireAccountSubject(request);
    return forwardAgentJson(await healthAgentFetch(subject, '/messages'));
  } catch (error) {
    return coachErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const subject = await requireAccountSubject(request);
    return forwardAgentJson(await healthAgentFetch(subject, '/messages', { method: 'DELETE' }));
  } catch (error) {
    return coachErrorResponse(error);
  }
}
