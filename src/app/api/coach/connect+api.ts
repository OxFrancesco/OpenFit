import { coachErrorResponse, forwardAgentJson, healthAgentFetch, requireAccountSubject } from '@/lib/coach-server';
export async function POST(request: Request) {
  try {
    const subject = await requireAccountSubject(request);
    return forwardAgentJson(await healthAgentFetch(subject, '/status'));
  } catch (error) { return coachErrorResponse(error); }
}
