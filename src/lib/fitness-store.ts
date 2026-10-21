import * as ExpoCrypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { EXERCISE_CATALOG } from '@/lib/exercise-catalog';
import {
  normalizeSearchText,
  searchExercises,
  type Exercise,
  type ExerciseFilters,
  type ScheduleCheckin,
  type ScheduleCheckinInput,
  type WorkoutLog,
  type WorkoutLogInput,
} from '@/lib/fitness-domain';

const DATABASE_NAME = 'openfit-fitness.db';
const DATABASE_VERSION = 3;
const CATALOG_FINGERPRINT = catalogFingerprint();

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
  schedule_id: string | null;
  schedule_day: string | null;
  entry_key: string | null;
};

type CheckinRow = {
  id: string;
  schedule_id: string;
  schedule_day: string;
  entry_key: string;
  name: string;
  kind: ScheduleCheckin['kind'];
  performed_at: string;
};

const WORKOUT_COLUMNS =
  'id, exercise_id, performed_at, sets, reps, weight_kg, entered_unit, notes, schedule_id, schedule_day, entry_key';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** FNV-1a over the bundled catalog, so the seed only reruns when the catalog changes. */
function catalogFingerprint() {
  const text = JSON.stringify(EXERCISE_CATALOG);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${EXERCISE_CATALOG.length}:${(hash >>> 0).toString(16)}`;
}

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
    schedule:
      row.schedule_id && row.entry_key
        ? { scheduleId: row.schedule_id, scheduleDay: row.schedule_day ?? '', entryKey: row.entry_key }
        : null,
  };
}

function mapCheckinRow(row: CheckinRow): ScheduleCheckin {
  return {
    id: row.id,
    schedule: { scheduleId: row.schedule_id, scheduleDay: row.schedule_day, entryKey: row.entry_key },
    name: row.name,
    kind: row.kind,
    performedAt: row.performed_at,
  };
}

async function seedExerciseCatalog(database: SQLite.SQLiteDatabase) {
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
}

async function openFitnessDatabase() {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  // Writes from the app, the widget task and exclusive transactions wait for each other instead of failing.
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
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

  if (currentVersion < 3) {
    const logColumns = await database.getAllAsync<{ name: string }>(
      'PRAGMA table_info(workout_logs)'
    );
    for (const column of ['schedule_id', 'schedule_day', 'entry_key']) {
      if (!logColumns.some((item) => item.name === column)) {
        await database.execAsync(`ALTER TABLE workout_logs ADD COLUMN ${column} TEXT`);
      }
    }
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS workout_logs_schedule
        ON workout_logs(schedule_id, performed_at DESC);
      CREATE TABLE IF NOT EXISTS schedule_checkins (
        id TEXT PRIMARY KEY NOT NULL,
        schedule_id TEXT NOT NULL,
        schedule_day TEXT NOT NULL,
        entry_key TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        performed_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS schedule_checkins_performed_at
        ON schedule_checkins(performed_at DESC);
      CREATE INDEX IF NOT EXISTS schedule_checkins_schedule
        ON schedule_checkins(schedule_id, performed_at DESC);
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }

  const seeded = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'catalog_fingerprint'"
  );
  if (seeded?.value !== CATALOG_FINGERPRINT) {
    await seedExerciseCatalog(database);
    await database.runAsync(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('catalog_fingerprint', ?)",
      CATALOG_FINGERPRINT
    );
  }

  if (currentVersion < DATABASE_VERSION) {
    await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  }
  return database;
}

function getDatabase() {
  databasePromise ??= openFitnessDatabase().catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
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

export async function listWorkoutLogs(limit: number | null = 100) {
  const database = await getDatabase();
  const rows = await database.getAllAsync<WorkoutRow>(
    `SELECT ${WORKOUT_COLUMNS}
     FROM workout_logs
     ORDER BY performed_at DESC
     LIMIT ?`,
    limit ?? -1
  );
  return rows.map(mapWorkoutRow);
}

/** Logs with `start <= performedAt < end`, newest first. Bounds are ISO strings. */
export async function listWorkoutLogsBetween(start: string, end: string) {
  const database = await getDatabase();
  const rows = await database.getAllAsync<WorkoutRow>(
    `SELECT ${WORKOUT_COLUMNS}
     FROM workout_logs
     WHERE performed_at >= ? AND performed_at < ?
     ORDER BY performed_at DESC`,
    [start, end]
  );
  return rows.map(mapWorkoutRow);
}

export async function listWorkoutLogsForExercise(exerciseId: string) {
  const database = await getDatabase();
  const rows = await database.getAllAsync<WorkoutRow>(
    `SELECT ${WORKOUT_COLUMNS}
     FROM workout_logs
     WHERE exercise_id = ?
     ORDER BY performed_at DESC`,
    exerciseId
  );
  return rows.map(mapWorkoutRow);
}

export async function getWorkoutLog(logId: string) {
  const database = await getDatabase();
  const row = await database.getFirstAsync<WorkoutRow>(
    `SELECT ${WORKOUT_COLUMNS} FROM workout_logs WHERE id = ?`,
    logId
  );
  return row ? mapWorkoutRow(row) : null;
}

/** Most recent log and heaviest weight for each exercise. */
/** Heaviest weight per exercise logged before `endIso`. */
export async function bestWeightsBefore(endIso: string) {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ exercise_id: string; best: number }>(
    `SELECT exercise_id, MAX(weight_kg) AS best
     FROM workout_logs
     WHERE performed_at < ?
     GROUP BY exercise_id`,
    endIso
  );
  return new Map(rows.map((row) => [row.exercise_id, row.best]));
}

export async function summarizeExercises(exerciseIds: readonly string[]) {
  const ids = [...new Set(exerciseIds)];
  const latest = new Map<string, WorkoutLog>();
  const bestKg = new Map<string, number>();
  if (!ids.length) return { latest, bestKg };

  const database = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await database.getAllAsync<WorkoutRow>(
    `SELECT ${WORKOUT_COLUMNS}
     FROM workout_logs AS log
     WHERE exercise_id IN (${placeholders})
       AND performed_at = (
         SELECT MAX(performed_at) FROM workout_logs WHERE exercise_id = log.exercise_id
       )`,
    ids
  );
  for (const row of rows) latest.set(row.exercise_id, mapWorkoutRow(row));

  const bests = await database.getAllAsync<{ exercise_id: string; best: number }>(
    `SELECT exercise_id, MAX(weight_kg) AS best
     FROM workout_logs
     WHERE exercise_id IN (${placeholders})
     GROUP BY exercise_id`,
    ids
  );
  for (const row of bests) bestKg.set(row.exercise_id, row.best);
  return { latest, bestKg };
}

async function insertWorkoutLog(database: SQLite.SQLiteDatabase, input: WorkoutLogInput) {
  const log: WorkoutLog = {
    ...input,
    schedule: input.schedule ?? null,
    id: input.id ?? ExpoCrypto.randomUUID(),
  };

  await database.runAsync(
    `INSERT INTO workout_logs
      (id, exercise_id, performed_at, sets, reps, weight_kg, entered_unit, notes, created_at,
       schedule_id, schedule_day, entry_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       exercise_id = excluded.exercise_id, performed_at = excluded.performed_at,
       sets = excluded.sets, reps = excluded.reps, weight_kg = excluded.weight_kg,
       entered_unit = excluded.entered_unit, notes = excluded.notes,
       schedule_id = excluded.schedule_id, schedule_day = excluded.schedule_day,
       entry_key = excluded.entry_key`,
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
      log.schedule?.scheduleId ?? null,
      log.schedule?.scheduleDay ?? null,
      log.schedule?.entryKey ?? null,
    ]
  );

  return log;
}

export async function saveWorkoutLog(input: WorkoutLogInput) {
  return insertWorkoutLog(await getDatabase(), input);
}

/** Saves every log or none of them. */
export async function saveWorkoutLogs(inputs: readonly WorkoutLogInput[]) {
  const database = await getDatabase();
  const saved: WorkoutLog[] = [];
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync('PRAGMA busy_timeout = 5000;');
    for (const input of inputs) saved.push(await insertWorkoutLog(transaction, input));
  });
  return saved;
}

export async function deleteWorkoutLog(logId: string) {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM workout_logs WHERE id = ?', logId);
}

/** Check-ins with `start <= performedAt < end`, newest first. */
export async function listCheckinsBetween(start: string, end: string) {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CheckinRow>(
    `SELECT id, schedule_id, schedule_day, entry_key, name, kind, performed_at
     FROM schedule_checkins
     WHERE performed_at >= ? AND performed_at < ?
     ORDER BY performed_at DESC`,
    [start, end]
  );
  return rows.map(mapCheckinRow);
}

export async function saveCheckin(input: ScheduleCheckinInput) {
  const database = await getDatabase();
  const checkin: ScheduleCheckin = { ...input, id: input.id ?? ExpoCrypto.randomUUID() };
  await database.runAsync(
    `INSERT OR REPLACE INTO schedule_checkins
      (id, schedule_id, schedule_day, entry_key, name, kind, performed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      checkin.id,
      checkin.schedule.scheduleId,
      checkin.schedule.scheduleDay,
      checkin.schedule.entryKey,
      checkin.name,
      checkin.kind,
      checkin.performedAt,
      new Date().toISOString(),
    ]
  );
  return checkin;
}

export async function deleteCheckin(checkinId: string) {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM schedule_checkins WHERE id = ?', checkinId);
}

/** Timestamps of every log and check-in since `start`, for streaks and the calendar. */
export async function listActivityTimes(start: string) {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ performed_at: string }>(
    `SELECT performed_at FROM workout_logs WHERE performed_at >= ?
     UNION ALL
     SELECT performed_at FROM schedule_checkins WHERE performed_at >= ?`,
    [start, start]
  );
  return rows.map((row) => row.performed_at);
}

/** The newest schedule day trained for a schedule, used to pick the next day in rotation. */
export async function latestScheduleActivity(scheduleId: string) {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ schedule_day: string; performed_at: string }>(
    `SELECT schedule_day, performed_at FROM (
       SELECT schedule_day, performed_at FROM workout_logs
       WHERE schedule_id = ? AND schedule_day IS NOT NULL
       UNION ALL
       SELECT schedule_day, performed_at FROM schedule_checkins WHERE schedule_id = ?
     )
     ORDER BY performed_at DESC
     LIMIT 1`,
    [scheduleId, scheduleId]
  );
  return row ? { scheduleDay: row.schedule_day, performedAt: row.performed_at } : null;
}
