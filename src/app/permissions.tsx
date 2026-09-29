import { Redirect, Stack, router } from 'expo-router';
import { Platform } from 'react-native';
import { PermissionSetup } from '@/components/permission-setup';

export default function PermissionsScreen() {
  if (Platform.OS === 'web') return <Redirect href="/settings" />;
  return <><Stack.Screen options={{ headerShown: false }} /><PermissionSetup onDone={async () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }} /></>;
}
