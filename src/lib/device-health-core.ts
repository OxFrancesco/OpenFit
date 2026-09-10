import { getMetricDef } from './metric-catalog';
import type { HealthMetric, HealthSnapshot } from './health-data';

export type DeviceMetric = { id: string; value: number | null; dailyValues?: { date: string; value: number }[]; error?: string };
export type DeviceHealthResult = {
  metrics: DeviceMetric[];
  exercises: HealthSnapshot['exercises'];
  sleepSessions: HealthSnapshot['sleepSessions'];
};

export function healthWindow(days: number, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.max(0, Math.min(89, Math.round(days) - 1)));
  return { start, end: now };
}

export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function deviceSnapshot(result: DeviceHealthResult, ids: string[], start: Date, end: Date): HealthSnapshot {
  const metrics = ids.flatMap((id): HealthMetric[] => {
    const def = getMetricDef(id);
    if (!def) return [];
    const metric = result.metrics.find(item => item.id === id);
    const value = metric?.value ?? null;
    return [{ id, label: def.label, unit: def.unit, value,
      status: metric?.error ? 'error' : value === null ? 'empty' : 'loaded',
      error: metric?.error, dailyValues: metric?.dailyValues }];
  });
  return { metrics, exercises: result.exercises, sleepSessions: result.sleepSessions,
    rangeLabel: `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`,
    raw: { rollups: {}, exercises: {}, sleep: {} } };
}

export function intervalMinutes(start: string, end: string) {
  const duration = (Date.parse(end) - Date.parse(start)) / 60000;
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

export function unionMinutes(intervals: { startTime: string; endTime: string }[]) {
  const sorted = intervals.map(x => [Date.parse(x.startTime), Date.parse(x.endTime)])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a).sort((a,b) => a[0]-b[0]);
  let total = 0, end = -Infinity;
  for (const [a,b] of sorted) { total += Math.max(0, b - Math.max(a,end)); end = Math.max(end,b); }
  return total / 60000;
}

export function mergeSleepSessions(records: { startTime: string; endTime: string; stages?: { startTime: string; endTime: string; stage: number }[] }[], start: Date, end: Date): HealthSnapshot['sleepSessions'] {
  const sessions = records.map(record => ({ record, start: Date.parse(record.startTime), end: Math.min(end.getTime(), Date.parse(record.endTime)) }))
    .filter(x => Number.isFinite(x.start) && Number.isFinite(x.end) && x.end > x.start && x.end > start.getTime()).sort((a,b) => a.start - b.start);
  const groups: { start: number; end: number; stages: {startTime: string; endTime: string}[]; staged: boolean }[] = [];
  for (const session of sessions) {
    const stages = (session.record.stages ?? []).filter(stage => [2,4,5,6].includes(stage.stage)).flatMap(stage => {
      const a = Math.max(session.start, Date.parse(stage.startTime)), b = Math.min(session.end, Date.parse(stage.endTime));
      return Number.isFinite(a) && Number.isFinite(b) && b > a ? [{startTime: new Date(a).toISOString(), endTime: new Date(b).toISOString()}] : [];
    });
    const previous = groups.at(-1);
    if (previous && session.start <= previous.end) {
      previous.end = Math.max(previous.end, session.end);
      previous.stages.push(...stages);
      previous.staged ||= Boolean(session.record.stages?.length);
    } else groups.push({ start: session.start, end: session.end, stages, staged: Boolean(session.record.stages?.length) });
  }
  return groups.reverse().map(group => ({ id: new Date(group.start).toISOString(), kind: 'sleep', startTime: new Date(group.start).toISOString(), endTime: new Date(group.end).toISOString(), minutesAsleep: group.staged ? unionMinutes(group.stages) : null, minutesInSleepPeriod: (group.end-group.start)/60000 }));
}
