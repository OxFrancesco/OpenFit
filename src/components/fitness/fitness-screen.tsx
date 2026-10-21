import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Chip, Searchbar, SegmentedButtons } from 'react-native-paper';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  type Href,
} from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ScheduleLibrary } from '@/components/fitness/schedule-library';
import { TodayPlanSection } from '@/components/fitness/today-plan-section';
import { TrainingHistory } from '@/components/fitness/training-history';
import { MetricIcon } from '@/components/metric-icon';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EXERCISE_MUSCLES } from '@/lib/exercise-catalog';
import { formatWeight, personalBestKg, type Exercise, type WorkoutLog } from '@/lib/fitness-domain';
import { listWorkoutLogs, searchExerciseCatalog } from '@/lib/fitness-store';

type FitnessSection = 'today' | 'history' | 'plans' | 'exercises';

const SECTIONS: { id: FitnessSection; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'history', label: 'History' },
  { id: 'plans', label: 'Plans' },
  { id: 'exercises', label: 'Exercises' },
];

const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const isSection = (value: string | undefined): value is FitnessSection =>
  SECTIONS.some((item) => item.id === value);

export function FitnessScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ section?: string | string[]; date?: string | string[] }>();
  const requested = firstParam(params.section);
  const section: FitnessSection = isSection(requested) ? requested : 'today';
  const date = firstParam(params.date);

  // The URL is the source of truth so deep links, widget taps and the segments always agree.
  const showSection = useCallback((next: FitnessSection) => {
    router.setParams({ section: next, date: undefined });
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Appbar.Action
          icon="link-variant"
          accessibilityLabel="Connections"
          onPress={() => router.push('/connections' as unknown as Href)}
        />
      ),
    });
  }, [navigation]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.container}>
        <SegmentedButtons
          value={section}
          onValueChange={(value) => {
            if (isSection(value) && value !== section) showSection(value);
          }}
          buttons={SECTIONS.map((item) => ({
            value: item.id,
            label: item.label,
            accessibilityLabel: item.label,
            style: styles.segment,
            labelStyle: styles.segmentLabel,
          }))}
        />

        {section === 'today' ? <TodayPlanSection /> : null}
        {section === 'history' ? (
          <TrainingHistory onBrowse={() => showSection('exercises')} initialDate={date} />
        ) : null}
        {section === 'plans' ? <ScheduleLibrary /> : null}
        {section === 'exercises' ? <ExercisesSection /> : null}
      </View>
    </ScrollView>
  );
}

function ExercisesSection() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listWorkoutLogs()
        .then((items) => {
          if (!active) return;
          setLogs(items);
          setLogsError(null);
        })
        .catch((cause) => {
          if (active) setLogsError(cause instanceof Error ? cause.message : String(cause));
        });
      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    let active = true;

    searchExerciseCatalog(query, { muscle })
      .then((results) => {
        if (active) {
          setExercises(results);
          setSearchError(null);
        }
      })
      .catch((caughtError) => {
        if (active) {
          setSearchError(caughtError instanceof Error ? caughtError.message : String(caughtError));
        }
      });

    return () => {
      active = false;
    };
  }, [muscle, query]);

  const logsByExercise = useMemo(() => {
    const map = new Map<string, WorkoutLog[]>();
    for (const log of logs) {
      const existing = map.get(log.exerciseId) ?? [];
      existing.push(log);
      map.set(log.exerciseId, existing);
    }
    return map;
  }, [logs]);

  const errorMessages = [logsError, searchError].filter((message): message is string => Boolean(message));

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.section}>
      {errorMessages.length ? (
        <View accessibilityRole="alert" style={styles.errorBanner}>
          <ThemedText selectable type="small" style={{ color: theme.error }}>
            {errorMessages.join(' ')}
          </ThemedText>
        </View>
      ) : null}

      <Searchbar
        accessibilityLabel="Search exercises"
        placeholder="Search exercises"
        value={query}
        onChangeText={setQuery}
        style={{ backgroundColor: theme.surfaceContainerHigh }}
      />

      <ScrollView
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <FilterChip label="All" selected={!muscle} onPress={() => setMuscle(null)} />
        {EXERCISE_MUSCLES.map((item) => (
          <FilterChip
            key={item}
            label={item}
            selected={muscle === item}
            onPress={() => setMuscle(muscle === item ? null : item)}
          />
        ))}
      </ScrollView>

      {exercises.length ? (
        <View style={styles.results}>
          {exercises.map((exercise, index) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              logs={logsByExercise.get(exercise.id) ?? []}
              index={index}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="magnifyingglass"
          glyph="⌕"
          title="No exercise found"
          detail="Try another name, muscle, or clear the current filter."
        />
      )}
    </Animated.View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Chip
      selected={selected}
      showSelectedCheck
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8 }}
      style={{ borderRadius: 12 }}
    >
      {label}
    </Chip>
  );
}

function ExerciseRow({
  exercise,
  logs,
  index,
}: {
  exercise: Exercise;
  logs: readonly WorkoutLog[];
  index: number;
}) {
  const theme = useTheme();
  const recent = logs[0];
  const best = personalBestKg(logs, exercise.id);
  const href = { pathname: '/log-workout', params: { exerciseId: exercise.id } } as Href;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 24).duration(260)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Log ${exercise.name}`}
        accessibilityHint="Opens a form for sets, reps, and weight"
        onPress={() => router.push(href)}
        style={({ pressed }) => [
          styles.exerciseRow,
          { borderRadius: index === 0 ? 24 : 8 },
          { backgroundColor: theme.card, borderColor: theme.separator },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.exerciseIcon, { backgroundColor: theme.secondaryContainer }]}>
          <MetricIcon
            icon={exercise.category === 'cardio' ? 'figure.run' : 'dumbbell.fill'}
            glyph={exercise.category === 'cardio' ? '●' : '◆'}
            size={21}
            color={theme.text}
          />
        </View>
        <View style={styles.flex}>
          <ThemedText numberOfLines={1}>{exercise.name}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
            {exercise.primaryMuscle} · {exercise.equipment}
          </ThemedText>
          {recent ? (
            <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
              Last {recent.sets}×{recent.reps} at {formatWeight(recent.weightKg, recent.enteredUnit)}
              {best > recent.weightKg ? ` · best ${formatWeight(best, recent.enteredUnit)}` : ''}
            </ThemedText>
          ) : null}
        </View>
        <MetricIcon icon="chevron.right" glyph="›" size={18} color={theme.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

function EmptyState({
  icon,
  glyph,
  title,
  detail,
}: {
  icon: string;
  glyph: string;
  title: string;
  detail: string;
}) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={[styles.emptyState, { borderColor: theme.separator }]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: theme.secondaryContainer }]}>
        <MetricIcon icon={icon} glyph={glyph} size={22} color={theme.textSecondary} />
      </View>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText selectable type="small" style={[styles.centered, { color: theme.textSecondary }]}>
        {detail}
      </ThemedText>
    </Animated.View>
  );
}

const RADIUS = 16;

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },
  container: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  segment: {
    minWidth: 0,
  },
  segmentLabel: {
    marginHorizontal: -Spacing.two,
    marginVertical: Spacing.one,
  },
  section: {
    alignSelf: 'stretch',
    maxWidth: '100%',
    gap: Spacing.three,
  },
  chips: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  filterScroll: {
    alignSelf: 'stretch',
    flexGrow: 0,
    maxWidth: '100%',
  },
  results: {
    gap: Spacing.two,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  exerciseIcon: {
    width: 44,
    height: 44,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.four,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: Spacing.three,
  },
  centered: {
    textAlign: 'center',
    maxWidth: 340,
  },
  pressed: {
    opacity: 0.7,
  },
});
