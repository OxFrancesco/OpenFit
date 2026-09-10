import {
  aggregateGroupByPeriod, getGrantedPermissions, getSdkStatus, initialize, openHealthConnectSettings,
  readRecords, requestPermission, SdkAvailabilityStatus,
  type AggregateResultRecordType, type Permission, type RecordType, type RecordResult,
} from 'react-native-health-connect';
import { getMetricDef } from './metric-catalog';
import { localDate, intervalMinutes, mergeSleepSessions, type DeviceHealthResult, type DeviceMetric } from './device-health-core';

export const healthSourceName = 'Health Connect';
type AggregateMapping = { type: AggregateResultRecordType; path: string[]; scale?: number };
const aggregates: Record<string, AggregateMapping> = {
  steps: { type: 'Steps', path: ['COUNT_TOTAL'] },
  'active-energy-burned': { type: 'ActiveCaloriesBurned', path: ['ACTIVE_CALORIES_TOTAL', 'inKilocalories'] },
  'total-calories': { type: 'TotalCaloriesBurned', path: ['ENERGY_TOTAL', 'inKilocalories'] },
  'active-minutes': { type: 'ExerciseSession', path: ['EXERCISE_DURATION_TOTAL', 'inSeconds'], scale: 1 / 60 },
  distance: { type: 'Distance', path: ['DISTANCE', 'inKilometers'] },
  floors: { type: 'FloorsClimbed', path: ['FLOORS_CLIMBED_TOTAL'] },
  altitude: { type: 'ElevationGained', path: ['ELEVATION_GAINED_TOTAL', 'inMeters'] },
  'heart-rate': { type: 'HeartRate', path: ['BPM_AVG'] },
  'daily-resting-heart-rate': { type: 'RestingHeartRate', path: ['BPM_AVG'] },
  weight: { type: 'Weight', path: ['WEIGHT_AVG', 'inKilograms'] },
  'nutrition-log': { type: 'Nutrition', path: ['ENERGY_TOTAL', 'inKilocalories'] },
  'hydration-log': { type: 'Hydration', path: ['VOLUME_TOTAL', 'inMilliliters'] },
};
const samples: Record<string, { type: RecordType; path: string[] }> = {
  'body-fat': { type: 'BodyFat', path: ['percentage'] },
  'core-body-temperature': { type: 'BodyTemperature', path: ['temperature', 'inCelsius'] },
  'blood-glucose': { type: 'BloodGlucose', path: ['level', 'inMilligramsPerDeciliter'] },
  'daily-oxygen-saturation': { type: 'OxygenSaturation', path: ['percentage'] },
  'daily-respiratory-rate': { type: 'RespiratoryRate', path: ['rate'] },
  'daily-vo2-max': { type: 'Vo2Max', path: ['vo2MillilitersPerMinuteKilogram'] },
  'daily-heart-rate-variability': { type: 'HeartRateVariabilityRmssd', path: ['heartRateVariabilityMillis'] },
};
const permissions: Permission[] = [...new Set<RecordType>([
  ...Object.values(aggregates).map(x => x.type), ...Object.values(samples).map(x => x.type), 'SleepSession', 'ExerciseSession',
])].map(recordType => ({ accessType: 'read', recordType }));
async function ready() {
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE || !await initialize()) {
    throw new Error('Install or update Health Connect, then try connecting again.');
  }
}
export async function requestDeviceHealth() {
  await ready();
  const granted = await requestPermission(permissions);
  if (!granted.some(p => p.accessType === 'read' && permissions.some(w => w.recordType === p.recordType))) {
    throw new Error('No health permissions were granted. Choose the data you want OpenFit to read.');
  }
}
export async function openHealthSettings() { openHealthConnectSettings(); }
function numberAt(value: unknown, path: string[]) {
  for (const key of path) {
    if (!value || typeof value !== 'object') return null;
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
async function allRecords<T extends RecordType>(type: T, start: Date, end: Date): Promise<RecordResult<T>[]> {
  const records: RecordResult<T>[] = [];
  let pageToken: string | undefined;
  do {
    const page = await readRecords(type, { timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() }, pageSize: 1000, pageToken });
    records.push(...page.records);
    pageToken = page.pageToken;
  } while (pageToken);
  return records;
}
export async function readDeviceHealth(ids: string[], start: Date, end: Date): Promise<DeviceHealthResult> {
  await ready();
  const allowed = new Set((await getGrantedPermissions()).filter(p => p.accessType === 'read').map(p => p.recordType));
  const metrics: DeviceMetric[] = await Promise.all(ids.map(async id => {
    const mapping = aggregates[id] ?? samples[id];
    if (!mapping) return { id, value: null, error: 'This metric is not available from Health Connect.' };
    if (!allowed.has(mapping.type)) return { id, value: null, error: 'Allow this data type in Health Connect to display it.' };
    try {
      let dailyValues: { date: string; value: number }[];
      if (aggregates[id]) {
        const a = aggregates[id];
        const groups = await aggregateGroupByPeriod({ recordType: a.type,
          timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
          timeRangeSlicer: { period: 'DAYS', length: 1 } });
        dailyValues = groups.flatMap(g => {
          // The bridge converts absent aggregate quantities to zero. An empty origin list means no data.
          const value = g.result.dataOrigins?.length ? numberAt(g.result, a.path) : null;
          return value === null ? [] : [{ date: localDate(new Date(g.startTime)), value: value * (a.scale ?? 1) }];
        });
      } else {
        const records = await allRecords(mapping.type, start, end);
        const byDay = new Map<string, number[]>();
        for (const record of records) {
          if (!('time' in record) || typeof record.time !== 'string') continue;
          const value = numberAt(record, mapping.path);
          if (value === null) continue;
          const date = localDate(new Date(record.time));
          byDay.set(date, [...(byDay.get(date) ?? []), value]);
        }
        dailyValues = [...byDay].map(([date, values]) => ({ date, value: values.reduce((a,b) => a+b,0)/values.length })).sort((a,b) => a.date.localeCompare(b.date));
      }
      const value = dailyValues.length ? dailyValues.reduce((sum, d) => sum + d.value, 0) / (getMetricDef(id)?.aggregate === 'avg' ? dailyValues.length : 1) : null;
      return { id, value, dailyValues };
    } catch (cause) { return { id, value: null, error: cause instanceof Error ? cause.message : 'Health Connect could not read this metric.' }; }
  }));
  const workouts = allowed.has('ExerciseSession') ? await allRecords('ExerciseSession', start, end) : [];
  const sleepStart = new Date(Math.max(start.getTime() - 36 * 60 * 60 * 1000, end.getTime() - 30 * 24 * 60 * 60 * 1000));
  const sleeps = allowed.has('SleepSession') ? await allRecords('SleepSession', sleepStart, end) : [];

  return { metrics, exercises: workouts.map(w => ({ id: w.metadata?.id ?? w.startTime, name: w.title || 'Workout',
    type: String(w.exerciseType), startTime: w.startTime, endTime: w.endTime,
    activeMinutes: intervalMinutes(w.startTime, w.endTime), caloriesKcal: null, distanceKm: null, steps: null })),
    sleepSessions: mergeSleepSessions(sleeps, start, end) };
}
