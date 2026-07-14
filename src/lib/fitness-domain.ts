export type ExerciseCategory = 'strength' | 'cardio' | 'mobility';

export type Exercise = {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  category: ExerciseCategory;
  aliases: string[];
};

export type ExerciseFilters = {
  muscle?: string | null;
  equipment?: string | null;
};

export type WeightUnit = 'kg' | 'lb';

export type WorkoutLog = {
  id: string;
  exerciseId: string;
  performedAt: string;
  sets: number;
  reps: number;
  weightKg: number;
  enteredUnit: WeightUnit;
  notes: string;
};

export type WorkoutLogInput = Omit<WorkoutLog, 'id'> & { id?: string };

const POUNDS_PER_KILOGRAM = 2.2046226218;

export function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function exerciseSearchText(exercise: Exercise) {
  return normalizeSearchText(
    [
      exercise.name,
      exercise.primaryMuscle,
      ...exercise.secondaryMuscles,
      exercise.equipment,
      exercise.category,
      ...exercise.aliases,
    ].join(' ')
  );
}

export function searchExercises(
  exercises: readonly Exercise[],
  query: string,
  filters: ExerciseFilters = {}
) {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const muscle = normalizeSearchText(filters.muscle ?? '');
  const equipment = normalizeSearchText(filters.equipment ?? '');

  return exercises
    .filter((exercise) => {
      const muscleMatches =
        !muscle ||
        normalizeSearchText(exercise.primaryMuscle) === muscle ||
        exercise.secondaryMuscles.some((item) => normalizeSearchText(item) === muscle);
      const equipmentMatches =
        !equipment || normalizeSearchText(exercise.equipment) === equipment;
      const haystack = exerciseSearchText(exercise);

      return muscleMatches && equipmentMatches && tokens.every((token) => haystack.includes(token));
    })
    .map((exercise) => {
      const name = normalizeSearchText(exercise.name);
      const alias = exercise.aliases.map(normalizeSearchText);
      let score = 4;

      if (!normalizedQuery) score = 3;
      else if (name === normalizedQuery || alias.includes(normalizedQuery)) score = 0;
      else if (name.startsWith(normalizedQuery) || alias.some((item) => item.startsWith(normalizedQuery))) {
        score = 1;
      } else if (name.includes(normalizedQuery)) score = 2;

      return { exercise, score };
    })
    .sort((left, right) => left.score - right.score || left.exercise.name.localeCompare(right.exercise.name))
    .map(({ exercise }) => exercise);
}

export function toKilograms(value: number, unit: WeightUnit) {
  return unit === 'lb' ? value / POUNDS_PER_KILOGRAM : value;
}

export function fromKilograms(value: number, unit: WeightUnit) {
  return unit === 'lb' ? value * POUNDS_PER_KILOGRAM : value;
}

export function formatWeight(weightKg: number, unit: WeightUnit) {
  const value = fromKilograms(weightKg, unit);
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} ${unit}`;
}

export function workoutVolumeKg(log: Pick<WorkoutLog, 'sets' | 'reps' | 'weightKg'>) {
  return log.sets * log.reps * log.weightKg;
}

export function validateWorkoutInput(input: Omit<WorkoutLogInput, 'exerciseId' | 'performedAt'>) {
  if (!Number.isInteger(input.sets) || input.sets < 1 || input.sets > 99) {
    return 'Sets must be a whole number from 1 to 99.';
  }

  if (!Number.isInteger(input.reps) || input.reps < 1 || input.reps > 999) {
    return 'Reps must be a whole number from 1 to 999.';
  }

  if (!Number.isFinite(input.weightKg) || input.weightKg < 0 || input.weightKg > 1_000) {
    return 'Weight must be between 0 and 1,000 kg.';
  }

  if (input.notes.length > 500) {
    return 'Notes must be 500 characters or fewer.';
  }

  return null;
}

export function personalBestKg(logs: readonly WorkoutLog[], exerciseId: string) {
  return logs.reduce(
    (best, log) => (log.exerciseId === exerciseId ? Math.max(best, log.weightKg) : best),
    0
  );
}

export function isWorkoutLog(value: unknown): value is WorkoutLog {
  if (!value || typeof value !== 'object') return false;
  const log = value as Partial<WorkoutLog>;
  return (
    typeof log.id === 'string' &&
    log.id.trim().length > 0 &&
    typeof log.exerciseId === 'string' &&
    log.exerciseId.trim().length > 0 &&
    typeof log.performedAt === 'string' &&
    Number.isFinite(Date.parse(log.performedAt)) &&
    typeof log.sets === 'number' &&
    Number.isInteger(log.sets) &&
    log.sets >= 1 &&
    log.sets <= 99 &&
    typeof log.reps === 'number' &&
    Number.isInteger(log.reps) &&
    log.reps >= 1 &&
    log.reps <= 999 &&
    typeof log.weightKg === 'number' &&
    Number.isFinite(log.weightKg) &&
    log.weightKg >= 0 &&
    log.weightKg <= 1_000 &&
    (log.enteredUnit === 'kg' || log.enteredUnit === 'lb') &&
    typeof log.notes === 'string' &&
    log.notes.length <= 500
  );
}
