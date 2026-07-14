import { GOOGLE_HEALTH_SCOPES } from '@/lib/google-oauth-request';
import {
  getConfiguredGoogleCallbackUri,
  getGoogleAppReturnUri,
  getGoogleCallbackUri,
} from '@/lib/google-oauth-server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function getOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const isWeb = requestUrl.searchParams.get('platform') === 'web';
  const configuredRedirectUri = getConfiguredGoogleCallbackUri();
  const localRedirectUri = `${requestUrl.origin}/api/google/callback`;
  const redirectUri =
    configuredRedirectUri ??
    (process.env.NODE_ENV === 'development' ? localRedirectUri : getGoogleCallbackUri());
  const webReturnUri = getOrigin(redirectUri) ?? requestUrl.origin;

  return Response.json(
    {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      redirectUri,
      appReturnUri: isWeb ? webReturnUri : getGoogleAppReturnUri(),
      scopes: GOOGLE_HEALTH_SCOPES,
    },
    { headers: corsHeaders }
  );
}
