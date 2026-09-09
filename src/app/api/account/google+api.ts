import { requireClerkUser } from '@/lib/clerk-server';
import { GoogleConnectionError, googleTokenForClerkUser } from '../../../../shared/clerk-google';

export async function GET(request: Request) {
  try {
    const userId = await requireClerkUser(request);
    return Response.json(await googleTokenForClerkUser(process.env.CLERK_SECRET_KEY, userId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json({ error: error instanceof GoogleConnectionError ? error.message : 'Google Health is temporarily unavailable.' }, {
      status: error instanceof GoogleConnectionError ? error.status : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
