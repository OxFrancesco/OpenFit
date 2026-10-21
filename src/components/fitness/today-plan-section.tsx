import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Chip, HelperText, IconButton, Menu, Portal, Snackbar } from 'react-native-paper';
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Skeleton } from '@/components/loading';
import { MaterialIcon } from '@/components/material-icon';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCatalogExercise } from '@/lib/exercise-catalog';
import { formatWeight } from '@/lib/fitness-domain';
import {
  completePlanRow,
  completeRemainingRows,
  loadTodayPlan,
  restoreCompletion,
  undoCompletion,
  undoResult,
  type RowResult,
  type TodayPlan,
  type WeekStripDay,
} from '@/lib/today-plan';
import { weightStepKg, type PlanCompletion, type PlanRow } from '@/lib/training-plan';
import { dateFromKey, dayKey } from '@/lib/training-stats';
import {
  canPinTrainingWidget,
  hasTrainingWidget,
  pinTrainingWidget,
  syncTrainingWidgets,
} from '@/lib/training-widget-sync';
import { loadScheduleLibrary, saveScheduleTemplate } from '@/lib/workout-schedule-store';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const MAX_WEIGHT_KG = 1000;

/** Rows changed on screen before the store confirms them. `settledFor` is the first load that reflects the change. */
type RowChange = { done: PlanCompletion | null; settledFor: number | null };
type Snack = { id: number; message: string; undo?: () => void; visible: boolean };

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
const syncWidgets = () => {
  syncTrainingWidgets().catch(() => undefined);
};
const haptic = (kind: 'log' | 'undo' | 'step' | 'complete') => {
  const feedback =
    kind === 'complete'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : kind === 'log'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.selectionAsync();
  feedback.catch(() => undefined);
};
const canComplete = (row: PlanRow) => row.kind !== 'strength' || (row.exercise !== null && row.weightKg !== null);
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
// Typed routes lag behind new screens such as /workout-schedule until Metro regenerates them.
const href = (pathname: string, params: Record<string, string>) => ({ pathname, params }) as unknown as Href;

function completionFromResult(result: RowResult): PlanCompletion {
  return result.type === 'log' ? { type: 'log', log: result.log } : { type: 'checkin', checkin: result.checkin };
}

function draftCompletion(plan: TodayPlan, row: PlanRow, weightKg: number | null): PlanCompletion {
  const performedAt = new Date().toISOString();
  const schedule = { scheduleId: plan.template?.id ?? '', scheduleDay: plan.day ?? '', entryKey: row.key };
  if (row.kind !== 'strength' || !row.exercise) {
    return { type: 'checkin', checkin: { id: `draft:${row.key}`, schedule, name: row.entry.displayName, kind: row.kind, performedAt } };
  }
  return {
    type: 'log',
    log: {
      id: `draft:${row.key}`,
      exerciseId: row.exercise.id,
      performedAt,
      sets: row.sets,
      reps: row.reps,
      weightKg: weightKg ?? 0,
      enteredUnit: row.unit,
      notes: '',
      schedule,
    },
  };
}

function logFormParams(plan: TodayPlan, row: PlanRow, weightKg: number | null) {
  const params: Record<string, string> = {
    scheduleId: plan.template?.id ?? '',
    scheduleDay: plan.day ?? '',
    entryKey: row.key,
    plannedSets: String(row.sets),
    plannedReps: String(row.reps),
    plannedUnit: row.unit,
    prescription: row.entry.prescription,
  };
  if (row.exercise) params.exerciseId = row.exercise.id;
  if (weightKg !== null) params.plannedWeightKg = String(weightKg);
  if (row.done?.type === 'log') params.logId = row.done.log.id;
  return params;
}

export function TodayPlanSection() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [loadError, setLoadError] = useState('');
  const [override, setOverride] = useState<{ day: string; date: string } | null>(null);
  const [changes, setChanges] = useState<Record<string, RowChange>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [matching, setMatching] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [dayMenu, setDayMenu] = useState(false);
  const [widgetOffer, setWidgetOffer] = useState(false);
  const [snack, setSnack] = useState<Snack | null>(null);
  const overrideRef = useRef(override);
  const loadSeq = useRef(0);
  const snackSeq = useRef(0);
  // Guards double taps that land before the disabled state renders.
  const saving = useRef(new Set<string>());

  const reload = useCallback(async () => {
    const seq = ++loadSeq.current;
    const now = new Date();
    const today = dayKey(now);
    if (overrideRef.current && overrideRef.current.date !== today) {
      overrideRef.current = null;
      setOverride(null);
    }
    try {
      const next = await loadTodayPlan({ day: overrideRef.current?.day ?? null, now });
      if (seq !== loadSeq.current) return;
      setPlan(next);
      setLoadError('');
      setChanges((current) => {
        const settled = Object.entries(current).filter(([, change]) => change.settledFor !== null && seq >= change.settledFor);
        if (!settled.length) return current;
        const remaining = { ...current };
        for (const [key] of settled) delete remaining[key];
        return remaining;
      });
    } catch (cause) {
      if (seq === loadSeq.current) setLoadError(errorText(cause));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
      if (Platform.OS === 'android') {
        Promise.all([canPinTrainingWidget(), hasTrainingWidget()])
          .then(([canPin, hasWidget]) => setWidgetOffer(canPin && !hasWidget))
          .catch(() => setWidgetOffer(false));
      }
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void reload();
      });
      return () => {
        subscription.remove();
        setSnack((current) => (current ? { ...current, visible: false } : current));
      };
    }, [reload])
  );

  const templateId = plan?.template?.id ?? '';
  const changeKey = useCallback((row: PlanRow) => `${templateId}:${row.key}`, [templateId]);

  const rows = useMemo(
    () =>
      (plan?.rows ?? []).map((row) => {
        const change = changes[`${templateId}:${row.key}`];
        return change ? { ...row, done: change.done, quick: !change.done && canComplete(row) } : row;
      }),
    [changes, plan, templateId]
  );
  const inFlight = useCallback(
    (row: PlanRow) => changes[changeKey(row)]?.settledFor === null,
    [changeKey, changes]
  );

  const showSnack = useCallback((message: string, undo?: () => void) => {
    snackSeq.current += 1;
    setSnack({ id: snackSeq.current, message, undo, visible: true });
  }, []);

  const begin = (entries: [string, PlanCompletion | null][]) =>
    setChanges((current) => ({
      ...current,
      ...Object.fromEntries(entries.map(([key, done]) => [key, { done, settledFor: null }])),
    }));
  const settle = (entries: [string, PlanCompletion | null][]) => {
    const settledFor = loadSeq.current + 1;
    setChanges((current) => ({
      ...current,
      ...Object.fromEntries(entries.map(([key, done]) => [key, { done, settledFor }])),
    }));
    syncWidgets();
    void reload();
  };
  const revert = (keys: string[]) => {
    setChanges((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
    void reload();
  };

  const weightFor = (row: PlanRow) => weights[changeKey(row)] ?? row.weightKg;

  const openForm = (row: PlanRow) => {
    if (!plan) return;
    router.push(href('/log-workout', logFormParams(plan, row, weightFor(row))));
  };

  const undoKeys = (items: { key: string; result: RowResult }[]) => async () => {
    begin(items.map(({ key }) => [key, null]));
    haptic('undo');
    try {
      await Promise.all(items.map(({ result }) => undoResult(result)));
      settle(items.map(({ key }) => [key, null]));
    } catch (cause) {
      revert(items.map(({ key }) => key));
      showSnack(`Couldn't undo. ${errorText(cause)}`);
    }
  };

  const guarded = async (key: string, task: () => Promise<void>) => {
    if (saving.current.has(key)) return;
    saving.current.add(key);
    try {
      await task();
    } finally {
      saving.current.delete(key);
    }
  };

  const restoreKey = (key: string, done: PlanCompletion) => async () => {
    begin([[key, done]]);
    haptic('log');
    try {
      await restoreCompletion(done);
      settle([[key, done]]);
    } catch (cause) {
      revert([key]);
      showSnack(`Couldn't restore. ${errorText(cause)}`);
    }
  };

  const toggleRow = (row: PlanRow) => guarded(changeKey(row), () => toggleRowNow(row));
  const logAll = () => guarded('all', logAllNow);

  const toggleRowNow = async (row: PlanRow) => {
    if (!plan || inFlight(row)) return;
    const key = changeKey(row);
    const name = row.entry.displayName;

    if (row.done) {
      const done = row.done;
      begin([[key, null]]);
      haptic('undo');
      try {
        await undoCompletion(done);
        settle([[key, null]]);
        showSnack(`${name} removed`, restoreKey(key, done));
      } catch (cause) {
        revert([key]);
        showSnack(`Couldn't undo ${name}. ${errorText(cause)}`);
      }
      return;
    }

    if (!canComplete(row)) {
      openForm(row);
      return;
    }

    const weightKg = weightFor(row);
    begin([[key, draftCompletion(plan, row, weightKg)]]);
    haptic(rows.every((item) => item.done || item.key === row.key) ? 'complete' : 'log');
    try {
      const result = await completePlanRow(plan, row, weightKg === null ? undefined : { weightKg });
      if (!result) {
        revert([key]);
        openForm(row);
        return;
      }
      settle([[key, completionFromResult(result)]]);
      if (result.type === 'log') {
        showSnack(
          result.personalRecord
            ? `New PR: ${name} ${formatWeight(result.log.weightKg, result.log.enteredUnit)}`
            : `${name} logged`,
          undoKeys([{ key, result }])
        );
      }
    } catch (cause) {
      revert([key]);
      showSnack(`Couldn't save ${name}. ${errorText(cause)}`);
    }
  };

  const logAllNow = async () => {
    if (!plan) return;
    const pending = rows.filter((row) => !row.done && canComplete(row));
    const drafts = pending.map((row): [string, PlanCompletion] => [changeKey(row), draftCompletion(plan, row, weightFor(row))]);
    begin(drafts);
    haptic(rows.every((row) => row.done || canComplete(row)) ? 'complete' : 'log');
    try {
      const { logs, checkins, skipped } = await completeRemainingRows({
        ...plan,
        rows: rows.map((row) => ({ ...row, weightKg: weightFor(row) })),
      });
      const saved: { key: string; result: RowResult }[] = [
        ...logs.map((log) => ({
          key: `${templateId}:${log.schedule?.entryKey ?? ''}`,
          result: { type: 'log' as const, log, personalRecord: false },
        })),
        ...checkins.map((checkin) => ({
          key: `${templateId}:${checkin.schedule.entryKey}`,
          result: { type: 'checkin' as const, checkin },
        })),
      ];
      const savedKeys = new Set(saved.map((item) => item.key));
      settle([
        ...saved.map(({ key, result }): [string, PlanCompletion | null] => [key, completionFromResult(result)]),
        ...drafts.filter(([key]) => !savedKeys.has(key)).map(([key]): [string, PlanCompletion | null] => [key, null]),
      ]);
      const needWeight = skipped.filter((row) => row.exercise).length;
      const needMatch = skipped.length - needWeight;
      const rest = [
        needWeight ? `${needWeight} still ${needWeight === 1 ? 'needs' : 'need'} a weight.` : '',
        needMatch ? `${needMatch} still ${needMatch === 1 ? 'needs' : 'need'} an exercise.` : '',
      ].filter(Boolean);
      showSnack(
        [saved.length ? `Logged ${plural(saved.length, 'exercise')}.` : '', ...rest].filter(Boolean).join(' '),
        saved.length ? undoKeys(saved) : undefined
      );
    } catch (cause) {
      revert(drafts.map(([key]) => key));
      showSnack(`Couldn't log the day. ${errorText(cause)}`);
    }
  };

  const chooseDay = (day: string) => {
    const next = { day, date: dayKey(new Date()) };
    overrideRef.current = next;
    setOverride(next);
    setNotesOpen(false);
    void reload();
  };

  const stepWeight = (row: PlanRow, direction: 1 | -1) => {
    const current = weightFor(row);
    if (current === null) return;
    const next = Math.max(0, Math.min(MAX_WEIGHT_KG, current + direction * weightStepKg(row.unit)));
    if (next === current) return;
    haptic('step');
    setWeights((all) => ({ ...all, [changeKey(row)]: next }));
  };

  const saveMatch = async (row: PlanRow, exerciseId: string) => {
    if (!plan?.template || matching) return;
    const key = changeKey(row);
    setMatching(key);
    try {
      const library = await loadScheduleLibrary();
      const template = library.find((item) => item.id === plan.template?.id);
      if (!template) throw new Error('This schedule was removed.');
      const schedule = {
        ...template.schedule,
        entries: template.schedule.entries.map((entry, index) =>
          index === row.index ? { ...entry, exerciseId, confidence: 1 } : entry
        ),
      };
      await saveScheduleTemplate(template.id, schedule);
      syncWidgets();
      await reload();
    } catch (cause) {
      showSnack(`Couldn't save the match. ${errorText(cause)}`);
    } finally {
      setMatching(null);
    }
  };

  const pinWidget = async () => {
    try {
      if (await pinTrainingWidget()) setWidgetOffer(false);
    } catch (cause) {
      showSnack(`Couldn't add the widget. ${errorText(cause)}`);
    }
  };

  const snackbar = (
    <Portal>
      {snack ? (
        <Snackbar
          key={snack.id}
          visible={snack.visible}
          onDismiss={() => setSnack((current) => (current?.id === snack.id ? { ...current, visible: false } : current))}
          action={snack.undo ? { label: 'Undo', onPress: snack.undo } : undefined}
          wrapperStyle={{ bottom: width >= 840 ? 0 : BottomTabInset }}
        >
          {snack.message}
        </Snackbar>
      ) : null}
    </Portal>
  );

  if (!plan) {
    return (
      <View style={styles.section}>
        {loadError ? (
          <>
            <HelperText type="error" accessibilityRole="alert">{`Couldn't load today's plan. ${loadError}`}</HelperText>
            <Button mode="outlined" onPress={() => void reload()} style={styles.retry}>
              Try again
            </Button>
          </>
        ) : (
          <View accessible accessibilityLabel="Loading today's plan" style={styles.section}>
            <Skeleton height={72} radius={16} />
            <Skeleton width="45%" height={28} radius={8} />
            <Skeleton height={72} radius={16} />
            <Skeleton height={72} radius={16} />
          </View>
        )}
      </View>
    );
  }

  if (!plan.template) {
    return (
      <View style={styles.section}>
        <ThemedText style={{ color: theme.textSecondary }}>Import your gym plan from a photo or PDF, or build one.</ThemedText>
        <Button mode="contained" icon="plus" onPress={() => router.push(href('/workout-schedule', { create: '1' }))}>
          Add a schedule
        </Button>
        {snackbar}
      </View>
    );
  }

  const restDay = !plan.scheduledToday && !override;
  const visibleRows = restDay ? [] : rows;
  const doneCount = visibleRows.filter((row) => row.done).length;
  const notDone = visibleRows.filter((row) => !row.done);
  const busy = Object.values(changes).some((change) => change.settledFor === null);
  const { streak } = plan;
  const longNotes = plan.dayNotes.length > 48 || plan.dayNotes.includes('\n');
  const scheduleTitle = plan.template.schedule.title;
  const title = restDay ? 'Rest day' : plan.day ?? scheduleTitle;
  const canSwitchDay = plan.days.length > 1 || restDay;
  const nextDay = restDay ? plan.day : null;

  return (
    <View style={styles.section}>
      <View style={styles.weekBlock}>
        <View style={styles.week}>
          {plan.week.map((day) => (
            <WeekDay key={day.date} day={day} />
          ))}
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {`${streak.thisWeek}/${streak.goal} this week`}
          {streak.current >= 1 ? ` · ${streak.current}-week streak` : ''}
        </ThemedText>
      </View>

      {loadError ? <HelperText type="error" accessibilityRole="alert">{`Couldn't refresh. ${loadError}`}</HelperText> : null}

      <View style={styles.dayBlock}>
        <View style={styles.dayHeader}>
          <View style={styles.flex}>
            {canSwitchDay ? (
              <Menu
                visible={dayMenu}
                onDismiss={() => setDayMenu(false)}
                anchor={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${title}. Change day`}
                    onPress={() => setDayMenu(true)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.dayTitle, pressed && styles.pressed]}
                  >
                    <ThemedText type="subtitle" accessibilityRole="header" numberOfLines={1} style={styles.shrink}>
                      {title}
                    </ThemedText>
                    <MaterialIcon name="expand-more" size={26} color={theme.text} />
                  </Pressable>
                }
              >
                {plan.days.map((day) => (
                  <Menu.Item
                    key={day}
                    title={day}
                    titleStyle={!restDay && day === plan.day ? { color: theme.primary } : undefined}
                    accessibilityState={{ selected: !restDay && day === plan.day }}
                    onPress={() => {
                      setDayMenu(false);
                      chooseDay(day);
                    }}
                  />
                ))}
              </Menu>
            ) : (
              <ThemedText type="subtitle" accessibilityRole="header">
                {title}
              </ThemedText>
            )}
            {nextDay ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Next: ${nextDay}`}
                accessibilityHint="Shows that day's exercises"
                onPress={() => chooseDay(nextDay)}
                hitSlop={12}
                style={({ pressed }) => [styles.planLink, pressed && styles.pressed]}
              >
                <ThemedText type="small" numberOfLines={1} style={[styles.shrink, { color: theme.textSecondary }]}>
                  {`Next: ${nextDay}`}
                </ThemedText>
                <MaterialIcon name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          {!restDay && visibleRows.length ? (
            <ThemedText
              type="metric"
              accessibilityLabel={`${doneCount} of ${plural(visibleRows.length, 'exercise')} done`}
              style={{ color: doneCount === visibleRows.length ? theme.primary : theme.text }}
            >
              {`${doneCount}/${visibleRows.length}`}
            </ThemedText>
          ) : null}
        </View>

        {!restDay && plan.dayNotes ? (
          <Pressable
            disabled={!longNotes}
            accessibilityRole={longNotes ? 'button' : 'text'}
            accessibilityState={longNotes ? { expanded: notesOpen } : undefined}
            onPress={() => setNotesOpen((open) => !open)}
          >
            <ThemedText type="small" numberOfLines={notesOpen ? undefined : 1} style={{ color: theme.textSecondary }}>
              {plan.dayNotes}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {notDone.length >= 2 && notDone.some(canComplete) ? (
        <Button mode="contained" icon="check-all" onPress={() => void logAll()} disabled={busy} contentStyle={styles.primaryAction}>
          Log all as planned
        </Button>
      ) : null}

      {visibleRows.length ? (
        <View style={styles.rows}>
          {visibleRows.map((row) => (
            <PlanRowItem
              key={row.key}
              row={row}
              weightKg={weightFor(row)}
              busy={inFlight(row)}
              matching={matching === changeKey(row)}
              onToggle={() => void toggleRow(row)}
              onOpen={() => openForm(row)}
              onStep={(direction) => stepWeight(row, direction)}
              onMatch={(exerciseId) => void saveMatch(row, exerciseId)}
              onChoose={() =>
                router.push(href('/workout-schedule', { id: plan.template?.id ?? '', day: plan.day ?? '' }))
              }
            />
          ))}
        </View>
      ) : null}

      {Platform.OS === 'android' && widgetOffer ? (
        <Button mode="text" icon="widgets-outline" onPress={() => void pinWidget()} style={styles.widgetButton}>
          Add widget to home screen
        </Button>
      ) : null}

      {snackbar}
    </View>
  );
}

function WeekDay({ day }: { day: WeekStripDay }) {
  const theme = useTheme();
  const date = dateFromKey(day.date);
  const letter = date.toLocaleDateString(undefined, { weekday: 'narrow' });
  const label = [
    date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    day.today ? 'today' : '',
    day.active ? 'trained' : '',
    day.planned && !day.active ? `${day.planned} planned` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const openable = day.active && !day.future;

  return (
    <Pressable
      disabled={!openable}
      accessibilityRole={openable ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityHint={openable ? 'Opens this day in History' : undefined}
      onPress={() => router.setParams({ section: 'history', date: day.date })}
      style={({ pressed }) => [styles.weekDay, day.future && styles.future, pressed && styles.pressed]}
    >
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {letter}
      </ThemedText>
      <View style={[styles.ring, { borderColor: day.today ? theme.primary : 'transparent' }]}>
        <View style={[styles.dayCircle, day.active && { backgroundColor: theme.primary }]}>
          <ThemedText
            type="smallBold"
            style={[styles.tabular, { color: day.active ? theme.onPrimary : day.today ? theme.primary : theme.text }]}
          >
            {Number(day.date.slice(8))}
          </ThemedText>
        </View>
      </View>
      <View style={[styles.plannedDot, { backgroundColor: day.planned ? theme.primary : 'transparent' }]} />
    </Pressable>
  );
}

function PlanRowItem({
  row,
  weightKg,
  busy,
  matching,
  onToggle,
  onOpen,
  onStep,
  onMatch,
  onChoose,
}: {
  row: PlanRow;
  weightKg: number | null;
  busy: boolean;
  matching: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onStep: (direction: 1 | -1) => void;
  onMatch: (exerciseId: string) => void;
  onChoose: () => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const name = row.entry.displayName;
  const strength = row.kind === 'strength';
  const unmatched = strength && !row.exercise;
  const done = row.done;
  const alias =
    row.exercise && row.exercise.name.toLocaleLowerCase() !== name.toLocaleLowerCase() ? row.exercise.name : null;
  const alternatives = unmatched
    ? row.entry.alternatives
        .map((item) => getCatalogExercise(item.exerciseId))
        .filter((exercise) => exercise !== null)
        .slice(0, 3)
    : [];
  const secondary = { color: theme.textSecondary };

  const body = (
    <>
      <ThemedText numberOfLines={2}>{name}</ThemedText>
      {done?.type === 'log' ? (
        <ThemedText type="small" style={[styles.tabular, secondary]}>
          {`${done.log.sets} × ${done.log.reps} · ${formatWeight(done.log.weightKg, done.log.enteredUnit)}`}
        </ThemedText>
      ) : row.entry.prescription || alias ? (
        <ThemedText type="small" numberOfLines={2} style={secondary}>
          {[row.entry.prescription, alias].filter(Boolean).join(' · ')}
        </ThemedText>
      ) : null}
      {row.last && !done ? (
        <ThemedText type="caption" style={[styles.tabular, secondary]}>
          {`Last ${formatWeight(row.last.weightKg, row.unit)} × ${row.last.reps}`}
        </ThemedText>
      ) : null}
    </>
  );

  return (
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(200).easing(EASE_OUT)}>
    <Animated.View
      style={[
        styles.row,
        {
          backgroundColor: done ? theme.secondaryContainer : theme.card,
          transitionProperty: 'backgroundColor',
          transitionDuration: 200,
          transitionTimingFunction: 'ease-out',
        },
      ]}
    >
      <View style={styles.rowMain}>
        {strength ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={done ? `Edit ${name}` : unmatched ? `Choose an exercise for ${name}` : `Open ${name}`}
            accessibilityHint={unmatched ? undefined : 'Opens the full log form'}
            disabled={busy}
            onPress={unmatched ? onChoose : onOpen}
            style={({ pressed }) => [styles.rowBody, pressed && styles.pressed]}
          >
            {body}
          </Pressable>
        ) : (
          <View style={styles.rowBody}>{body}</View>
        )}
        {unmatched ? null : (
          <CheckButton
            done={Boolean(done)}
            needsWeight={!done && !canComplete(row)}
            disabled={busy}
            label={done ? `Undo ${name}` : canComplete(row) ? `Log ${name}` : `Add weight for ${name}`}
            onPress={onToggle}
          />
        )}
      </View>

      {strength && !done && row.exercise && weightKg !== null ? (
        <View style={styles.stepper}>
          <IconButton
            icon="minus"
            mode="outlined"
            size={20}
            disabled={weightKg <= 0}
            accessibilityLabel={`Less weight for ${name}`}
            onPress={() => onStep(-1)}
            style={styles.stepButton}
          />
          <ThemedText
            type="smallBold"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${formatWeight(weightKg, row.unit)} for ${name}`}
            style={[styles.stepValue, styles.tabular]}
          >
            {formatWeight(weightKg, row.unit)}
          </ThemedText>
          <IconButton
            icon="plus"
            mode="outlined"
            size={20}
            disabled={weightKg >= MAX_WEIGHT_KG}
            accessibilityLabel={`More weight for ${name}`}
            onPress={() => onStep(1)}
            style={styles.stepButton}
          />
        </View>
      ) : null}

      {unmatched ? (
        <View style={styles.matchRow}>
          <ThemedText type="caption" style={secondary}>
            Log as
          </ThemedText>
          {alternatives.map((exercise) => (
            <Chip
              key={exercise.id}
              mode="outlined"
              disabled={matching}
              onPress={() => onMatch(exercise.id)}
              accessibilityLabel={`Log ${name} as ${exercise.name}`}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              {exercise.name}
            </Chip>
          ))}
          <Chip
            icon="magnify"
            mode="outlined"
            disabled={matching}
            onPress={onChoose}
            accessibilityLabel={`Choose an exercise for ${name}`}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            Choose
          </Chip>
        </View>
      ) : null}
    </Animated.View>
    </Animated.View>
  );
}

function CheckButton({
  done,
  needsWeight,
  disabled,
  label,
  onPress,
}: {
  done: boolean;
  /** No weight known yet: the button opens the log form instead of logging. */
  needsWeight: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={animatedStyle}>
      <IconButton
        icon={needsWeight ? 'plus' : 'check'}
        mode={done ? 'contained' : 'outlined'}
        selected={done}
        size={24}
        disabled={disabled}
        accessibilityLabel={label}
        role={needsWeight ? 'button' : 'checkbox'}
        aria-checked={needsWeight ? undefined : done}
        onPressIn={() => {
          if (!reduceMotion) scale.set(withSpring(0.9, { duration: 150, dampingRatio: 1 }));
        }}
        onPressOut={() => {
          if (!reduceMotion) scale.set(withSpring(1, { duration: 250, dampingRatio: 1 }));
        }}
        onPress={onPress}
        style={styles.check}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {
    alignSelf: 'stretch',
    gap: Spacing.four,
  },
  retry: {
    alignSelf: 'flex-start',
  },
  weekBlock: {
    gap: Spacing.two,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    gap: Spacing.one,
  },
  future: {
    opacity: 0.45,
  },
  ring: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plannedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dayBlock: {
    gap: Spacing.three,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  planLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: Spacing.half,
  },
  shrink: {
    flexShrink: 1,
  },
  dayTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 48,
    gap: Spacing.one,
  },
  primaryAction: {
    minHeight: 48,
  },
  rows: {
    gap: Spacing.two,
  },
  row: {
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingVertical: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    gap: Spacing.one,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowBody: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
  check: {
    width: 48,
    height: 48,
    borderRadius: 24,
    margin: 0,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -Spacing.one,
    paddingBottom: Spacing.one,
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    margin: 0,
  },
  stepValue: {
    minWidth: 72,
    textAlign: 'center',
  },
  matchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  widgetButton: {
    alignSelf: 'center',
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.7,
  },
});
