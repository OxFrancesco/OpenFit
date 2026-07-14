import * as ExpoCrypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { EXERCISE_CATALOG } from '@/lib/exercise-catalog';
import {
  normalizeSearchText,
  searchExercises,
  type Exercise,
  type ExerciseFilters,
  type WorkoutLog,
  type WorkoutLogInput,
} from '@/lib/fitness-domain';

const DATABASE_NAME = 'openfit-fitness.db';
const DATABASE_VERSION = 2;

type ExerciseRow = { payload: string };

type WorkoutRow = {
  id: string;
  exercise_id: string;
  performed_at: string;
  sets: number;
  reps: number;
  weight_kg: number;
  entered_unit: WorkoutLog['enteredUnit'];
  notes: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function parseExercise(payload: string) {
  return JSON.parse(payload) as Exercise;
}

function mapWorkoutRow(row: WorkoutRow): WorkoutLog {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    performedAt: row.performed_at,
    sets: row.sets,
    reps: row.reps,
    weightKg: row.weight_kg,
    enteredUnit: row.entered_unit,
    notes: row.notes,
  };
}

async function openFitnessDatabase() {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < 1) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS exercise_catalog (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        primary_muscle TEXT NOT NULL,
        muscle_text TEXT NOT NULL,
        equipment TEXT NOT NULL,
        search_text TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workout_logs (
        id TEXT PRIMARY KEY NOT NULL,
        exercise_id TEXT NOT NULL,
        performed_at TEXT NOT NULL,
        sets INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        weight_kg REAL NOT NULL,
        entered_unit TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (exercise_id) REFERENCES exercise_catalog(id)
      );
      CREATE INDEX IF NOT EXISTS workout_logs_performed_at
        ON workout_logs(performed_at DESC);
      CREATE INDEX IF NOT EXISTS workout_logs_exercise
        ON workout_logs(exercise_id, performed_at DESC);
    `);
  }

  const catalogColumns = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(exercise_catalog)'
  );
  if (!catalogColumns.some((column) => column.name === 'is_active')) {
    await database.execAsync(
      'ALTER TABLE exercise_catalog ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1'
    );
  }

  await database.runAsync('UPDATE exercise_catalog SET is_active = 0');

  const statement = await database.prepareAsync(`
    INSERT INTO exercise_catalog
      (id, name, primary_muscle, muscle_text, equipment, search_text, is_active, payload)
    VALUES ($id, $name, $primaryMuscle, $muscleText, $equipment, $searchText, 1, $payload)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      primary_muscle = excluded.primary_muscle,
      muscle_text = excluded.muscle_text,
      equipment = excluded.equipment,
      search_text = excluded.search_text,
      is_active = 1,
      payload = excluded.payload
  `);

  try {
    for (const exercise of EXERCISE_CATALOG) {
      const searchable = [
        exercise.name,
        exercise.primaryMuscle,
        ...exercise.secondaryMuscles,
        exercise.equipment,
        exercise.category,
        ...exercise.aliases,
      ].join(' ');
      const muscles = [exercise.primaryMuscle, ...exercise.secondaryMuscles]
        .map(normalizeSearchText)
        .join('|');

      await statement.executeAsync({
        $id: exercise.id,
        $name: exercise.name,
        $primaryMuscle: normalizeSearchText(exercise.primaryMuscle),
        $muscleText: `|${muscles}|`,
        $equipment: normalizeSearchText(exercise.equipment),
        $searchText: normalizeSearchText(searchable),
        $payload: JSON.stringify(exercise),
      });
    }
  } finally {
    await statement.finalizeAsync();
  }

  await database.runAsync(`
    DELETE FROM exercise_catalog
    WHERE is_active = 0
      AND id NOT IN (SELECT DISTINCT exercise_id FROM workout_logs)
  `);

  if (currentVersion < DATABASE_VERSION) {
    await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  }
  return database;
}

function getDatabase() {
  databasePromise ??= openFitnessDatabase();
  return databasePromise;
}

export async function searchExerciseCatalog(
  query: string,
  filters: ExerciseFilters = {}
) {
  const database = await getDatabase();
  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const conditions: string[] = ['is_active = 1'];
  const parameters: string[] = [];

  for (const token of tokens) {
    conditions.push('search_text LIKE ?');
    parameters.push(`%${token}%`);
  }

  if (filters.muscle) {
    conditions.push('muscle_text LIKE ?');
    parameters.push(`%|${normalizeSearchText(filters.muscle)}|%`);
  }

  if (filters.equipment) {
    conditions.push('equipment = ?');
    parameters.push(normalizeSearchText(filters.equipment));
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const rows = await database.getAllAsync<ExerciseRow>(
    `SELECT payload FROM exercise_catalog ${where} ORDER BY name ASC LIMIT 100`,
    parameters
  );

  return searchExercises(rows.map((row) => parseExercise(row.payload)), query, filters);
}

export async function getExerciseById(exerciseId: string) {
  const database = await getDatabase();
  const row = await database.getFirstAsync<ExerciseRow>(
    'SELECT payload FROM exercise_catalog WHERE id = ?',
    exerciseId
  );
  return row ? parseExercise(row.payload) : null;
}

export async function listWorkoutLogs(limit = 100) {
  const database = await getDatabase();
  const rows = await database.getAllAsync<WorkoutRow>(
    `SELECT id, exercise_id, performed_at, sets, reps, weight_kg, entered_unit, notes
     FROM workout_logs
     ORDER BY performed_at DESC
     LIMIT ?`,
    limit
  );
  return rows.map(mapWorkoutRow);
}

export async function listWorkoutLogsForExercise(exerciseId: string) {
  const database = await getDatabase();
  const rows = await database.getAllAsync<WorkoutRow>(
    `SELECT id, exercise_id, performed_at, sets, reps, weight_kg, entered_unit, notes
     FROM workout_logs
     WHERE exercise_id = ?
     ORDER BY performed_at DESC`,
    exerciseId
  );
  return rows.map(mapWorkoutRow);
}

export async function saveWorkoutLog(input: WorkoutLogInput) {
  const database = await getDatabase();
  const log: WorkoutLog = {
    ...input,
    id: input.id ?? ExpoCrypto.randomUUID(),
  };

  await database.runAsync(
    `INSERT OR REPLACE INTO workout_logs
      (id, exercise_id, performed_at, sets, reps, weight_kg, entered_unit, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.exerciseId,
      log.performedAt,
      log.sets,
      log.reps,
      log.weightKg,
      log.enteredUnit,
      log.notes,
      new Date().toISOString(),
    ]
  );

  return log;
}

export async function deleteWorkoutLog(logId: string) {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM workout_logs WHERE id = ?', logId);
}
