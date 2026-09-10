import { expect, mock, test } from 'bun:test';
const state = { origins: ['example.health'], value: 0, allowed: true, sleep: false };
mock.module('react-native-health-connect', () => ({
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
  getSdkStatus: async () => 3, initialize: async () => true,
  getGrantedPermissions: async () => state.allowed ? [{ accessType: 'read', recordType: 'Steps' }, ...(state.sleep ? [{accessType:'read',recordType:'SleepSession'}] : [])] : [],
  aggregateGroupByPeriod: async () => [{ startTime: '2026-09-10T00:00:00', result: { dataOrigins: state.origins, COUNT_TOTAL: state.value } }],
  readRecords: async (type, options) => ({ records: type === 'SleepSession' && Date.parse(options.timeRangeFilter.startTime) <= Date.parse('2026-09-09T23:00:00Z') ? [{startTime:'2026-09-09T23:00:00Z',endTime:'2026-09-10T08:00:00Z'}] : [] }), requestPermission: async () => [], openHealthConnectSettings() {},
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

test('today fetches overnight sleep records that started before midnight', async () => {
  state.allowed = true;
  state.sleep = true;
  const result = await readDeviceHealth([], new Date('2026-09-10T00:00:00Z'), new Date('2026-09-10T12:00:00Z'));
  expect(result.sleepSessions).toHaveLength(1);
  expect(result.sleepSessions[0].minutesInSleepPeriod).toBe(540);
  state.sleep = false;
});
