import { EXERCISE_CATALOG, getCatalogExercise } from '@/lib/exercise-catalog';
import {
  isWorkoutLog,
  searchExercises,
  type ExerciseFilters,
  type WorkoutLog,
  type WorkoutLogInput,
} from '@/lib/fitness-domain';

const WORKOUT_LOGS_KEY = 'openfit.fitness.workout-logs.v1';

function readLogs() {
  if (typeof localStorage === 'undefined') return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(WORKOUT_LOGS_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(isWorkoutLog).filter((log) => getCatalogExercise(log.exerciseId) !== null)
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

export async function searchExerciseCatalog(query: string, filters: ExerciseFilters = {}) {
  return searchExercises(EXERCISE_CATALOG, query, filters).slice(0, 100);
}

export async function getExerciseById(exerciseId: string) {
  return getCatalogExercise(exerciseId);
}

export async function listWorkoutLogs(limit = 100) {
  const logs = readLogs().sort((left, right) => right.performedAt.localeCompare(left.performedAt));
  return logs.slice(0, limit);
}

export async function listWorkoutLogsForExercise(exerciseId: string) {
  return readLogs()
    .filter((log) => log.exerciseId === exerciseId)
    .sort((left, right) => right.performedAt.localeCompare(left.performedAt));
}

export async function saveWorkoutLog(input: WorkoutLogInput) {
  const log: WorkoutLog = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
  };
  const next = [log, ...readLogs().filter((item) => item.id !== log.id)];
  writeLogs(next);
  return log;
}

export async function deleteWorkoutLog(logId: string) {
  writeLogs(readLogs().filter((log) => log.id !== logId));
}
