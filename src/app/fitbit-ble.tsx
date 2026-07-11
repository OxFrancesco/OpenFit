import { Redirect, Stack } from 'expo-router';

import { FitbitBleLab } from '@/components/fitbit-ble-lab';
import { useTheme } from '@/hooks/use-theme';

export default function FitbitBleScreen() {
  const theme = useTheme();

  if (!__DEV__) {
    return <Redirect href="/settings" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerBackTitle: 'Settings',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      />
      <FitbitBleLab />
    </>
  );
}
