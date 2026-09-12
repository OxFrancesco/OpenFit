import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { clerkSession } from './clerk-session';
import { requestDeviceHealth, readDeviceHealth } from './device-health';
import { healthWindow, deviceSnapshot } from './device-health-core';
import { DEFAULT_CARD_IDS, DEFAULT_RING_IDS } from './metric-catalog';
import type { HealthSnapshotOptions } from './health-data';
export { canReadDeviceHealthInBackground, healthSourceName, openHealthSettings } from './device-health';
const KEY = 'openfit.device-health-owner.v1';
export async function isHealthEnabled() {
  if (Platform.OS === 'web') return false;
  const session = await clerkSession();
  return Boolean(session && await SecureStore.getItemAsync(KEY) === session.user.id);
}
export async function connectDeviceHealth() {
  const session = await clerkSession();
  if (!session) throw new Error('Sign in to OpenFit first.');
  await requestDeviceHealth();
  if ((await clerkSession())?.id !== session.id) throw new Error('Your account changed. Please try again.');
  await SecureStore.setItemAsync(KEY, session.user.id, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
}
export async function disconnectDeviceHealth() {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(KEY);
}
export async function fetchHealthSnapshot(options: HealthSnapshotOptions = {}) {
  if (!await isHealthEnabled()) throw new Error('Connect device health from the dashboard first.');
  const owner = (await clerkSession())?.id;
  const { start, end } = healthWindow(Platform.OS === 'android' ? Math.min(options.days ?? 7, 30) : options.days ?? 7);
  const ids = options.metricIds ?? [...DEFAULT_RING_IDS, ...DEFAULT_CARD_IDS];
  const result = await readDeviceHealth(ids, start, end);
  if ((await clerkSession())?.id !== owner || !await isHealthEnabled()) throw new Error('Your health connection changed. Please try again.');
  return deviceSnapshot(result, ids, start, end);
}
export async function fetchHealthMetrics(ids: string[], days: number) {
  const snapshot = await fetchHealthSnapshot({ metricIds: ids, days });
  return { metrics: snapshot.metrics, raw: snapshot.raw.rollups };
}
