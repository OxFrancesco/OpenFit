import { Stack } from 'expo-router';

import { ConnectionsScreen } from '@/components/fitness/connections';

export default function ConnectionsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Connections' }} />
      <ConnectionsScreen />
    </>
  );
}
