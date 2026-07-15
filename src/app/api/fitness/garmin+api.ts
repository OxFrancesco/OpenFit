import {
  handleFitnessApiOptions,
  handleFitnessDisconnect,
  withFitnessApiCors,
} from '@/lib/fitness-connections-server';

export async function DELETE(request: Request) {
  return withFitnessApiCors(request, await handleFitnessDisconnect(request, 'garmin'));
}

export const OPTIONS = handleFitnessApiOptions;
