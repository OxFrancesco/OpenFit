import type {
  Exercise,
  ScheduleCheckin,
  WeightUnit,
  WorkoutLog,
} from '@/lib/fitness-domain';
import { toKilograms } from '@/lib/fitness-domain';
import type { ScheduleTemplate } from '@/lib/schedule-library';
import {
  scheduleDays,
  scheduleEntryKind,
  type MatchedScheduleEntry,
  type WorkoutSchedule,
} from '@/lib/workout-schedule';

const fold = (value: string) =>
  value.toLocaleLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Weekday names and abbreviations in the languages schedules are imported in. Index = Date#getDay(). */
const WEEKDAY_WORDS: readonly string[][] = [
  ['sunday', 'sun', 'domenica', 'dom', 'domingo', 'dimanche', 'sonntag'],
  ['monday', 'mon', 'lunedi', 'lun', 'lunes', 'lundi', 'montag', 'segunda'],
  ['tuesday', 'tue', 'tues', 'martedi', 'mar', 'martes', 'mardi', 'dienstag', 'terca'],
  ['wednesday', 'wed', 'mercoledi', 'mer', 'miercoles', 'mercredi', 'mittwoch', 'quarta'],
  ['thursday', 'thu', 'thur', 'thurs', 'giovedi', 'gio', 'jueves', 'jeudi', 'donnerstag', 'quinta'],
  ['friday', 'fri', 'venerdi', 'ven', 'viernes', 'vendredi', 'freitag', 'sexta'],
  ['saturday', 'sat', 'sabato', 'sab', 'sabado', 'samedi', 'samstag'],
];

/** Weekdays named in a schedule day label, e.g. "Lunedì e Giovedì" → [1, 4]. */
export function weekdaysOf(day: string) {
  const words = new Set(fold(day).split(/[^a-z]+/).filter(Boolean));
  return WEEKDAY_WORDS.flatMap((names, weekday) => (names.some((name) => words.has(name)) ? [weekday] : []));
}

export type PlanCadence = 'weekday' | 'rotation';

/** Weekday plans name a weekday on every day and never share one; anything else rotates A → B → C. */
export function planCadence(schedule: WorkoutSchedule): PlanCadence {
  const seen = new Set<number>();
  for (const day of scheduleDays(schedule)) {
    const weekdays = weekdaysOf(day);
    if (!weekdays.length || weekdays.some((weekday) => seen.has(weekday))) return 'rotation';
    weekdays.forEach((weekday) => seen.add(weekday));
  }
  return 'weekday';
}

export function weeklyGoal(schedule: WorkoutSchedule) {
  const days = scheduleDays(schedule);
  if (planCadence(schedule) === 'weekday') return new Set(days.flatMap(weekdaysOf)).size;
  return Math.max(1, Math.min(7, days.length));
}

export function scheduledDayForWeekday(schedule: WorkoutSchedule, weekday: number) {
  return scheduleDays(schedule).find((day) => weekdaysOf(day).includes(weekday)) ?? null;
}

export type PlanDayChoice = {
  day: string;
  /** False on a rest day of a weekday plan; `day` is then the next scheduled day. */
  scheduledToday: boolean;
};

/**
 * Today's day: the day already being trained today, then today's weekday,
 * then the day after the last one trained.
 */
export function pickPlanDay(
  schedule: WorkoutSchedule,
  latest: { scheduleDay: string; performedAt: string } | null,
  now = new Date()
): PlanDayChoice | null {
  const days = scheduleDays(schedule);
  if (!days.length) return null;
  const sameDay = (iso: string) => new Date(iso).toDateString() === now.toDateString();
  if (latest && days.includes(latest.scheduleDay) && sameDay(latest.performedAt)) {
    return { day: latest.scheduleDay, scheduledToday: true };
  }
  if (planCadence(schedule) === 'weekday') {
    for (let offset = 0; offset < 7; offset += 1) {
      const day = scheduledDayForWeekday(schedule, (now.getDay() + offset) % 7);
      if (day) return { day, scheduledToday: offset === 0 };
    }
  }
  const last = latest ? days.indexOf(latest.scheduleDay) : -1;
  return { day: days[(last + 1) % days.length], scheduledToday: true };
}

const slug = (value: string) => fold(value).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

/** Stable keys for schedule entries; edits to prescriptions or order keep them. */
export function scheduleEntryKeys(schedule: WorkoutSchedule) {
  const seen = new Map<string, number>();
  return schedule.entries.map((entry) => {
    const base = `${entry.day || 'Workout'}#${slug(entry.originalName)}`;
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return `${base}#${occurrence}`;
  });
}

export type Prescription = {
  sets: number | null;
  /** Exact reps, or the bottom of a range such as 8–10. */
  reps: number | null;
  repsMax: number | null;
  weight: { value: number; unit: WeightUnit } | null;
  restSeconds: number | null;
};

export function parsePrescription(text: string): Prescription {
  const value = text;
  // A range end followed by a unit is a weight, as in "4x8 - 60kg".
  const rangeEnd = String.raw`(?:\s*[-–/]\s*(\d{1,3})(?![\d.]|\s*(?:kg|kgs|chili|lbs?)\b))?`;
  const setsReps =
    value.match(new RegExp(String.raw`(?:^|[^\d.,])(\d{1,2})\s*[x×*]\s*(\d{1,3})${rangeEnd}(?![\d.])`, 'i')) ??
    value.match(new RegExp(String.raw`(?:^|[^\d.,])(\d{1,2})\s*(?:sets?|serie|series)\s*(?:of|da|di|de|x)?\s*(\d{1,3})${rangeEnd}`, 'i'));
  // A number right after "x" is reps, so in "4x8,60kg" the weight is 60, while "62,5 kg" is a decimal weight.
  const weight = value.match(/(?:^|[^\d.x×*])(\d{1,3}(?:[.,]\d{1,2})?)\s*(kg|kgs|chili|lb|lbs)\b/i);
  const rest = value.match(
    /(?:rest|rec(?:upero)?|pausa|riposo|descanso|repos|pause)\D{0,8}(?:(\d{1,3})\s*(?:''|"|″|s\b|sec|secondi|seconds|segundos)|(\d{1,2})\s*(?:'(?!')|′|min)\s*(?:(\d{1,2})\s*(?:''|"|″|s\b|sec)?)?)/i
  );
  const sets = setsReps ? Number(setsReps[1]) : null;
  const reps = setsReps ? Number(setsReps[2]) : null;
  const repsMax = setsReps?.[3] ? Number(setsReps[3]) : null;
  const restSeconds = rest
    ? rest[1]
      ? Number(rest[1])
      : Number(rest[2]) * 60 + Number(rest[3] ?? 0)
    : null;
  return {
    sets: sets && sets >= 1 && sets <= 99 ? sets : null,
    reps: reps && reps >= 1 && reps <= 999 ? reps : null,
    repsMax: repsMax && reps && repsMax > reps ? repsMax : null,
    weight: weight ? { value: Number(weight[1].replace(',', '.')), unit: /^lb/i.test(weight[2]) ? 'lb' : 'kg' } : null,
    restSeconds: restSeconds && restSeconds > 0 && restSeconds <= 1800 ? restSeconds : null,
  };
}

export type PlanCompletion =
  | { type: 'log'; log: WorkoutLog }
  | { type: 'checkin'; checkin: ScheduleCheckin };

export type PlanRow = {
  index: number;
  key: string;
  entry: MatchedScheduleEntry;
  kind: ReturnType<typeof scheduleEntryKind>;
  exercise: Exercise | null;
  prescription: Prescription;
  /** Values a one-tap log saves. `weightKg` is null when no weight is known yet. */
  sets: number;
  reps: number;
  weightKg: number | null;
  unit: WeightUnit;
  last: WorkoutLog | null;
  bestKg: number | null;
  done: PlanCompletion | null;
  /** True when a single tap can complete the row with the values above. */
  quick: boolean;
};

export function buildPlanRows(input: {
  template: ScheduleTemplate;
  day: string;
  todaysLogs: readonly WorkoutLog[];
  todaysCheckins: readonly ScheduleCheckin[];
  latest: ReadonlyMap<string, WorkoutLog>;
  bestKg: ReadonlyMap<string, number>;
  getExercise: (id: string) => Exercise | null;
}): PlanRow[] {
  const { template, day } = input;
  const keys = scheduleEntryKeys(template.schedule);
  const completion = (key: string): PlanCompletion | null => {
    const log = input.todaysLogs.find(
      (item) => item.schedule?.scheduleId === template.id && item.schedule.entryKey === key
    );
    if (log) return { type: 'log', log };
    const checkin = input.todaysCheckins.find(
      (item) => item.schedule.scheduleId === template.id && item.schedule.entryKey === key
    );
    return checkin ? { type: 'checkin', checkin } : null;
  };

  const rows = template.schedule.entries.flatMap((entry, index): PlanRow[] => {
    if ((entry.day || 'Workout') !== day) return [];
    const kind = scheduleEntryKind(entry);
    const exercise = kind === 'strength' && entry.exerciseId ? input.getExercise(entry.exerciseId) : null;
    const prescription = parsePrescription(entry.prescription);
    const last = exercise ? input.latest.get(exercise.id) ?? null : null;
    const reps =
      prescription.repsMax && last && last.reps >= (prescription.reps ?? 0) && last.reps <= prescription.repsMax
        ? last.reps
        : prescription.reps ?? last?.reps ?? 8;
    const unit = last?.enteredUnit ?? prescription.weight?.unit ?? 'kg';
    const weightKg = last
      ? last.weightKg
      : prescription.weight
        ? toKilograms(prescription.weight.value, prescription.weight.unit)
        : exercise?.equipment === 'Bodyweight'
          ? 0
          : null;
    const done = completion(keys[index]);
    return [{
      index,
      key: keys[index],
      entry,
      kind,
      exercise,
      prescription,
      sets: prescription.sets ?? last?.sets ?? 3,
      reps,
      weightKg,
      unit,
      last,
      bestKg: exercise ? input.bestKg.get(exercise.id) ?? null : null,
      done,
      quick: !done && (kind !== 'strength' || (exercise !== null && weightKg !== null)),
    }];
  });

  // Logs saved today without a plan link (Exercises tab, older app versions) still complete the matching row.
  const claimed = new Set(rows.flatMap((row) => (row.done?.type === 'log' ? [row.done.log.id] : [])));
  for (const row of rows) {
    if (row.done || !row.exercise) continue;
    const exerciseId = row.exercise.id;
    const log = input.todaysLogs.find((item) => !item.schedule && item.exerciseId === exerciseId && !claimed.has(item.id));
    if (!log) continue;
    claimed.add(log.id);
    row.done = { type: 'log', log };
    row.quick = false;
  }
  return rows;
}

/** Weight step for the inline stepper: 2.5 kg or 5 lb. */
export function weightStepKg(unit: WeightUnit) {
  return unit === 'lb' ? toKilograms(5, 'lb') : 2.5;
}
