import { workoutScheduleSchema, type WorkoutSchedule } from './workout-schedule';
const KEY = 'openfit.workout-schedule.v1';
export async function loadWorkoutSchedule() {
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
  return raw ? workoutScheduleSchema.parse(JSON.parse(raw)) : null;
}
export async function saveWorkoutSchedule(schedule: WorkoutSchedule) {
  localStorage.setItem(KEY, JSON.stringify(workoutScheduleSchema.parse(schedule)));
}
