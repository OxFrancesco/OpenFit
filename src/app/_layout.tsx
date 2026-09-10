import { clearStoredToken } from '@/lib/token-store';
import { ClerkProvider, useUser } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack, router } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { Appbar, ActivityIndicator, Avatar } from 'react-native-paper';
import {
  useFonts,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';
import { StatusBar } from 'expo-status-bar';
import { MaterialProvider } from '@/components/material-provider';
import { MaterialNavigation, useMainDestination } from '@/components/material-navigation';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

void clearStoredToken().catch(() => undefined);

export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey)
    throw new Error('Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY before starting OpenFit.');
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AppLayout />
    </ClerkProvider>
  );
}

function AppLayout() {
  const { user } = useUser();
  const [loaded, error] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });
  const theme = useTheme();
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();
  const destination = useMainDestination();
  const rail = width >= 840 && destination >= 0;
  return (
    <MaterialProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {!loaded && !error ? (
        <View
          style={{
            flex: 1,
            backgroundColor: theme.background,
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator />
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: theme.background,
            flexDirection: rail ? 'row' : 'column',
          }}
        >
          {rail ? <MaterialNavigation /> : null}
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerShown: true,
                contentStyle: { backgroundColor: theme.background },
                header: ({ options, route, back, navigation }) => (
                  <Appbar.Header mode="small" style={{ backgroundColor: theme.background }}>
                    {back &&
                    !['index', 'fitness', 'coach', 'settings', 'log-workout'].includes(
                      route.name
                    ) ? (
                      <Appbar.BackAction
                        accessibilityLabel="Go back"
                        onPress={() => navigation.goBack()}
                      />
                    ) : null}
                    <Appbar.Content
                      title={options.title ?? route.name}
                      titleStyle={{ fontFamily: 'Roboto_500Medium' }}
                    />
                    {route.name === 'index' ? (
                      <Appbar.Action
                        icon={
                          user?.imageUrl
                            ? () => <Avatar.Image size={32} source={{ uri: user.imageUrl }} />
                            : 'account-circle-outline'
                        }
                        accessibilityLabel={user ? 'Your OpenFit account' : 'Sign in to OpenFit'}
                        onPress={() => router.push('/account')}
                      />
                    ) : null}
                    {options.headerRight?.({
                      canGoBack: Boolean(back),
                      tintColor: theme.primary,
                    })}
                  </Appbar.Header>
                ),
              }}
            >
              <Stack.Screen name="index" options={{ title: 'OpenFit' }} />
              <Stack.Screen name="fitness" options={{ title: 'Workouts' }} />
              <Stack.Screen name="coach" options={{ title: 'Coach' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              <Stack.Screen
                name="log-workout"
                options={{
                  title: 'Log exercise',
                  presentation: 'modal',
                  headerRight: () => (
                    <Appbar.Action
                      icon="close"
                      accessibilityLabel="Close workout form"
                      onPress={() => router.back()}
                    />
                  ),
                }}
              />
              <Stack.Screen name="account" options={{ title: 'Account' }} />
              <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
              <Stack.Screen name="terms" options={{ title: 'Terms' }} />
              <Stack.Screen name="support" options={{ title: 'Support' }} />
            </Stack>
          </View>
          {!rail ? <MaterialNavigation /> : null}
        </View>
      )}
    </MaterialProvider>
  );
}
