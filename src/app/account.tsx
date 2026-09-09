import { useAuth, useClerk, useSignIn, useSignUp, useUser } from '@clerk/expo';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  SegmentedButtons,
  TextInput,
} from 'react-native-paper';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export default function AccountScreen() {
  const theme = useTheme();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [mode, setMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'sign-in') {
        const result = await signIn.emailCode.sendCode({ emailAddress: email.trim() });
        if (result.error) throw result.error;
      } else {
        if (!sent) {
          const result = await signUp.create({ emailAddress: email.trim() });
          if (result.error) throw result.error;
        }
        const result = await signUp.verifications.sendEmailCode();
        if (result.error) throw result.error;
      }
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send a code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === 'sign-in'
          ? await signIn.emailCode.verifyCode({ code: code.trim() })
          : await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (result.error) throw result.error;
      const attempt = mode === 'sign-in' ? signIn : signUp;
      if (attempt.status !== 'complete')
        throw new Error('Verification is incomplete. Please try again.');
      const finalized = await attempt.finalize({
        navigate: ({ session }) => {
          if (session?.currentTask) {
            setError('Your account requires an additional verification step.');
            return;
          }
          router.replace('/account');
        },
      });
      if (finalized.error) throw finalized.error;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not verify this code. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      setSent(false);
      setCode('');
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Account' }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, flexGrow: 1 }}
      >
        <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 20 }}>
          {!isLoaded ? (
            <ActivityIndicator />
          ) : isSignedIn ? (
            <>
              <View
                style={{
                  padding: 24,
                  borderRadius: 28,
                  backgroundColor: theme.primaryContainer,
                  gap: 8,
                }}
              >
                <ThemedText type="subtitle">{user?.fullName || 'Your account'}</ThemedText>
                <ThemedText>{user?.primaryEmailAddress?.emailAddress}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Workouts and health connections remain on this device.
              </ThemedText>
              <Button
                mode="contained"
                onPress={() => router.replace('/fitness')}
                contentStyle={{ minHeight: 56 }}
              >
                Go to workouts
              </Button>
              <Button
                mode="outlined"
                loading={busy}
                disabled={busy}
                onPress={logout}
                contentStyle={{ minHeight: 48 }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <ThemedText type="title">
                {sent ? 'Check your email' : 'Sign in to OpenFit'}
              </ThemedText>
              {sent ? (
                <>
                  <ThemedText themeColor="textSecondary">
                    Enter the verification code sent to {email.trim()}.
                  </ThemedText>
                  <TextInput
                    mode="outlined"
                    label="Verification code"
                    accessibilityLabel="Verification code"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    maxLength={6}
                    onSubmitEditing={verify}
                  />
                  <Button
                    mode="contained"
                    onPress={verify}
                    loading={busy}
                    disabled={busy || code.trim().length !== 6}
                    contentStyle={{ minHeight: 56 }}
                  >
                    Verify and continue
                  </Button>
                  <Button onPress={sendCode} disabled={busy}>
                    Send a new code
                  </Button>
                  <Button
                    onPress={() => {
                      setSent(false);
                      setCode('');
                      setError(null);
                      signIn.reset();
                      signUp.reset();
                    }}
                    disabled={busy}
                  >
                    Use another email
                  </Button>
                </>
              ) : (
                <>
                  <SegmentedButtons
                    value={mode}
                    onValueChange={(value) => {
                      setMode(value);
                      setError(null);
                    }}
                    buttons={[
                      { value: 'sign-in', label: 'Sign in' },
                      { value: 'sign-up', label: 'Create account' },
                    ]}
                  />
                  <TextInput
                    mode="outlined"
                    label="Email address"
                    accessibilityLabel="Email address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    onSubmitEditing={sendCode}
                  />
                  <Button
                    mode="contained"
                    onPress={sendCode}
                    disabled={busy || !email.trim()}
                    loading={busy}
                    contentStyle={{ minHeight: 56 }}
                  >
                    Continue with email
                  </Button>
                </>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                <Button onPress={() => router.push('/privacy')}>Privacy</Button>
                <Button onPress={() => router.push('/terms')}>Terms</Button>
              </View>
            </>
          )}
          {error ? (
            <HelperText type="error" accessibilityRole="alert">
              {error}
            </HelperText>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
