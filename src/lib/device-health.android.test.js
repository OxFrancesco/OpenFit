import { expect, mock, test } from 'bun:test';
const state = { origins: ['example.health'], value: 0, allowed: true, sleep: false, background: false, exercise: false, granted: [] };
mock.module('react-native-health-connect', () => ({
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
  ExerciseType: { OTHER_WORKOUT: 0, BIKING: 8, HIGH_INTENSITY_INTERVAL_TRAINING: 36, RUNNING_TREADMILL: 57, STRENGTH_TRAINING: 70 },
  getSdkStatus: async () => 3, initialize: async () => true,
  getGrantedPermissions: async () => state.allowed ? [{ accessType: 'read', recordType: 'Steps' },
    ...(state.sleep ? [{accessType:'read',recordType:'SleepSession'}] : []),
    ...(state.exercise ? [{accessType:'read',recordType:'ExerciseSession'}, {accessType:'read',recordType:'ActiveCaloriesBurned'}, {accessType:'read',recordType:'Distance'}] : []),
    ...(state.background ? [{accessType:'read',recordType:'BackgroundAccessPermission'}] : [])] : [],
  aggregateGroupByPeriod: async () => [{ startTime: '2026-09-10T00:00:00', result: { dataOrigins: state.origins, COUNT_TOTAL: state.value } }],
  aggregateRecord: async ({ recordType }) => recordType === 'Distance' ? { DISTANCE: { inKilometers: 5.2 }, dataOrigins: ['example.health'] } : { ACTIVE_CALORIES_TOTAL: { inKilocalories: 310 }, dataOrigins: ['example.health'] },
  readRecords: async (type, options) => ({ records:
    type === 'SleepSession' && Date.parse(options.timeRangeFilter.startTime) <= Date.parse('2026-09-09T23:00:00Z') ? [{startTime:'2026-09-09T23:00:00Z',endTime:'2026-09-10T08:00:00Z'}]
    : type === 'ExerciseSession' ? [{ startTime: '2026-09-10T07:00:00Z', endTime: '2026-09-10T07:45:00Z', exerciseType: 57, metadata: { id: 'w1' } }, { startTime: '2026-09-10T18:00:00Z', endTime: '2026-09-10T18:30:00Z', exerciseType: 36, title: 'Evening HIIT' }]
    : [] }),
  requestPermission: async (requested) => { state.granted = requested; return requested.filter(p => p.recordType === 'BackgroundAccessPermission'); }, openHealthConnectSettings() {},
}));
const { readDeviceHealth, requestDeviceHealth, canReadDeviceHealthInBackground } = await import('./device-health.android');

test('background access alone does not count as granting health data', async () => {
  await expect(requestDeviceHealth()).rejects.toThrow('No health permissions');
  expect(state.granted.some(p => p.recordType === 'BackgroundAccessPermission')).toBe(true);
  expect(state.granted.some(p => p.recordType === 'Steps')).toBe(true);
});

test('background reads are only possible once Health Connect grants them', async () => {
  expect(await canReadDeviceHealthInBackground()).toBe(false);
  state.background = true;
  expect(await canReadDeviceHealthInBackground()).toBe(true);
  state.background = false;
});

test('workouts get readable names, per-session calories and distance', async () => {
  state.exercise = true;
  const { exercises } = await readDeviceHealth([], new Date('2026-09-10T00:00:00Z'), new Date('2026-09-10T23:00:00Z'));
  expect(exercises.map(e => e.name)).toEqual(['Evening HIIT', 'Treadmill run']);
  expect(exercises[1]).toMatchObject({ id: 'w1', activeMinutes: 45, caloriesKcal: 310, distanceKm: 5.2 });
  state.exercise = false;
});
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
