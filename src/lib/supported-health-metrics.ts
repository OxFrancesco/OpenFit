import { Platform } from 'react-native';
const COMMON = new Set([
  'steps', 'active-energy-burned', 'total-calories', 'active-minutes', 'distance', 'floors',
  'heart-rate', 'daily-resting-heart-rate', 'weight', 'nutrition-log', 'hydration-log',
  'body-fat', 'core-body-temperature', 'blood-glucose', 'daily-oxygen-saturation',
  'daily-respiratory-rate', 'daily-vo2-max', 'daily-heart-rate-variability', 'sleep',
]);
export function supportsHealthMetric(id: string) {
  return COMMON.has(id) || (Platform.OS === 'android' && id === 'altitude');
}
