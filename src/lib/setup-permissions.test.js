import { expect, test } from 'bun:test';
import { spawnSync } from 'bun';

function runScenario(scenario) {
  const result = spawnSync([process.execPath, '--eval', `
    import { expect, mock } from 'bun:test';
    const platform = { OS: 'android' };
    let permission = { granted: false, canAskAgain: true };
    let optimized = true;
    const events = [];
    const entries = new Map();
    const settings = mock(async () => events.push('settings'));
    mock.module('react-native', () => ({ Platform: platform, Linking: { openSettings: settings } }));
    mock.module('expo-battery', () => ({ isBatteryOptimizationEnabledAsync: async () => optimized }));
    mock.module('expo-secure-store', () => ({
      getItemAsync: async key => entries.get(key) ?? null,
      setItemAsync: async (key, value) => entries.set(key, value),
    }));
    mock.module('expo-notifications', () => ({
      IosAuthorizationStatus: { PROVISIONAL: 3 },
      AndroidImportance: { DEFAULT: 3 },
      getPermissionsAsync: async () => permission,
      setNotificationChannelAsync: async () => events.push('channel'),
      requestPermissionsAsync: async () => { events.push('request'); permission = { granted: true }; },
    }));
    const { readSetupPermissions, requestNotificationPermission,
      hasCompletedPermissionSetup, completePermissionSetup } = await import('./src/lib/setup-permissions');
    ${scenario}
  `], { cwd: new URL('../..', import.meta.url).pathname });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
}

test('Android creates its notification channel before requesting permission', () => runScenario(`
  await requestNotificationPermission();
  expect(events).toEqual(['channel', 'request']);
  expect((await readSetupPermissions()).notifications).toBe('allowed');
`));

test('a denied permission that cannot be requested again opens settings', () => runScenario(`
  permission = { granted: false, canAskAgain: false };
  expect((await readSetupPermissions()).notifications).toBe('blocked');
  await requestNotificationPermission();
  expect(events).toEqual(['channel', 'settings']);
`));

test('returning from battery settings reads the actual exemption', () => runScenario(`
  expect((await readSetupPermissions()).widgets).toBe('optimized');
  optimized = false;
  expect((await readSetupPermissions()).widgets).toBe('unrestricted');
`));

test('iOS provisional notifications count as allowed and no Android battery prompt appears', () => runScenario(`
  platform.OS = 'ios';
  permission = { granted: false, canAskAgain: true, ios: { status: 3 } };
  expect(await readSetupPermissions()).toEqual({ notifications: 'allowed', widgets: 'not-applicable' });
  await requestNotificationPermission();
  expect(events).toEqual([]);
`));

test('skipping onboarding persists per account and does not change OS permissions', () => runScenario(`
  expect(await hasCompletedPermissionSetup('alice')).toBe(false);
  await completePermissionSetup('alice');
  expect(await hasCompletedPermissionSetup('alice')).toBe(true);
  expect(await hasCompletedPermissionSetup('bob')).toBe(false);
  expect(events).toEqual([]);
  expect((await readSetupPermissions()).notifications).toBe('requestable');
`));
