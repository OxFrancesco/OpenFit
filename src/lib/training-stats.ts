import { localDate } from '@/lib/device-health-core';
import {
  estimatedOneRepMaxKg,
  workoutVolumeKg,
  type ScheduleCheckin,
  type WorkoutLog,
} from '@/lib/fitness-domain';

/** Weeks start on Monday. Gym plans are weekly, so streaks count weeks, not days. */
const WEEK_STARTS_ON = 1;

export const dayKey = localDate;

export function startOfLocalDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date) {
  const start = startOfLocalDay(date);
  return addDays(start, -((start.getDay() - WEEK_STARTS_ON + 7) % 7));
}

/** Parses a `YYYY-MM-DD` key as local noon, which is stable across DST changes. */
export function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00`);
}

export function activeDayKeys(performedAt: readonly string[]) {
  return new Set(performedAt.map((value) => dayKey(new Date(value))));
}

export type WeekStreak = {
  /** Consecutive weeks that met the goal. The current week counts once it meets it. */
  current: number;
  best: number;
  thisWeek: number;
  goal: number;
};

export function weekStreak(activeDays: ReadonlySet<string>, goal: number, now = new Date()): WeekStreak {
  const target = Math.max(1, Math.min(7, Math.round(goal)));
  const thisWeekStart = startOfWeek(now);
  const counts = new Map<string, number>();
  for (const key of activeDays) {
    const week = dayKey(startOfWeek(dateFromKey(key)));
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  const met = (weekStart: Date) => (counts.get(dayKey(weekStart)) ?? 0) >= target;
  const thisWeek = counts.get(dayKey(thisWeekStart)) ?? 0;

  let current = met(thisWeekStart) ? 1 : 0;
  for (let week = addDays(thisWeekStart, -7); met(week); week = addDays(week, -7)) current += 1;

  let best = current;
  const weeks = [...counts.keys()].sort();
  if (weeks.length) {
    let run = 0;
    for (let week = dateFromKey(weeks[0]); week <= thisWeekStart; week = addDays(week, 7)) {
      const start = startOfWeek(week);
      run = met(start) ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  return { current, best, thisWeek, goal: target };
}

export type DaySummary = {
  date: string;
  logs: WorkoutLog[];
  checkins: ScheduleCheckin[];
  volumeKg: number;
  sets: number;
  scheduleDays: string[];
};

export function summarizeDays(logs: readonly WorkoutLog[], checkins: readonly ScheduleCheckin[]) {
  const days = new Map<string, DaySummary>();
  const day = (performedAt: string) => {
    const key = dayKey(new Date(performedAt));
    let summary = days.get(key);
    if (!summary) {
      summary = { date: key, logs: [], checkins: [], volumeKg: 0, sets: 0, scheduleDays: [] };
      days.set(key, summary);
    }
    return summary;
  };
  const addScheduleDay = (summary: DaySummary, name: string | undefined) => {
    if (name && !summary.scheduleDays.includes(name)) summary.scheduleDays.push(name);
  };
  for (const log of logs) {
    const summary = day(log.performedAt);
    summary.logs.push(log);
    summary.volumeKg += workoutVolumeKg(log);
    summary.sets += log.sets;
    addScheduleDay(summary, log.schedule?.scheduleDay);
  }
  for (const checkin of checkins) {
    const summary = day(checkin.performedAt);
    summary.checkins.push(checkin);
    addScheduleDay(summary, checkin.schedule.scheduleDay);
  }
  for (const summary of days.values()) {
    summary.logs.sort((left, right) => left.performedAt.localeCompare(right.performedAt));
    summary.checkins.sort((left, right) => left.performedAt.localeCompare(right.performedAt));
  }
  return days;
}

export type HeatmapCell = {
  date: string;
  /** 0 = nothing logged, 1–4 = quartile of session size against the busiest day shown. */
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
  today: boolean;
};

/** Columns of Monday-first weeks ending with the current week. */
export function heatmapWeeks(
  days: ReadonlyMap<string, Pick<DaySummary, 'sets' | 'checkins'>>,
  weeks: number,
  now = new Date()
) {
  const today = dayKey(now);
  const firstWeek = addDays(startOfWeek(now), -7 * (Math.max(1, weeks) - 1));
  const size = (key: string) => {
    const summary = days.get(key);
    return summary ? summary.sets + summary.checkins.length : 0;
  };
  const columns: { weekStart: string; cells: HeatmapCell[] }[] = [];
  let busiest = 0;
  for (let week = 0; week < weeks; week += 1) {
    const weekStart = addDays(firstWeek, week * 7);
    const cells: HeatmapCell[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const key = dayKey(addDays(weekStart, offset));
      busiest = Math.max(busiest, size(key));
      cells.push({ date: key, level: 0, future: key > today, today: key === today });
    }
    columns.push({ weekStart: dayKey(weekStart), cells });
  }
  for (const column of columns) {
    for (const cell of column.cells) {
      const value = size(cell.date);
      cell.level = value <= 0 ? 0 : (Math.min(4, Math.max(1, Math.ceil((value / Math.max(1, busiest)) * 4))) as HeatmapCell['level']);
    }
  }
  return columns;
}

/**
 * Logs that lifted more than every earlier log of the same exercise. First sessions don't count.
 * `priorBestKg` holds bests from before `logs`, so a partial window doesn't invent records.
 */
export function personalRecordLogIds(logs: readonly WorkoutLog[], priorBestKg: ReadonlyMap<string, number> = new Map()) {
  const best = new Map(priorBestKg);
  const records = new Set<string>();
  for (const log of [...logs].sort((left, right) => left.performedAt.localeCompare(right.performedAt))) {
    const previous = best.get(log.exerciseId);
    if (previous !== undefined && log.weightKg > previous) records.add(log.id);
    best.set(log.exerciseId, Math.max(previous ?? 0, log.weightKg));
  }
  return records;
}

export type ExerciseProgress = {
  exerciseId: string;
  /** One point per training day, oldest first. */
  sessions: { date: string; topKg: number; oneRepMaxKg: number }[];
  bestKg: number;
  latestKg: number;
  unit: WorkoutLog['enteredUnit'];
};

export function exerciseProgress(logs: readonly WorkoutLog[], priorBestKg: ReadonlyMap<string, number> = new Map()) {
  const byExercise = new Map<string, WorkoutLog[]>();
  for (const log of logs) {
    const list = byExercise.get(log.exerciseId) ?? [];
    list.push(log);
    byExercise.set(log.exerciseId, list);
  }
  return [...byExercise.entries()]
    .map(([exerciseId, items]): ExerciseProgress => {
      const ordered = [...items].sort((left, right) => left.performedAt.localeCompare(right.performedAt));
      const sessions = new Map<string, { date: string; topKg: number; oneRepMaxKg: number }>();
      for (const log of ordered) {
        const date = dayKey(new Date(log.performedAt));
        const session = sessions.get(date) ?? { date, topKg: 0, oneRepMaxKg: 0 };
        session.topKg = Math.max(session.topKg, log.weightKg);
        session.oneRepMaxKg = Math.max(session.oneRepMaxKg, estimatedOneRepMaxKg(log.weightKg, log.reps));
        sessions.set(date, session);
      }
      const points = [...sessions.values()];
      return {
        exerciseId,
        sessions: points,
        bestKg: Math.max(priorBestKg.get(exerciseId) ?? 0, ...points.map((point) => point.topKg)),
        latestKg: points[points.length - 1]?.topKg ?? 0,
        unit: ordered[ordered.length - 1]?.enteredUnit ?? 'kg',
      };
    })
    .sort((left, right) => right.sessions.length - left.sessions.length);
}
