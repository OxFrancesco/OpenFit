import { expect, test } from 'bun:test';
import { deviceSnapshot, dedupeExercises, healthWindow, unionMinutes, mergeSleepSessions } from './device-health-core';
import { accountStorageId } from '../../shared/account-identity';
import { retiredGoogleAccess } from './retired-google-access';

test('device snapshots preserve a real zero and distinguish missing or denied data', () => {
  const snapshot = deviceSnapshot({ metrics: [{ id: 'steps', value: 0 }, { id: 'weight', value: null, error: 'Permission denied' }], exercises: [], sleepSessions: [] }, ['steps', 'weight', 'distance'], new Date('2026-09-10T00:00:00Z'), new Date('2026-09-10T12:00:00Z'));
  expect(snapshot.metrics.map(m => [m.value, m.status])).toEqual([[0,'loaded'],[null,'error'],[null,'empty']]);
});
test('overlapping sleep stages from two sources are not counted twice', () => {
  expect(unionMinutes([{startTime:'2026-09-10T00:00:00Z',endTime:'2026-09-10T02:00:00Z'}, {startTime:'2026-09-10T01:00:00Z',endTime:'2026-09-10T03:00:00Z'}, {startTime:'bad',endTime:'bad'}])).toBe(180);
});
test('today uses local midnight and never reads future days', () => {
  const now = new Date(2026,8,10,13,15);
  const {start,end} = healthWindow(1,now);
  expect(start.getHours()).toBe(0); expect(start.getDate()).toBe(10); expect(end).toEqual(now);
});
test('email-only Clerk accounts work and linked accounts retain their existing storage', () => {
  expect(accountStorageId({id:'user_a', external_accounts:[]},'user_a')).toBe('user_a');
  expect(accountStorageId({id:'user_a', external_accounts:[{provider:'oauth_google',provider_user_id:'123'}]},'user_a')).toBe('123');
  expect(() => accountStorageId({id:'user_b'},'user_a')).toThrow('verify');
});
test('legacy Google routes cannot issue or refresh tokens', async () => {
  const response = retiredGoogleAccess();
  expect(response.status).toBe(410);
  expect(await response.text()).toContain('retired');
});

test('overnight sleep retains the full session and merges duplicate sources', () => {
  const stage = {startTime:'2026-09-09T23:00:00Z',endTime:'2026-09-10T02:00:00Z',stage:2};
  const sessions = mergeSleepSessions([{...stage,stages:[stage]}, {...stage,stages:[stage]}], new Date('2026-09-10T00:00:00Z'),new Date('2026-09-10T01:00:00Z'));
  expect(sessions).toHaveLength(1);
  expect(sessions[0].minutesAsleep).toBe(120);
  expect(sessions[0].minutesInSleepPeriod).toBe(120);
});

test('the same workout written by two apps shows once, keeping the richer record', () => {
  const walk = { type: '79', startTime: '2026-09-11T00:24:00Z', endTime: '2026-09-11T00:54:00Z', activeMinutes: 30, steps: null };
  const result = dedupeExercises([
    { ...walk, id: 'a', name: 'Walking', caloriesKcal: null, distanceKm: 2.07 },
    { ...walk, id: 'b', name: 'Walking', startTime: '2026-09-11T00:24:20Z', caloriesKcal: 140, distanceKm: 2.07 },
    { ...walk, id: 'c', name: 'Walking', type: '56', caloriesKcal: null, distanceKm: null },
    { ...walk, id: 'd', name: 'Walking', startTime: '2026-09-11T06:00:00Z', endTime: '2026-09-11T06:30:00Z', caloriesKcal: null, distanceKm: null },
  ]);
  expect(result.map(e => e.id)).toEqual(['b', 'c', 'd']);
});

test('sleep that ended before today stays out of the today view', () => {
  expect(mergeSleepSessions([{startTime:'2026-09-09T00:00:00Z',endTime:'2026-09-09T08:00:00Z'}], new Date('2026-09-10T00:00:00Z'),new Date('2026-09-10T12:00:00Z'))).toEqual([]);
});
