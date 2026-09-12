import { ExerciseType } from 'react-native-health-connect';

/** Names that read badly when derived from the Health Connect constant. */
const OVERRIDES: Record<string, string> = {
  OTHER_WORKOUT: 'Workout',
  BIKING: 'Cycling',
  BIKING_STATIONARY: 'Indoor cycling',
  RUNNING_TREADMILL: 'Treadmill run',
  SWIMMING_POOL: 'Pool swim',
  SWIMMING_OPEN_WATER: 'Open water swim',
  FOOTBALL_AMERICAN: 'American football',
  FOOTBALL_AUSTRALIAN: 'Australian football',
  STAIR_CLIMBING_MACHINE: 'Stair machine',
  HIGH_INTENSITY_INTERVAL_TRAINING: 'HIIT',
  FRISBEE_DISC: 'Frisbee',
  DUMBBELL_CURL_LEFT_ARM: 'Dumbbell curl (left)',
  DUMBBELL_CURL_RIGHT_ARM: 'Dumbbell curl (right)',
  DUMBBELL_TRICEPS_EXTENSION_LEFT_ARM: 'Triceps extension (left)',
  DUMBBELL_TRICEPS_EXTENSION_RIGHT_ARM: 'Triceps extension (right)',
  DUMBBELL_TRICEPS_EXTENSION_TWO_ARM: 'Triceps extension',
};

const NAMES = new Map<number, string>(
  Object.entries(ExerciseType).map(([key, code]) => {
    const words = key.toLowerCase().split('_');
    return [code, OVERRIDES[key] ?? words[0][0].toUpperCase() + words[0].slice(1) + (words.length > 1 ? ` ${words.slice(1).join(' ')}` : '')];
  }),
);

export function exerciseTypeName(code: number | undefined) {
  return (code !== undefined && NAMES.get(code)) || 'Workout';
}
