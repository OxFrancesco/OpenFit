import { readScheduleLibrary, upsertScheduleTemplate } from './schedule-library';
import type { WorkoutSchedule } from './workout-schedule';

const KEY = 'openfit.workout-schedules.v2';
const LEGACY_KEY = 'openfit.workout-schedule.v1';
export async function loadScheduleLibrary() {
  if (typeof localStorage === 'undefined') return [];
  return readScheduleLibrary(localStorage.getItem(KEY), localStorage.getItem(LEGACY_KEY));
}
export async function saveScheduleTemplate(id: string, schedule: WorkoutSchedule) {
  localStorage.setItem(KEY, JSON.stringify(upsertScheduleTemplate(await loadScheduleLibrary(), id, schedule)));
}
export async function deleteScheduleTemplate(id: string) {
  localStorage.setItem(KEY, JSON.stringify((await loadScheduleLibrary()).filter(item => item.id !== id)));
}
