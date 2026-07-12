import {
  CoachApiError,
  coachErrorResponse,
  forwardAgentJson,
  healthAgentFetch,
  requireGoogleSubject,
} from '@/lib/coach-server';

export async function POST(request: Request) {
  try {
    const subject = await requireGoogleSubject(request);
    const body = await request.json();

    if (!body || typeof body.question !== 'string') {
      throw new CoachApiError(400, 'Enter a question for the coach.');
    }

    return forwardAgentJson(
      await healthAgentFetch(subject, '/ask', {
        method: 'POST',
        body: JSON.stringify({ question: body.question, days: body.days }),
      })
    );
  } catch (error) {
    return coachErrorResponse(error);
  }
}
