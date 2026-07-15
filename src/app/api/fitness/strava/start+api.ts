import {
  handleFitnessApiOptions,
  handleFitnessOAuthStart,
  withFitnessApiCors,
} from '@/lib/fitness-connections-server';

export async function POST(request: Request) {
  return withFitnessApiCors(request, await handleFitnessOAuthStart(request, 'strava'));
}

export const OPTIONS = handleFitnessApiOptions;
