import { useUser } from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE_HEALTH_SCOPES } from '../../shared/clerk-google';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleLogin() {
  const { user } = useUser();
  const { startSSOFlow } = useSSO();
  return async () => {
    const redirectUrl = 'fitty://sso-callback';
    if (user) {
      const existing = user.externalAccounts.find(account => account.provider === 'google');
      const account = existing
        ? await existing.reauthorize({ redirectUrl, additionalScopes: GOOGLE_HEALTH_SCOPES, oidcPrompt: 'consent' })
        : await user.createExternalAccount({ strategy: 'oauth_google', redirectUrl, additionalScopes: GOOGLE_HEALTH_SCOPES, oidcPrompt: 'consent' });
      const url = account.verification?.externalVerificationRedirectURL?.toString();
      if (!url) throw new Error('Google did not return a sign-in link. Please try again.');
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
      if (result.type !== 'success') return false;
      await user.reload();
    } else {
      const result = await startSSOFlow({ strategy: 'oauth_google', redirectUrl });
      if (!result.createdSessionId) {
        if (result.authSessionResult?.type === 'cancel' || result.authSessionResult?.type === 'dismiss') return false;
        throw new Error('Google sign-in needs an additional step. Please try again.');
      }
    }
    router.replace('/');
    return true;
  };
}
