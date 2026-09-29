import { describe, expect, test } from 'bun:test';
import { readScheduleLibrary, upsertScheduleTemplate } from './schedule-library';
import { scheduleDays, scheduleEntryKind, scheduleLogParams, workoutScheduleSchema } from './workout-schedule';
import { exactScheduleMatch } from './workout-schedule-server';

const raw = { title: 'Weekly plan', sourceLanguage: 'Italian', warnings: [], entries: [
  { day: 'A', originalName: 'Leg extension', displayName: 'Leg extension', translatedName: 'Leg extension', prescription: '3x10', notes: '', exerciseId: 'leg-extension', confidence: 1, alternatives: [] },
  { day: 'B', originalName: 'Run/Bike', displayName: 'Run/Bike', translatedName: 'Run/Bike', prescription: '5 minutes', notes: '', exerciseId: null, confidence: 0, alternatives: [] },
] };
const plan = workoutScheduleSchema.parse(raw);
describe('reusable schedules', () => {
  test('migrates the previous single schedule without losing days or entries', () => {
    const migrated = readScheduleLibrary(null, JSON.stringify(raw));
    expect(migrated[0].schedule.entries).toHaveLength(2);
    expect(scheduleDays(migrated[0].schedule)).toEqual(['A', 'B']);
    expect(scheduleEntryKind(migrated[0].schedule.entries[1])).toBe('cardio');
  });
  test('keeps multiple templates and updates only the selected template', () => {
    let library = upsertScheduleTemplate([], 'first', plan);
    library = upsertScheduleTemplate(library, 'second', { ...plan, title: 'Second' });
    library = upsertScheduleTemplate(library, 'first', { ...plan, title: 'Edited' });
    expect(library.map(item => item.schedule.title)).toEqual(['Edited', 'Second']);
    expect(readScheduleLibrary(JSON.stringify(library), null)).toEqual(library);
  });
  test('an empty new library does not resurrect the deleted legacy schedule', () => {
    expect(readScheduleLibrary('[]', JSON.stringify(raw))).toEqual([]);
  });
  test('opens a workout with planned sets and reps without recording completion', () => {
    const before = JSON.stringify(plan);
    expect(scheduleLogParams(plan.entries[0], 'Rest 90 seconds')).toMatchObject({ exerciseId: 'leg-extension', plannedSets: '3', plannedReps: '10' });
    expect(scheduleLogParams(plan.entries[0], 'Rest 90 seconds').scheduleNotes).toContain('Rest 90 seconds');
    expect(JSON.stringify(plan)).toBe(before);
  });
  test('does not silently turn a rep range into an exact prescription', () => {
    expect(scheduleLogParams({ ...plan.entries[0], prescription: '4 × 8–10' })).toMatchObject({ plannedSets: '4' });
    expect(scheduleLogParams({ ...plan.entries[0], prescription: '4 × 8–10' }).plannedReps).toBeUndefined();
  });
  test('keeps unspecified posture and equipment unspecified', () => {
    expect(exactScheduleMatch('Leg curl', 'Gambe')).toBe('leg-curl');
    expect(exactScheduleMatch('Spinte piane', 'Petto')).toBe('flat-chest-press');
    expect(exactScheduleMatch('Alzate laterali', 'Spalle')).toBe('lateral-raise-unspecified');
  });
  test('uses the source muscle group for the ambiguous cable movement', () => {
    expect(exactScheduleMatch('Distensioni orizzontali cavo medio', 'Tricipiti')).toBe('horizontal-cable-triceps-extension');
    expect(exactScheduleMatch('Distensioni orizzontali cavo medio', 'Petto')).toBeNull();
  });
});
