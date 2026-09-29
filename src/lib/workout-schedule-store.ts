import { File, Paths } from 'expo-file-system';
import { readScheduleLibrary, upsertScheduleTemplate } from './schedule-library';
import type { WorkoutSchedule } from './workout-schedule';

const libraryFile = () => new File(Paths.document, 'workout-schedules-v2.json');
export async function loadScheduleLibrary() {
  const file = libraryFile();
  const legacy = new File(Paths.document, 'workout-schedule.json');
  return readScheduleLibrary(file.exists ? await file.text() : null, !file.exists && legacy.exists ? await legacy.text() : null);
}
export async function saveScheduleTemplate(id: string, schedule: WorkoutSchedule) {
  libraryFile().write(JSON.stringify(upsertScheduleTemplate(await loadScheduleLibrary(), id, schedule)));
}
export async function deleteScheduleTemplate(id: string) {
  libraryFile().write(JSON.stringify((await loadScheduleLibrary()).filter(item => item.id !== id)));
}
