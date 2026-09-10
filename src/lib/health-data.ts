import type { MetricDay } from './metric-series';
import { getMetricDef } from './metric-catalog';

export type HealthMetric = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  status: 'loaded' | 'empty' | 'error';
  error?: string;
  dailyValues?: MetricDay[];
};

export type ExerciseSummary = {
  id: string;
  name: string;
  type: string;
  startTime?: string;
  endTime?: string;
  activeMinutes: number | null;
  caloriesKcal: number | null;
  distanceKm: number | null;
  steps: number | null;
};

export type SleepSummary = {
  id: string;
  /** 'nap' when the API flags the session as a nap (or it looks like one) */
  kind: 'sleep' | 'nap';
  startTime?: string;
  endTime?: string;
  minutesAsleep: number | null;
  minutesInSleepPeriod: number | null;
};

export type HealthSnapshot = {
  metrics: HealthMetric[];
  exercises: ExerciseSummary[];
  /** Sleep sessions in the range, most recent first */
  sleepSessions: SleepSummary[];
  rangeLabel: string;
  raw: {
    rollups: Record<string, unknown>;
    exercises: unknown;
    sleep: unknown;
  };
};

export type HealthSnapshotOptions = {
  days?: number;
  /** Metric ids to load; defaults to the default rings + cards */
  metricIds?: string[];
};


export function formatMetricValue(metric: HealthMetric) {
  if (metric.value === null) {
    return '--';
  }

  const digits = getMetricDef(metric.id)?.fractionDigits ?? 0;
  return metric.value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}
