import type { DeviceHealthResult } from './device-health-core';
export const healthSourceName = 'Device health';
export async function requestDeviceHealth(): Promise<void> {
  throw new Error('Open OpenFit on iPhone or Android to connect Apple Health or Health Connect.');
}
export async function readDeviceHealth(_ids: string[], _start: Date, _end: Date): Promise<DeviceHealthResult> {
  throw new Error('Health data is available in the iPhone and Android apps.');
}
export async function openHealthSettings() { await requestDeviceHealth(); }
export async function canReadDeviceHealthInBackground() { return false; }
