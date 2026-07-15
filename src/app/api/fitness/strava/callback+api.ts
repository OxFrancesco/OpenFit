import { handleFitnessOAuthCallback } from '@/lib/fitness-connections-server';

export async function GET(request: Request) {
  return handleFitnessOAuthCallback(request, 'strava');
}
