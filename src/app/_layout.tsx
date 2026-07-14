import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.separator,
      primary: colors.text,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="fitness"
          options={{
            headerShown: true,
            title: 'Fitness',
            headerBackTitle: 'Health',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="log-workout"
          options={{
            headerShown: true,
            title: 'Log exercise',
            presentation: process.env.EXPO_OS === 'ios' ? 'formSheet' : 'modal',
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            headerLeft: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close workout form"
                hitSlop={10}
                onPress={() => router.back()}
              >
                <ThemedText type="smallBold">Cancel</ThemedText>
              </Pressable>
            ),
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
