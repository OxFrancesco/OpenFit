import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MetricIcon } from '@/components/metric-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DeviceWorkoutsState } from '@/hooks/use-device-workouts';
import type { ExerciseSummary } from '@/lib/health-data';
import { healthSourceName } from '@/lib/health-source';

/** Workouts other apps wrote to the phone's health store, read-only. */
export function DeviceWorkouts({ state, days }: { state: DeviceWorkoutsState; days: number }) {
  const theme = useTheme();
  if (state.kind === 'unavailable') return null;

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.section}>
      <View style={styles.header}>
        <ThemedText type="smallBold">From {healthSourceName}</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          Last {days} days
        </ThemedText>
      </View>
      {state.kind === 'error' ? (
        <ThemedText type="small" style={{ color: theme.error }}>
          {state.message}
        </ThemedText>
      ) : null}
      {state.workouts.length ? (
        state.workouts.map((workout) => <DeviceWorkoutRow key={workout.id} workout={workout} />)
      ) : state.kind === 'loaded' ? (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          No workouts recorded on this phone in the last {days} days.
        </ThemedText>
      ) : null}
    </Animated.View>
  );
}

function DeviceWorkoutRow({ workout }: { workout: ExerciseSummary }) {
  const theme = useTheme();
  const stats = [
    workout.activeMinutes !== null ? formatDuration(workout.activeMinutes) : null,
    workout.caloriesKcal !== null ? `${Math.round(workout.caloriesKcal)} kcal` : null,
    workout.distanceKm !== null ? `${workout.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km` : null,
  ].filter((stat): stat is string => stat !== null);

  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.separator }]}>
      <View style={[styles.icon, { backgroundColor: theme.secondaryContainer }]}>
        <MetricIcon icon="figure.run" glyph="🏃" size={18} color={theme.text} />
      </View>
      <View style={styles.copy}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {workout.name}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {workout.startTime ? formatWhen(workout.startTime) : ''}
        </ThemedText>
      </View>
      <ThemedText selectable type="small" style={[styles.stats, { color: theme.textSecondary }]}>
        {stats.join(' · ')}
      </ThemedText>
    </View>
  );
}

function formatDuration(minutes: number) {
  const whole = Math.round(minutes);
  return whole >= 60 ? `${Math.floor(whole / 60)}h ${whole % 60}m` : `${whole} min`;
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: Spacing.half,
  },
  stats: {
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    maxWidth: 140,
  },
});
