import { z } from 'zod';

export const scheduleEntrySchema = z.object({
  day: z.string().max(100),
  originalName: z.string().min(1).max(200),
  displayName: z.string().min(1).max(200),
  translatedName: z.string().min(1).max(200),
  prescription: z.string().max(600),
  notes: z.string().max(600),
});
export const extractedScheduleSchema = z.object({
  title: z.string().min(1).max(160),
  sourceLanguage: z.string().max(80),
  entries: z.array(scheduleEntrySchema).min(1).max(60),
  warnings: z.array(z.string().max(300)).max(20),
});
export const matchedEntrySchema = scheduleEntrySchema.extend({
  exerciseId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.object({ exerciseId: z.string(), probability: z.number().min(0).max(1) })).max(3),
});
export const workoutScheduleSchema = extractedScheduleSchema.extend({ entries: z.array(matchedEntrySchema).min(1).max(60) });
export type WorkoutSchedule = z.infer<typeof workoutScheduleSchema>;
export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;
export const MAX_SCHEDULE_BYTES = 8 * 1024 * 1024;
export const scheduleInputSchema = z.object({
  text: z.string().max(20_000).default(''),
  language: z.string().trim().min(2).max(80).default('English'),
  attachment: z.object({
    name: z.string().min(1).max(180),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    data: z.string().min(4).max(Math.ceil(MAX_SCHEDULE_BYTES / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  }).optional(),
}).refine(value => value.text.trim() || value.attachment, 'Add a schedule photo, PDF, or text.');
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;
