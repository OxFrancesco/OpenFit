import { requireOptionalNativeModule } from 'expo';
import { Linking } from 'react-native';
import type { DeviceHealthResult } from './device-health-core';

type Reader = { isAvailable(): Promise<boolean>; requestReadAuthorization(): Promise<void>;
  read(ids: string[], start: string, end: string): Promise<DeviceHealthResult> };
const reader = requireOptionalNativeModule<Reader>('OpenFitDeviceHealth');
export const healthSourceName = 'Apple Health';
async function requireReader() {
  if (!reader || !await reader.isAvailable()) throw new Error('Apple Health is unavailable. Install the latest OpenFit iPhone build.');
  return reader;
}
export async function requestDeviceHealth() { await (await requireReader()).requestReadAuthorization(); }
export async function readDeviceHealth(ids: string[], start: Date, end: Date) {
  return (await requireReader()).read(ids, start.toISOString(), end.toISOString());
}
export async function openHealthSettings() { await Linking.openURL('x-apple-health://'); }
