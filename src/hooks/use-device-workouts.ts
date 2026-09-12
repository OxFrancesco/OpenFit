import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { ExerciseSummary } from '@/lib/health-data';
import { getCachedSnapshot, isSnapshotFresh } from '@/lib/health-cache';
import { fetchHealthSnapshot, isHealthEnabled } from '@/lib/health-source';

export type DeviceWorkoutsState =
  | { kind: 'unavailable' }
  | { kind: 'loading'; workouts: ExerciseSummary[] }
  | { kind: 'loaded'; workouts: ExerciseSummary[] }
  | { kind: 'error'; message: string; workouts: ExerciseSummary[] };

/**
 * Workouts recorded by other apps on this phone (Health Connect / Apple
 * Health) for the last `days`. A fresh dashboard snapshot for the same range
 * answers instantly; otherwise this reads sessions only, without touching
 * the dashboard's cache.
 */
export function useDeviceWorkouts(days = 7): DeviceWorkoutsState {
  const [state, setState] = useState<DeviceWorkoutsState>({ kind: 'unavailable' });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!(await isHealthEnabled())) {
          if (active) setState({ kind: 'unavailable' });
          return;
        }
        if (active) setState((current) => ({ kind: 'loading', workouts: 'workouts' in current ? current.workouts : [] }));
        try {
          const cached = getCachedSnapshot(days);
          const snapshot =
            cached && isSnapshotFresh(cached) ? cached.snapshot : await fetchHealthSnapshot({ days, metricIds: [] });
          if (active) setState({ kind: 'loaded', workouts: snapshot.exercises });
        } catch (cause) {
          if (active)
            setState((current) => ({
              kind: 'error',
              message: cause instanceof Error ? cause.message : String(cause),
              workouts: 'workouts' in current ? current.workouts : [],
            }));
        }
      })();
      return () => {
        active = false;
      };
    }, [days])
  );

  return state;
}
