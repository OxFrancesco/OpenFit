import { beforeEach, expect, test } from 'bun:test';
import {
  bindSnapshotAccount,
  clearSnapshotCache,
  getCachedSnapshot,
  loadCachedSnapshot,
} from './health-cache';
const snapshot = {
  metrics: [{ id: 'steps', value: 42 }],
  exercises: [],
  sleepSessions: [],
  rangeLabel: 'Today',
  raw: {},
};
beforeEach(() => {
  clearSnapshotCache();
  bindSnapshotAccount('a');
});
test('returning to the same account retains cached ranges without another request', async () => {
  let calls = 0;
  const loader = async () => {
    calls++;
    return snapshot;
  };
  await loadCachedSnapshot(7, ['steps'], loader);
  bindSnapshotAccount('a');
  expect(await loadCachedSnapshot(7, ['steps'], loader)).toBe(snapshot);
  expect(calls).toBe(1);
});
test('a background prefetch and range tap share one request', async () => {
  let resolve;
  let calls = 0;
  const loader = () => {
    calls++;
    return new Promise((done) => {
      resolve = done;
    });
  };
  const first = loadCachedSnapshot(14, ['steps'], loader);
  const second = loadCachedSnapshot(14, ['steps'], loader);
  resolve(snapshot);
  expect(await first).toBe(await second);
  expect(calls).toBe(1);
});
test('an old account request cannot repopulate cache after switching accounts', async () => {
  let resolve;
  const pending = loadCachedSnapshot(
    30,
    ['steps'],
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  bindSnapshotAccount('b');
  resolve(snapshot);
  await pending;
  expect(getCachedSnapshot(30)).toBeNull();
});
test('newly selected metrics require a top up and forced refresh bypasses fresh data', async () => {
  let calls = 0;
  const loader = async () => {
    calls++;
    return snapshot;
  };
  await loadCachedSnapshot(1, ['steps'], loader);
  await loadCachedSnapshot(1, ['steps', 'distance'], loader);
  await loadCachedSnapshot(1, ['steps'], loader, true);
  expect(calls).toBe(3);
});
