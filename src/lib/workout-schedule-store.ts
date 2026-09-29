import { File, Paths } from 'expo-file-system';
import { workoutScheduleSchema, type WorkoutSchedule } from './workout-schedule';

const scheduleFile = () => new File(Paths.document, 'workout-schedule.json');
export async function loadWorkoutSchedule() {
  const file = scheduleFile();
  return file.exists ? workoutScheduleSchema.parse(JSON.parse(await file.text())) : null;
}
export async function saveWorkoutSchedule(schedule: WorkoutSchedule) {
  scheduleFile().write(JSON.stringify(workoutScheduleSchema.parse(schedule)));
}
