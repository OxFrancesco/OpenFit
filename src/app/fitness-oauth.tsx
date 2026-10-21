import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import {
  toFitnessOAuthRouteParams,
  type FitnessOAuthRouteParams,
} from '@/lib/fitness-oauth-return';

WebBrowser.maybeCompleteAuthSession();

export default function FitnessOAuthRedirectRoute() {
  const params = useLocalSearchParams<FitnessOAuthRouteParams>();

  return (
    <Redirect
      href={{ pathname: '/connections', params: toFitnessOAuthRouteParams(params) } as unknown as Href}
    />
  );
}
