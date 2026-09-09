import { requireClerkUser } from '@/lib/clerk-server';
import { googleTokenForClerkUser } from '../../../../shared/clerk-google';
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
    if (body?.clerk === true) {
      const userId = await requireClerkUser(request);
      await googleTokenForClerkUser(process.env.CLERK_SECRET_KEY, userId, subject);
      return forwardAgentJson(await healthAgentFetch(subject, '/connect-clerk', {
        method: 'POST', body: JSON.stringify({ userId }),
      }));
    }

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
