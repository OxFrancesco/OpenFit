import { describe, expect, it } from 'bun:test';

import { EXERCISE_CATALOG, EXERCISE_MUSCLES } from './exercise-catalog.ts';
import {
  fromKilograms,
  isWorkoutLog,
  searchExercises,
  toKilograms,
  validateWorkoutInput,
  workoutVolumeKg,
} from './fitness-domain.ts';

describe('exercise catalog search', () => {
  it('contains a useful offline exercise library', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(70);
  });

  it('ranks exact exercise names ahead of related variants', () => {
    const results = searchExercises(EXERCISE_CATALOG, 'barbell bench press');
    expect(results[0]?.id).toBe('barbell-bench-press');
    expect(results.some((exercise) => exercise.id === 'close-grip-bench')).toBe(true);
  });

  it('matches aliases and muscle filters', () => {
    expect(searchExercises(EXERCISE_CATALOG, 'rdl')[0]?.id).toBe('romanian-deadlift');

    const cableBack = searchExercises(EXERCISE_CATALOG, 'cable', { muscle: 'Back' });
    expect(cableBack.map((exercise) => exercise.id)).toContain('seated-cable-row');
    expect(
      cableBack.every(
        (exercise) =>
          exercise.primaryMuscle === 'Back' || exercise.secondaryMuscles.includes('Back')
      )
    ).toBe(true);
  });

  it('offers a filter for every primary muscle in the catalog', () => {
    const primaryMuscles = new Set(EXERCISE_CATALOG.map((exercise) => exercise.primaryMuscle));
    expect(primaryMuscles.size).toBe(EXERCISE_MUSCLES.length);
    for (const muscle of primaryMuscles) expect(EXERCISE_MUSCLES).toContain(muscle);
  });
});

describe('workout values', () => {
  it('round-trips pounds and kilograms', () => {
    const kilograms = toKilograms(220, 'lb');
    expect(kilograms).toBeCloseTo(99.79, 2);
    expect(fromKilograms(kilograms, 'lb')).toBeCloseTo(220, 5);
  });

  it('calculates volume and validates sensible bounds', () => {
    expect(workoutVolumeKg({ sets: 4, reps: 8, weightKg: 80 })).toBe(2_560);
    expect(
      validateWorkoutInput({ sets: 4, reps: 8, weightKg: 80, enteredUnit: 'kg', notes: '' })
    ).toBeNull();
    expect(
      validateWorkoutInput({ sets: 0, reps: 8, weightKg: 80, enteredUnit: 'kg', notes: '' })
    ).toContain('Sets');
    expect(
      validateWorkoutInput({ sets: 4, reps: 8, weightKg: -1, enteredUnit: 'kg', notes: '' })
    ).toContain('Weight');
  });

  it('rejects malformed persisted workout entries', () => {
    const valid = {
      id: 'entry-1',
      exerciseId: 'barbell-bench-press',
      performedAt: '2026-07-14T18:00:00.000Z',
      sets: 4,
      reps: 8,
      weightKg: 80,
      enteredUnit: 'kg',
      notes: '',
    };

    expect(isWorkoutLog(valid)).toBe(true);
    expect(isWorkoutLog({ ...valid, performedAt: 'not-a-date' })).toBe(false);
    expect(isWorkoutLog({ ...valid, sets: -1 })).toBe(false);
    expect(isWorkoutLog({ ...valid, weightKg: Number.NaN })).toBe(false);
  });
});
