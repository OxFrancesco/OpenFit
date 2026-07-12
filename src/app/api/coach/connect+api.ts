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

    if (!body || typeof body.refreshToken !== 'string' || !body.refreshToken) {
      throw new CoachApiError(400, 'Google Health needs to be reconnected.');
    }

    return forwardAgentJson(
      await healthAgentFetch(subject, '/connect', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: body.refreshToken,
          scope: typeof body.scope === 'string' ? body.scope : undefined,
          tokenType: typeof body.tokenType === 'string' ? body.tokenType : undefined,
        }),
      })
    );
  } catch (error) {
    return coachErrorResponse(error);
  }
}
