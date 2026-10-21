import { EXERCISE_CATALOG, getCatalogExercise } from '@/lib/exercise-catalog';
import {
  isScheduleCheckin,
  isWorkoutLog,
  searchExercises,
  type ExerciseFilters,
  type ScheduleCheckin,
  type ScheduleCheckinInput,
  type WorkoutLog,
  type WorkoutLogInput,
} from '@/lib/fitness-domain';

const WORKOUT_LOGS_KEY = 'openfit.fitness.workout-logs.v1';
const CHECKINS_KEY = 'openfit.fitness.schedule-checkins.v1';

function readLogs() {
  if (typeof localStorage === 'undefined') return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(WORKOUT_LOGS_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed)
      ? parsed
          .filter(isWorkoutLog)
          .filter((log) => getCatalogExercise(log.exerciseId) !== null)
          .map((log) => ({ ...log, schedule: log.schedule ?? null }))
      : [];
  } catch {
    return [];
  }
}

function writeLogs(logs: readonly WorkoutLog[]) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(WORKOUT_LOGS_KEY, JSON.stringify(logs));
  }
}

function readCheckins() {
  if (typeof localStorage === 'undefined') return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(CHECKINS_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isScheduleCheckin) : [];
  } catch {
    return [];
  }
}

function writeCheckins(checkins: readonly ScheduleCheckin[]) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CHECKINS_KEY, JSON.stringify(checkins));
  }
}

const newestFirst = (left: { performedAt: string }, right: { performedAt: string }) =>
  right.performedAt.localeCompare(left.performedAt);

export async function searchExerciseCatalog(query: string, filters: ExerciseFilters = {}) {
  return searchExercises(EXERCISE_CATALOG, query, filters).slice(0, 100);
}

export async function getExerciseById(exerciseId: string) {
  return getCatalogExercise(exerciseId);
}

export async function listWorkoutLogs(limit: number | null = 100) {
  const logs = readLogs().sort(newestFirst);
  return limit === null ? logs : logs.slice(0, limit);
}

export async function listWorkoutLogsBetween(start: string, end: string) {
  return readLogs()
    .filter((log) => log.performedAt >= start && log.performedAt < end)
    .sort(newestFirst);
}

export async function listWorkoutLogsForExercise(exerciseId: string) {
  return readLogs()
    .filter((log) => log.exerciseId === exerciseId)
    .sort(newestFirst);
}

export async function getWorkoutLog(logId: string) {
  return readLogs().find((log) => log.id === logId) ?? null;
}

/** Heaviest weight per exercise logged before `endIso`. */
export async function bestWeightsBefore(endIso: string) {
  const best = new Map<string, number>();
  for (const log of readLogs()) {
    if (log.performedAt < endIso) best.set(log.exerciseId, Math.max(best.get(log.exerciseId) ?? 0, log.weightKg));
  }
  return best;
}

export async function summarizeExercises(exerciseIds: readonly string[]) {
  const ids = new Set(exerciseIds);
  const latest = new Map<string, WorkoutLog>();
  const bestKg = new Map<string, number>();
  for (const log of readLogs().sort(newestFirst)) {
    if (!ids.has(log.exerciseId)) continue;
    if (!latest.has(log.exerciseId)) latest.set(log.exerciseId, log);
    bestKg.set(log.exerciseId, Math.max(bestKg.get(log.exerciseId) ?? 0, log.weightKg));
  }
  return { latest, bestKg };
}

export async function saveWorkoutLog(input: WorkoutLogInput) {
  return (await saveWorkoutLogs([input]))[0];
}

export async function saveWorkoutLogs(inputs: readonly WorkoutLogInput[]) {
  const saved = inputs.map(
    (input): WorkoutLog => ({ ...input, schedule: input.schedule ?? null, id: input.id ?? crypto.randomUUID() })
  );
  const ids = new Set(saved.map((log) => log.id));
  writeLogs([...saved, ...readLogs().filter((item) => !ids.has(item.id))]);
  return saved;
}

export async function deleteWorkoutLog(logId: string) {
  writeLogs(readLogs().filter((log) => log.id !== logId));
}

export async function listCheckinsBetween(start: string, end: string) {
  return readCheckins()
    .filter((checkin) => checkin.performedAt >= start && checkin.performedAt < end)
    .sort(newestFirst);
}

export async function saveCheckin(input: ScheduleCheckinInput) {
  const checkin: ScheduleCheckin = { ...input, id: input.id ?? crypto.randomUUID() };
  writeCheckins([checkin, ...readCheckins().filter((item) => item.id !== checkin.id)]);
  return checkin;
}

export async function deleteCheckin(checkinId: string) {
  writeCheckins(readCheckins().filter((checkin) => checkin.id !== checkinId));
}

export async function listActivityTimes(start: string) {
  return [...readLogs(), ...readCheckins()]
    .map((item) => item.performedAt)
    .filter((performedAt) => performedAt >= start);
}

export async function latestScheduleActivity(scheduleId: string) {
  const latest = [
    ...readLogs().flatMap((log) =>
      log.schedule?.scheduleId === scheduleId
        ? [{ scheduleDay: log.schedule.scheduleDay, performedAt: log.performedAt }]
        : []
    ),
    ...readCheckins().flatMap((checkin) =>
      checkin.schedule.scheduleId === scheduleId
        ? [{ scheduleDay: checkin.schedule.scheduleDay, performedAt: checkin.performedAt }]
        : []
    ),
  ].sort(newestFirst)[0];
  return latest ?? null;
}
