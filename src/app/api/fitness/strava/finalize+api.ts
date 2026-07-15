import {
  handleFitnessApiOptions,
  handleFitnessOAuthFinalize,
  withFitnessApiCors,
} from '@/lib/fitness-connections-server';

export async function POST(request: Request) {
  return withFitnessApiCors(request, await handleFitnessOAuthFinalize(request, 'strava'));
}

export const OPTIONS = handleFitnessApiOptions;
