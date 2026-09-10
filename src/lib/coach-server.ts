import { requireClerkUser } from './clerk-server';
import { AccountError, storageIdForAccount } from '../../shared/account-identity';

export async function requireAccountSubject(request: Request) {
  return storageIdForAccount(process.env.CLERK_SECRET_KEY, await requireClerkUser(request));
}

export function getHealthAgentConfig() {
  const baseUrl = process.env.HEALTH_AGENT_URL?.replace(/\/+$/, '');
  const token = process.env.HEALTH_AGENT_CLERK_API_TOKEN || process.env.HEALTH_AGENT_API_TOKEN;

  if (!baseUrl || !token) {
    throw new CoachApiError(
      503,
      'The health coach is temporarily unavailable. Please try again later.'
    );
  }

  return { baseUrl, token };
}

export async function healthAgentFetch(subject: string, path: string, init?: RequestInit) {
  const { baseUrl, token } = getHealthAgentConfig();
  return fetch(
    `${baseUrl}/agents/fitty-health-agent/${encodeURIComponent(subject)}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : null),
        ...init?.headers,
      },
    }
  );
}

export class CoachApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'CoachApiError';
  }
}

export function coachErrorResponse(error: unknown) {
  if (error instanceof CoachApiError || error instanceof AccountError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: 'The coach could not complete that request.' }, { status: 500 });
}

export async function forwardAgentJson(response: Response) {
  const body = await response.text();
  return new Response(body || null, {
    status: response.status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json; charset=utf-8',
    },
  });
}
