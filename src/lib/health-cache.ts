import type { HealthSnapshot } from '@/lib/health-data';

/**
 * In-memory snapshot cache keyed by dashboard range (days).
 * Lives at module scope so it survives screen remounts — switching
 * ranges or tabs renders the cached snapshot instantly, and only
 * stale entries trigger a silent background revalidation.
 */

/** Snapshots younger than this are served without hitting the network. */
const FRESH_TTL_MS = 2 * 60 * 1000;

export type SnapshotCacheEntry = {
  snapshot: HealthSnapshot;
  fetchedAt: number;
};

let accountId: string | null = null;
let generation = 0;
const pending = new Map<string, Promise<HealthSnapshot>>();

export function bindSnapshotAccount(next: string | null) {
  if (accountId !== next) {
    clearSnapshotCache();
    accountId = next;
  }
}

export async function loadCachedSnapshot(
  days: number,
  metricIds: string[],
  loader: () => Promise<HealthSnapshot>,
  force = false
): Promise<HealthSnapshot> {
  const cached = getCachedSnapshot(days);
  if (
    !force &&
    cached &&
    isSnapshotFresh(cached) &&
    metricIds.every((id) => cached.snapshot.metrics.some((metric) => metric.id === id))
  )
    return cached.snapshot;
  const key = `${days}:${[...metricIds].sort().join(',')}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const version = generation;
  const request = loader()
    .then((snapshot) => {
      if (version === generation) setCachedSnapshot(days, snapshot);
      return snapshot;
    })
    .finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
  pending.set(key, request);
  return request;
}

const cache = new Map<number, SnapshotCacheEntry>();

export function getCachedSnapshot(days: number): SnapshotCacheEntry | null {
  return cache.get(days) ?? null;
}

export function setCachedSnapshot(days: number, snapshot: HealthSnapshot) {
  cache.set(days, { snapshot, fetchedAt: Date.now() });
}

export function isSnapshotFresh(entry: SnapshotCacheEntry) {
  return Date.now() - entry.fetchedAt < FRESH_TTL_MS;
}

/** Drop everything — call on sign-out or account change. */
export function clearSnapshotCache() {
  ++generation;
  pending.clear();
  cache.clear();
}
