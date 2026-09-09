import { useAuth, useClerk } from '@clerk/expo';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { ActivityIndicator, Button, HelperText } from 'react-native-paper';

export default function SsoCallback() {
  const clerk = useClerk();
  const { isSignedIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') {
      void clerk.handleRedirectCallback({ signInFallbackRedirectUrl: '/', signUpFallbackRedirectUrl: '/' })
        .catch(() => setError('Could not finish Google sign-in. Please try again.'));
    } else if (isSignedIn) router.replace('/');
  }, [clerk, isSignedIn]);
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
    {error ? <HelperText type="error">{error}</HelperText> : <ActivityIndicator />}
    <Button onPress={() => router.replace('/account')}>Back to account</Button>
  </View>;
}
