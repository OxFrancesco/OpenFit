import {
  CoachApiError,
  coachErrorResponse,
  forwardAgentJson,
  healthAgentFetch,
  requireAccountSubject,
} from '@/lib/coach-server';

export async function POST(request: Request) {
  try {
    const subject = await requireAccountSubject(request);
    const body = await request.json();

    if (!body || typeof body.question !== 'string') {
      throw new CoachApiError(400, 'Enter a question for the coach.');
    }

    return forwardAgentJson(
      await healthAgentFetch(subject, '/ask', {
        method: 'POST',
        body: JSON.stringify({ question: body.question, days: body.days, deviceHealth: body.deviceHealth }),
      })
    );
  } catch (error) {
    return coachErrorResponse(error);
  }
}
