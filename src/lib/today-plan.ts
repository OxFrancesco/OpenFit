import { getCatalogExercise } from '@/lib/exercise-catalog';
import type { ScheduleCheckin, WeightUnit, WorkoutLog, WorkoutLogInput } from '@/lib/fitness-domain';
import {
  deleteCheckin,
  deleteWorkoutLog,
  latestScheduleActivity,
  listActivityTimes,
  listCheckinsBetween,
  listWorkoutLogsBetween,
  saveCheckin,
  saveWorkoutLogs,
  summarizeExercises,
} from '@/lib/fitness-store';
import type { ScheduleTemplate } from '@/lib/schedule-library';
import {
  buildPlanRows,
  pickPlanDay,
  planCadence,
  scheduledDayForWeekday,
  weeklyGoal,
  type PlanCadence,
  type PlanCompletion,
  type PlanRow,
} from '@/lib/training-plan';
import {
  activeDayKeys,
  addDays,
  dayKey,
  startOfLocalDay,
  startOfWeek,
  weekStreak,
  type WeekStreak,
} from '@/lib/training-stats';
import { scheduleDays } from '@/lib/workout-schedule';
import {
  loadActiveScheduleId,
  loadScheduleLibrary,
  saveActiveScheduleId,
} from '@/lib/workout-schedule-store';

/** Weeks of history read for the streak. */
const STREAK_WEEKS = 53;

export type WeekStripDay = {
  date: string;
  active: boolean;
  today: boolean;
  future: boolean;
  /** Schedule day planned on this weekday; only weekday plans know this. */
  planned: string | null;
};

export type TodayPlan = {
  template: ScheduleTemplate | null;
  library: ScheduleTemplate[];
  cadence: PlanCadence | null;
  days: string[];
  day: string | null;
  scheduledToday: boolean;
  dayNotes: string;
  rows: PlanRow[];
  doneCount: number;
  /** First row a single tap can complete. */
  nextRow: PlanRow | null;
  week: WeekStripDay[];
  streak: WeekStreak;
  loadedAt: string;
};

export async function loadTodayPlan(options: { day?: string | null; now?: Date } = {}): Promise<TodayPlan> {
  const now = options.now ?? new Date();
  const [library, activeId] = await Promise.all([loadScheduleLibrary(), loadActiveScheduleId()]);
  const template = library.find((item) => item.id === activeId) ?? library[0] ?? null;
  const todayStart = startOfLocalDay(now);
  const tomorrow = addDays(todayStart, 1);
  const weekStart = startOfWeek(now);

  const [latest, todaysLogs, todaysCheckins, activityTimes] = await Promise.all([
    template ? latestScheduleActivity(template.id) : Promise.resolve(null),
    listWorkoutLogsBetween(todayStart.toISOString(), tomorrow.toISOString()),
    listCheckinsBetween(todayStart.toISOString(), tomorrow.toISOString()),
    listActivityTimes(addDays(weekStart, -7 * STREAK_WEEKS).toISOString()),
  ]);

  const days = template ? scheduleDays(template.schedule) : [];
  const picked = template ? pickPlanDay(template.schedule, latest, now) : null;
  const day = options.day && days.includes(options.day) ? options.day : picked?.day ?? null;
  const scheduledToday = options.day && days.includes(options.day) ? true : picked?.scheduledToday ?? false;

  let rows: PlanRow[] = [];
  if (template && day) {
    const exerciseIds = template.schedule.entries.flatMap((entry) =>
      (entry.day || 'Workout') === day && entry.exerciseId ? [entry.exerciseId] : []
    );
    const { latest: latestLogs, bestKg } = await summarizeExercises(exerciseIds);
    rows = buildPlanRows({
      template,
      day,
      todaysLogs,
      todaysCheckins,
      latest: latestLogs,
      bestKg,
      getExercise: getCatalogExercise,
    });
  }

  const activeDays = activeDayKeys(activityTimes);
  const cadence = template ? planCadence(template.schedule) : null;
  const week = Array.from({ length: 7 }, (_, offset): WeekStripDay => {
    const date = addDays(weekStart, offset);
    const key = dayKey(date);
    return {
      date: key,
      active: activeDays.has(key),
      today: key === dayKey(now),
      future: date > now && key !== dayKey(now),
      planned:
        template && cadence === 'weekday' ? scheduledDayForWeekday(template.schedule, date.getDay()) : null,
    };
  });

  return {
    template,
    library,
    cadence,
    days,
    day,
    scheduledToday,
    dayNotes: template?.schedule.dayNotes.find((item) => item.day === day)?.notes ?? '',
    rows,
    doneCount: rows.filter((row) => row.done).length,
    nextRow: rows.find((row) => row.quick) ?? null,
    week,
    streak: weekStreak(activeDays, template ? weeklyGoal(template.schedule) : 3, now),
    loadedAt: now.toISOString(),
  };
}

export type RowOverrides = { sets?: number; reps?: number; weightKg?: number; unit?: WeightUnit };

function logInput(plan: TodayPlan, row: PlanRow, overrides: RowOverrides = {}): WorkoutLogInput | null {
  const weightKg = overrides.weightKg ?? row.weightKg;
  if (!plan.template || !plan.day || !row.exercise || weightKg === null) return null;
  return {
    exerciseId: row.exercise.id,
    performedAt: new Date().toISOString(),
    sets: overrides.sets ?? row.sets,
    reps: overrides.reps ?? row.reps,
    weightKg: Math.max(0, Math.min(1000, weightKg)),
    enteredUnit: overrides.unit ?? row.unit,
    notes: '',
    schedule: { scheduleId: plan.template.id, scheduleDay: plan.day, entryKey: row.key },
  };
}

function checkinInput(plan: TodayPlan, row: PlanRow) {
  if (!plan.template || !plan.day) return null;
  return {
    schedule: { scheduleId: plan.template.id, scheduleDay: plan.day, entryKey: row.key },
    name: row.entry.displayName,
    kind: row.kind,
    performedAt: new Date().toISOString(),
  };
}

export type RowResult =
  | { type: 'log'; log: WorkoutLog; personalRecord: boolean }
  | { type: 'checkin'; checkin: ScheduleCheckin };

/** Completes one row with its planned values. Returns null when the row still needs a weight or a match. */
export async function completePlanRow(plan: TodayPlan, row: PlanRow, overrides?: RowOverrides): Promise<RowResult | null> {
  if (row.done) return null;
  if (row.kind !== 'strength') {
    const input = checkinInput(plan, row);
    return input ? { type: 'checkin', checkin: await saveCheckin(input) } : null;
  }
  const input = logInput(plan, row, overrides);
  if (!input) return null;
  const [log] = await saveWorkoutLogs([input]);
  return {
    type: 'log',
    log,
    personalRecord: row.bestKg !== null && log.weightKg > row.bestKg,
  };
}

/** Completes every row that a single tap can complete. Rows needing a weight or a match are returned in `skipped`. */
export async function completeRemainingRows(plan: TodayPlan) {
  const pending = plan.rows.filter((row) => !row.done);
  const logRows = pending.filter((row) => row.kind === 'strength' && row.quick);
  const checkinRows = pending.filter((row) => row.kind !== 'strength');
  const logs = await saveWorkoutLogs(
    logRows.map((row) => logInput(plan, row)).filter((input): input is WorkoutLogInput => input !== null)
  );
  const checkins: ScheduleCheckin[] = [];
  for (const row of checkinRows) {
    const input = checkinInput(plan, row);
    if (input) checkins.push(await saveCheckin(input));
  }
  return {
    logs,
    checkins,
    skipped: pending.filter((row) => row.kind === 'strength' && !row.quick),
  };
}

export async function undoCompletion(done: PlanCompletion) {
  if (done.type === 'log') await deleteWorkoutLog(done.log.id);
  else await deleteCheckin(done.checkin.id);
}

/** Saves an undone completion again with its original id and time. */
export async function restoreCompletion(done: PlanCompletion) {
  if (done.type === 'log') await saveWorkoutLogs([done.log]);
  else await saveCheckin(done.checkin);
}

export async function undoResult(result: RowResult) {
  if (result.type === 'log') await deleteWorkoutLog(result.log.id);
  else await deleteCheckin(result.checkin.id);
}

export async function setActiveSchedule(id: string | null) {
  await saveActiveScheduleId(id);
}
