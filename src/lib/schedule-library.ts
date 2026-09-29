import { z } from 'zod';
import { workoutScheduleSchema, type WorkoutSchedule } from './workout-schedule';

export const scheduleTemplateSchema = z.object({
  id: z.string().min(1),
  schedule: workoutScheduleSchema,
});
export const scheduleLibrarySchema = z.array(scheduleTemplateSchema).max(100);
export type ScheduleTemplate = z.infer<typeof scheduleTemplateSchema>;

export function readScheduleLibrary(raw: string | null, legacy: string | null): ScheduleTemplate[] {
  if (raw !== null) return scheduleLibrarySchema.parse(JSON.parse(raw));
  if (!legacy) return [];
  return [{ id: 'imported-schedule', schedule: workoutScheduleSchema.parse(JSON.parse(legacy)) }];
}

export function upsertScheduleTemplate(library: ScheduleTemplate[], id: string, schedule: WorkoutSchedule) {
  const template = scheduleTemplateSchema.parse({ id, schedule });
  return scheduleLibrarySchema.parse([template, ...library.filter(item => item.id !== id)]);
}
