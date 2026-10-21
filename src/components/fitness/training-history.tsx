import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Button, Chip, IconButton } from 'react-native-paper';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import { DeviceWorkouts } from '@/components/fitness/device-workouts';
import { LiftSparkline } from '@/components/fitness/lift-sparkline';
import { TrainingHeatmap } from '@/components/fitness/training-heatmap';
import { Skeleton } from '@/components/loading';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDeviceWorkouts } from '@/hooks/use-device-workouts';
import { useTheme } from '@/hooks/use-theme';
import { getCatalogExercise } from '@/lib/exercise-catalog';
import {
  formatWeight,
  type ScheduleCheckin,
  type WorkoutLog,
} from '@/lib/fitness-domain';
import {
  bestWeightsBefore,
  deleteCheckin,
  deleteWorkoutLog,
  listCheckinsBetween,
  listWorkoutLogsBetween,
} from '@/lib/fitness-store';
import { loadTodayPlan } from '@/lib/today-plan';
import { scheduleDays } from '@/lib/workout-schedule';
import {
  activeDayKeys,
  addDays,
  dateFromKey,
  dayKey,
  exerciseProgress,
  personalRecordLogIds,
  startOfLocalDay,
  startOfWeek,
  summarizeDays,
  weekStreak,
  type DaySummary,
  type ExerciseProgress,
  type WeekStreak,
} from '@/lib/training-stats';
import { syncTrainingWidgets } from '@/lib/training-widget-sync';

const HISTORY_WEEKS = 26;
const LIFT_COUNT = 6;
const SPARK_SESSIONS = 12;
const DEVICE_WORKOUT_DAYS = 7;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const RADIUS = 16;
const KIND_LABELS: Record<ScheduleCheckin['kind'], string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  mobility: 'Mobility',
  stretching: 'Stretching',
};
const wholeNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const fadeIn = (duration: number) => FadeIn.duration(duration).easing(EASE_OUT);
const rowExit = FadeOut.duration(150).easing(EASE_OUT);
const rowLayout = LinearTransition.duration(200).easing(EASE_IN_OUT);

type HistoryData = {
  logs: WorkoutLog[];
  checkins: ScheduleCheckin[];
  streak: WeekStreak;
  /** False only when nothing was ever logged, not just in the loaded window. */
  everActive: boolean;
  /** Heaviest weight per exercise before the loaded window. */
  priorBestKg: Map<string, number>;
  now: Date;
};

async function loadHistory(): Promise<HistoryData> {
  const now = new Date();
  const start = addDays(startOfWeek(now), -7 * (HISTORY_WEEKS - 1)).toISOString();
  const end = addDays(startOfLocalDay(now), 1).toISOString();
  const [logs, checkins, plan, priorBestKg] = await Promise.all([
    listWorkoutLogsBetween(start, end),
    listCheckinsBetween(start, end),
    loadTodayPlan({ now }).catch(() => null),
    bestWeightsBefore(start),
  ]);
  // Logs saved from a plan before entries were linked copied the plan text into notes; hide that copy.
  const copiedPrefixes = (plan?.library ?? []).flatMap((item) => scheduleDays(item.schedule).map((day) => `${day} · `));
  for (const log of logs) {
    if (copiedPrefixes.some((prefix) => log.notes.startsWith(prefix))) log.notes = '';
  }
  const streak =
    plan?.streak ??
    weekStreak(activeDayKeys([...logs, ...checkins].map((item) => item.performedAt)), 3, now);
  const everActive =
    logs.length > 0 || checkins.length > 0 || streak.best > 0 || priorBestKg.size > 0;
  return { logs, checkins, streak, everActive, priorBestKg, now };
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

function confirmDelete(title: string, onConfirm: () => void) {
  if (process.env.EXPO_OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(title)) onConfirm();
    return;
  }
  Alert.alert(title, 'This removes the entry from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

function showDeleteError(cause: unknown) {
  if (process.env.EXPO_OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`Could not delete the entry. ${errorMessage(cause)}`);
    return;
  }
  Alert.alert('Could not delete entry', errorMessage(cause));
}

function formatDayTitle(key: string, now: Date) {
  const date = dateFromKey(key);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function formatShortDay(key: string) {
  return dateFromKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Habit-style history: streak, calendar heatmap, day detail, lift progression. */
export function TrainingHistory({ onBrowse, initialDate }: { onBrowse: () => void; initialDate?: string }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const deviceWorkouts = useDeviceWorkouts(DEVICE_WORKOUT_DAYS);
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedDate = initialDate && DATE_KEY.test(initialDate) ? initialDate : null;
  const [selected, setSelected] = useState<string | null>(requestedDate);
  const [seenRequest, setSeenRequest] = useState(requestedDate);
  const request = useRef(0);

  if (requestedDate !== seenRequest) {
    setSeenRequest(requestedDate);
    if (requestedDate) setSelected(requestedDate);
  }

  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const next = await loadHistory();
      if (id !== request.current) return;
      setData(next);
      setError(null);
    } catch (cause) {
      if (id === request.current) setError(errorMessage(cause));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        request.current += 1;
      };
    }, [reload])
  );

  const days = useMemo(
    () => (data ? summarizeDays(data.logs, data.checkins) : new Map<string, DaySummary>()),
    [data]
  );
  const activeKeys = useMemo(() => [...days.keys()].sort(), [days]);
  const records = useMemo(() => (data ? personalRecordLogIds(data.logs, data.priorBestKg) : new Set<string>()), [data]);
  const lifts = useMemo(
    () => (data ? exerciseProgress(data.logs, data.priorBestKg).filter((lift) => lift.bestKg > 0).slice(0, LIFT_COUNT) : []),
    [data]
  );
  const weekVolumeKg = useMemo(() => {
    if (!data) return 0;
    const weekStart = dayKey(startOfWeek(data.now));
    let total = 0;
    for (const [key, summary] of days) if (key >= weekStart) total += summary.volumeKg;
    return total;
  }, [data, days]);

  const today = data ? dayKey(data.now) : null;
  const selectedDate =
    selected ?? (today && days.has(today) ? today : activeKeys[activeKeys.length - 1] ?? today);
  const previousDay = selectedDate ? activeKeys.filter((key) => key < selectedDate).pop() ?? null : null;
  const nextDay = selectedDate ? activeKeys.find((key) => key > selectedDate) ?? null : null;

  const step = useCallback(
    (direction: -1 | 1) => {
      const target = direction < 0 ? previousDay : nextDay;
      if (target) setSelected(target);
    },
    [nextDay, previousDay]
  );

  const remove = useCallback(
    (title: string, run: () => Promise<void>) =>
      confirmDelete(title, () => {
        if (process.env.EXPO_OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Stay on this day even when its last entry goes away.
        setSelected((current) => current ?? selectedDate);
        void (async () => {
          try {
            await run();
            syncTrainingWidgets().catch(() => {});
          } catch (cause) {
            showDeleteError(cause);
          }
          await reload();
        })();
      }),
    [reload, selectedDate]
  );

  if (!data) {
    return error ? (
      <View style={styles.root}>
        <ThemedText selectable type="small" style={{ color: theme.error }}>
          {error}
        </ThemedText>
        <Button mode="outlined" onPress={() => void reload()} style={styles.selfStart}>
          Try again
        </Button>
      </View>
    ) : (
      <HistorySkeleton />
    );
  }

  if (!data.everActive) {
    return (
      <Animated.View entering={reduced ? undefined : fadeIn(180)} style={styles.root}>
        <View style={[styles.empty, { backgroundColor: theme.card }]}>
          <ThemedText type="smallBold">No workouts yet</ThemedText>
          <Button mode="contained" onPress={onBrowse}>
            Browse exercises
          </Button>
        </View>
        <DeviceWorkouts state={deviceWorkouts} days={DEVICE_WORKOUT_DAYS} />
      </Animated.View>
    );
  }

  const summary = selectedDate ? days.get(selectedDate) : undefined;

  return (
    // Row exits are for deletes only; leaving the section must not leave fading rows behind.
    <LayoutAnimationConfig skipExiting>
      <Animated.View entering={reduced ? undefined : fadeIn(180)} style={styles.root}>
        {error ? (
          <ThemedText selectable type="small" style={{ color: theme.error }}>
            {error}
          </ThemedText>
        ) : null}

        <StatTiles streak={data.streak} weekVolumeKg={weekVolumeKg} />

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <TrainingHeatmap
            days={days}
            now={data.now}
            selected={selectedDate}
            onSelect={setSelected}
            onStep={step}
            maxWeeks={HISTORY_WEEKS}
          />
          {selectedDate ? (
            <View style={[styles.detail, { borderTopColor: theme.separator }]}>
              <View style={styles.detailHeader}>
                <IconButton
                  icon="chevron-left"
                  disabled={!previousDay}
                  onPress={() => step(-1)}
                  accessibilityLabel={
                    previousDay ? `Previous training day, ${formatShortDay(previousDay)}` : 'No earlier training day'
                  }
                  style={styles.iconButton}
                />
                <View style={styles.detailTitle}>
                  <ThemedText type="smallBold" accessibilityRole="header" numberOfLines={1} style={styles.centered}>
                    {formatDayTitle(selectedDate, data.now)}
                  </ThemedText>
                  <DayMeta summary={summary} />
                </View>
                <IconButton
                  icon="chevron-right"
                  disabled={!nextDay}
                  onPress={() => step(1)}
                  accessibilityLabel={nextDay ? `Next training day, ${formatShortDay(nextDay)}` : 'No later training day'}
                  style={styles.iconButton}
                />
              </View>

              <LayoutAnimationConfig key={selectedDate} skipExiting>
                <Animated.View entering={reduced ? undefined : fadeIn(140)} style={styles.dayRows}>
                  {summary?.logs.map((log) => (
                    <LogRow
                      key={log.id}
                      log={log}
                      record={records.has(log.id)}
                      reduced={reduced}
                      onDelete={(name) => remove(`Delete ${name}?`, () => deleteWorkoutLog(log.id))}
                    />
                  ))}
                  {summary?.checkins.map((checkin) => (
                    <CheckinRow
                      key={checkin.id}
                      checkin={checkin}
                      reduced={reduced}
                      onDelete={() => remove(`Delete ${checkin.name}?`, () => deleteCheckin(checkin.id))}
                    />
                  ))}
                  {!summary || (!summary.logs.length && !summary.checkins.length) ? (
                    <View style={styles.nothing}>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        Nothing logged
                      </ThemedText>
                      {selectedDate === today ? (
                        <Button
                          mode="text"
                          compact
                          contentStyle={styles.textButton}
                          onPress={() => router.setParams({ section: 'today' })}
                        >
                          Open today&apos;s plan
                        </Button>
                      ) : null}
                    </View>
                  ) : null}
                </Animated.View>
              </LayoutAnimationConfig>
            </View>
          ) : null}
        </View>

        {lifts.length ? (
          <View style={styles.section}>
            <ThemedText type="smallBold" accessibilityRole="header">
              Lifts
            </ThemedText>
            <View style={styles.list}>
              {lifts.map((lift) => (
                <LiftRow key={lift.exerciseId} lift={lift} />
              ))}
            </View>
          </View>
        ) : null}

        <DeviceWorkouts state={deviceWorkouts} days={DEVICE_WORKOUT_DAYS} />
      </Animated.View>
    </LayoutAnimationConfig>
  );
}

function StatTiles({ streak, weekVolumeKg }: { streak: WeekStreak; weekVolumeKg: number }) {
  const theme = useTheme();
  const volume = wholeNumber.format(weekVolumeKg);
  const weeks = streak.current === 1 ? 'week' : 'weeks';

  return (
    <View style={styles.tiles}>
      {streak.best > 0 ? (
        <View
          accessible
          accessibilityLabel={`Week streak, ${streak.current} ${weeks}${streak.best > streak.current ? `, best ${streak.best}` : ''}`}
          style={[styles.tile, { backgroundColor: theme.card }]}
        >
          <ThemedText type="metric" numberOfLines={1} adjustsFontSizeToFit>
            {streak.current}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
            Week streak
          </ThemedText>
          {streak.best > streak.current ? (
            <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
              Best {streak.best}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      <View
        accessible
        accessibilityLabel={`This week, ${streak.thisWeek} of ${streak.goal} days`}
        style={[styles.tile, { backgroundColor: theme.card }]}
      >
        <ThemedText type="metric" numberOfLines={1} adjustsFontSizeToFit>
          {streak.thisWeek}/{streak.goal}
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {' '}days
          </ThemedText>
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
          This week
        </ThemedText>
      </View>
      {weekVolumeKg > 0 ? (
        <View
          accessible
          accessibilityLabel={`Volume this week, ${volume} kilograms`}
          style={[styles.tile, { backgroundColor: theme.card }]}
        >
          <ThemedText type="metric" numberOfLines={1} adjustsFontSizeToFit>
            {volume}
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {' '}kg
            </ThemedText>
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
            Volume
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function DayMeta({ summary }: { summary: DaySummary | undefined }) {
  const theme = useTheme();
  if (!summary) return null;
  const parts = [
    summary.scheduleDays.join(', '),
    summary.volumeKg > 0 ? `${wholeNumber.format(summary.volumeKg)} kg` : '',
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <ThemedText type="caption" numberOfLines={1} style={[styles.centered, { color: theme.textSecondary }]}>
      {parts.join(' · ')}
    </ThemedText>
  );
}

function LogRow({
  log,
  record,
  reduced,
  onDelete,
}: {
  log: WorkoutLog;
  record: boolean;
  reduced: boolean;
  onDelete: (name: string) => void;
}) {
  const theme = useTheme();
  const name = getCatalogExercise(log.exerciseId)?.name ?? 'Exercise';
  const weight = log.weightKg > 0 ? formatWeight(log.weightKg, log.enteredUnit) : null;
  const detail = `${log.sets} × ${log.reps}${weight ? ` · ${weight}` : ''}`;

  return (
    <Animated.View
      exiting={reduced ? undefined : rowExit}
      layout={reduced ? undefined : rowLayout}
      style={[styles.row, { backgroundColor: theme.surfaceContainerHigh }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${log.sets} sets of ${log.reps}${weight ? ` at ${weight}` : ''}${record ? ', personal record' : ''}`}
        accessibilityHint="Opens the entry to edit"
        android_ripple={{ color: theme.separator }}
        onPress={() =>
          router.push({
            pathname: '/log-workout',
            params: { logId: log.id, exerciseId: log.exerciseId },
          } as Href)
        }
        style={({ pressed }) => [styles.rowMain, pressed && process.env.EXPO_OS !== 'android' && styles.pressed]}
      >
        <View style={styles.flex}>
          <View style={styles.nameLine}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.shrink}>
              {name}
            </ThemedText>
            {record ? (
              <Chip
                compact
                style={[styles.recordChip, { backgroundColor: theme.tertiaryContainer }]}
                textStyle={[styles.recordText, { color: theme.onTertiaryContainer }]}
              >
                PR
              </Chip>
            ) : null}
          </View>
          <ThemedText type="small" style={[styles.tabular, { color: theme.textSecondary }]} numberOfLines={1}>
            {detail}
          </ThemedText>
          {log.notes ? (
            <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={2}>
              {log.notes}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
      <IconButton
        icon="delete-outline"
        iconColor={theme.textSecondary}
        onPress={() => onDelete(name)}
        accessibilityLabel={`Delete ${name}`}
        style={styles.iconButton}
      />
    </Animated.View>
  );
}

function CheckinRow({
  checkin,
  reduced,
  onDelete,
}: {
  checkin: ScheduleCheckin;
  reduced: boolean;
  onDelete: () => void;
}) {
  const theme = useTheme();
  return (
    <Animated.View
      exiting={reduced ? undefined : rowExit}
      layout={reduced ? undefined : rowLayout}
      style={[styles.row, { backgroundColor: theme.surfaceContainerHigh }]}
    >
      <View accessible accessibilityLabel={`${checkin.name}, ${KIND_LABELS[checkin.kind]}`} style={styles.rowMain}>
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {checkin.name}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
            {KIND_LABELS[checkin.kind]}
          </ThemedText>
        </View>
      </View>
      <IconButton
        icon="delete-outline"
        iconColor={theme.textSecondary}
        onPress={onDelete}
        accessibilityLabel={`Delete ${checkin.name}`}
        style={styles.iconButton}
      />
    </Animated.View>
  );
}

function LiftRow({ lift }: { lift: ExerciseProgress }) {
  const theme = useTheme();
  const name = getCatalogExercise(lift.exerciseId)?.name ?? 'Exercise';
  const latest = formatWeight(lift.latestKg, lift.unit);
  const best = formatWeight(lift.bestKg, lift.unit);
  const showBest = lift.bestKg > lift.latestKg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, latest ${latest}${showBest ? `, best ${best}` : ', personal best'}`}
      accessibilityHint="Opens a form to log this lift"
      android_ripple={{ color: theme.separator }}
      onPress={() => router.push({ pathname: '/log-workout', params: { exerciseId: lift.exerciseId } } as Href)}
      style={({ pressed }) => [
        styles.liftRow,
        { backgroundColor: theme.card },
        pressed && process.env.EXPO_OS !== 'android' && styles.pressed,
      ]}
    >
      <View style={styles.flex}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {name}
        </ThemedText>
        {showBest ? (
          <ThemedText type="caption" style={[styles.tabular, { color: theme.textSecondary }]} numberOfLines={1}>
            Best {best}
          </ThemedText>
        ) : null}
      </View>
      <LiftSparkline values={lift.sessions.slice(-SPARK_SESSIONS).map((session) => session.topKg)} color={theme.primary} />
      <ThemedText type="smallBold" style={[styles.tabular, styles.liftValue]} numberOfLines={1}>
        {latest}
      </ThemedText>
    </Pressable>
  );
}

function HistorySkeleton() {
  return (
    <View style={styles.root} accessible accessibilityLabel="Loading history">
      <View style={styles.tiles}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.flex}>
            <Skeleton height={76} radius={RADIUS} />
          </View>
        ))}
      </View>
      <Skeleton height={240} radius={RADIUS} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    gap: Spacing.half,
  },
  card: {
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  detailTitle: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: Spacing.half,
  },
  dayRows: {
    gap: Spacing.one,
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  rowMain: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  recordChip: {
    borderRadius: 8,
  },
  recordText: {
    fontSize: 11,
    lineHeight: 14,
    marginVertical: 2,
    marginHorizontal: Spacing.two,
  },
  nothing: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.one,
  },
  liftRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  liftValue: {
    minWidth: 64,
    textAlign: 'right',
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.four,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    margin: 0,
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  shrink: {
    flexShrink: 1,
  },
  centered: {
    textAlign: 'center',
  },
  textButton: {
    minHeight: 48,
  },
  selfStart: {
    alignSelf: 'flex-start',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.7,
  },
});
