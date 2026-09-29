import * as Battery from 'expo-battery';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';

export type SetupPermissions = {
  notifications: 'allowed' | 'requestable' | 'blocked';
  widgets: 'unrestricted' | 'optimized' | 'not-applicable';
};

function notificationAccess(permission: Notifications.NotificationPermissionsStatus): SetupPermissions['notifications'] {
  if (permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'allowed';
  return permission.canAskAgain ? 'requestable' : 'blocked';
}

export async function readSetupPermissions(): Promise<SetupPermissions> {
  const [permission, optimized] = await Promise.all([
    Notifications.getPermissionsAsync(),
    Platform.OS === 'android' ? Battery.isBatteryOptimizationEnabledAsync() : false,
  ]);
  return {
    notifications: notificationAccess(permission),
    widgets: Platform.OS === 'android' ? optimized ? 'optimized' : 'unrestricted' : 'not-applicable',
  };
}

export async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const permission = await Notifications.getPermissionsAsync();
  if (notificationAccess(permission) === 'allowed') return;
  if (!permission.canAskAgain) {
    await Linking.openSettings();
    return;
  }
  await Notifications.requestPermissionsAsync();
}

const setupKey = (userId: string) => `openfit.permission-setup.v1.${userId}`;

export async function hasCompletedPermissionSetup(userId: string) {
  return Platform.OS === 'web' || await SecureStore.getItemAsync(setupKey(userId)) === 'done';
}

export async function completePermissionSetup(userId: string) {
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(setupKey(userId), 'done');
}
