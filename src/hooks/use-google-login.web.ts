import { useSignIn, useUser } from '@clerk/expo';

export function useGoogleLogin() {
  const { user } = useUser();
  const { signIn } = useSignIn();
  return async () => {
    if (user) {
      const redirectUrl = `${window.location.origin}/`;
      const existing = user.externalAccounts.find(account => account.provider === 'google');
      const account = existing
        ? await existing.reauthorize({ redirectUrl })
        : await user.createExternalAccount({ strategy: 'oauth_google', redirectUrl });
      const url = account.verification?.externalVerificationRedirectURL?.toString();
      if (!url) throw new Error('Google did not return a sign-in link. Please try again.');
      window.location.assign(url);
    } else {
      const result = await signIn.sso({ strategy: 'oauth_google', redirectUrl: '/', redirectCallbackUrl: '/sso-callback' });
      if (result.error) throw result.error;
    }
    return false;
  };
}
