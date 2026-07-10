import { Redirect, useLocalSearchParams } from 'expo-router';

import {
  normalizeGoogleOAuthParams,
  type GoogleOAuthRouteParams,
} from '@/lib/google-oauth-return';

export default function OAuthRedirectRoute() {
  const params = useLocalSearchParams<GoogleOAuthRouteParams>();

  return <Redirect href={{ pathname: '/', params: normalizeGoogleOAuthParams(params) }} />;
}
