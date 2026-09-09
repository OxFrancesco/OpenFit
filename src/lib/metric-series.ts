import type { MetricDef } from './metric-catalog';

export type MetricDay = { date: string; value: number | null };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function dateKey(value: unknown): string | null {
  const date = record(value);
  if (!date) return null;
  const { year, month, day } = date;
  if (
    typeof year !== 'number' ||
    typeof month !== 'number' ||
    typeof day !== 'number' ||
    ![year, month, day].every(Number.isInteger)
  )
    return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  )
    return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function metricDailyValues(points: unknown[], def: MetricDef): MetricDay[] {
  const days = new Map<string, (number | null)[]>();
  for (const point of points) {
    const row = record(point);
    if (!row) continue;
    const payload = record(row[def.field]);
    const date = dateKey(def.kind === 'daily' ? payload?.date : record(row.civilStartTime)?.date);
    if (!date) continue;
    const value = payload ? def.extract(payload) : null;
    const values = days.get(date) ?? [];
    values.push(value);
    days.set(date, values);
  }
  return [...days]
    .map(([date, entries]) => {
      const values = entries.filter(
        (value): value is number => value !== null && Number.isFinite(value)
      );
      const total = values.reduce((sum, value) => sum + value, 0);
      return {
        date,
        value: values.length ? (def.aggregate === 'avg' ? total / values.length : total) : null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
