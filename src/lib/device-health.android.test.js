import { expect, mock, test } from 'bun:test';
const state = { origins: ['example.health'], value: 0, allowed: true };
mock.module('react-native-health-connect', () => ({
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
  getSdkStatus: async () => 3, initialize: async () => true,
  getGrantedPermissions: async () => state.allowed ? [{ accessType: 'read', recordType: 'Steps' }] : [],
  aggregateGroupByPeriod: async () => [{ startTime: '2026-09-10T00:00:00', result: { dataOrigins: state.origins, COUNT_TOTAL: state.value } }],
  readRecords: async () => ({ records: [] }), requestPermission: async () => [], openHealthConnectSettings() {},
}));
const { readDeviceHealth } = await import('./device-health.android');
test('Health Connect distinguishes aggregate zero, absent data, and denied permission', async () => {
  const read = async () => (await readDeviceHealth(['steps'], new Date('2026-09-10T00:00:00Z'), new Date('2026-09-10T12:00:00Z'))).metrics[0];
  expect((await read()).value).toBe(0);
  state.origins = [];
  expect((await read()).value).toBeNull();
  state.allowed = false;
  expect((await read()).error).toContain('Allow this data type');
});
