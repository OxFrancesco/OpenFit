import {
  handleFitnessApiOptions,
  handleFitnessConnectionsGet,
  withFitnessApiCors,
} from '@/lib/fitness-connections-server';

export async function GET(request: Request) {
  return withFitnessApiCors(request, await handleFitnessConnectionsGet(request));
}

export const OPTIONS = handleFitnessApiOptions;
