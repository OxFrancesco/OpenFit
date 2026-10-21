import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

import { FitnessScreen } from '@/components/fitness/fitness-screen';
import {
  toFitnessOAuthRouteParams,
  type FitnessOAuthRouteParams,
} from '@/lib/fitness-oauth-return';

export default function FitnessRoute() {
  const params = useLocalSearchParams<FitnessOAuthRouteParams>();

  // Older OAuth returns and links pointed at /fitness?provider=…; connections now live on their own screen.
  if (params.provider) {
    return (
      <Redirect
        href={{ pathname: '/connections', params: toFitnessOAuthRouteParams(params) } as unknown as Href}
      />
    );
  }

  return <FitnessScreen />;
}
