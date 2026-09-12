import { Platform ,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Chip, Searchbar, SegmentedButtons } from 'react-native-paper';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { DeviceWorkouts } from '@/components/fitness/device-workouts';
import { MetricIcon } from '@/components/metric-icon';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDeviceWorkouts } from '@/hooks/use-device-workouts';
import { useFitnessConnections } from '@/hooks/use-fitness-connections';
import { useTheme } from '@/hooks/use-theme';
import { EXERCISE_MUSCLES, getCatalogExercise } from '@/lib/exercise-catalog';
import type {
  ConnectableFitnessProviderId,
  FitnessConnectionSummary,
} from '@/lib/fitness-connections-contract';
import {
  formatWeight,
  personalBestKg,
  workoutVolumeKg,
  type Exercise,
  type WorkoutLog,
} from '@/lib/fitness-domain';
import { FITNESS_PROVIDERS, type FitnessProvider } from '@/lib/fitness-providers';
import {
  deleteWorkoutLog,
  listWorkoutLogs,
  searchExerciseCatalog,
} from '@/lib/fitness-store';
import { clerkSession } from '@/lib/clerk-session';

type FitnessSection = 'exercises' | 'history' | 'connections';

const DEVICE_WORKOUT_DAYS = 7;

const SECTIONS: { id: FitnessSection; label: string }[] = [
  { id: 'exercises', label: 'Exercises' },
  { id: 'history', label: 'History' },
  { id: 'connections', label: 'Connections' },
];

export function FitnessScreen() {
  const theme = useTheme();
  const initialRouteParams = useLocalSearchParams<{ provider?: string | string[] }>();
  const [section, setSection] = useState<FitnessSection>(() =>
    initialRouteParams.provider ? 'connections' : 'exercises'
  );
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [accountConnected, setAccountConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [statsNow] = useState(() => Date.now());
  const fitnessConnections = useFitnessConnections(accountConnected);
  const deviceWorkouts = useDeviceWorkouts(DEVICE_WORKOUT_DAYS);

  const refresh = useCallback(async () => {
    try {
      const [logsResult, tokenResult] = await Promise.allSettled([
        listWorkoutLogs(),
        clerkSession(),
      ]);

      if (logsResult.status === 'fulfilled') {
        setLogs(logsResult.value);
        setHistoryError(null);
      } else {
        setHistoryError(
          logsResult.reason instanceof Error ? logsResult.reason.message : String(logsResult.reason)
        );
      }

      setAccountConnected(
        tokenResult.status === 'fulfilled' &&
          Boolean(
            tokenResult.value?.user.id
          )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
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

  const stats = useMemo(() => {
    const weekStart = statsNow - 7 * 24 * 60 * 60 * 1_000;
    const weekLogs = logs.filter((log) => new Date(log.performedAt).getTime() >= weekStart);
    const volumeKg = weekLogs.reduce((total, log) => total + workoutVolumeKg(log), 0);
    return {
      entries: weekLogs.length,
      volumeKg,
      exercises: new Set(weekLogs.map((log) => log.exerciseId)).size,
    };
  }, [logs, statsNow]);
  const errorMessages = [
    historyError,
    searchError,
    section === 'connections' ? fitnessConnections.error : null,
  ].filter((message): message is string => Boolean(message));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.container}>

        {section !== 'connections' ? <TrainingSummary
          entries={stats.entries}
          exercises={stats.exercises}
          volumeKg={stats.volumeKg}
        /> : null}

        <SegmentedButtons
          value={section}
          onValueChange={value => { const item = SECTIONS.find(option => option.id === value); if (item) setSection(item.id); }}
          buttons={SECTIONS.map(item => ({ value: item.id, label: item.label }))}
        />

        {errorMessages.length ? (
          <View accessibilityRole="alert" style={styles.errorBanner}>
            <ThemedText selectable type="smallBold" style={{ color: theme.error }}>
              Fitness data is unavailable
            </ThemedText>
            <ThemedText selectable type="small" style={{ color: theme.error }}>
              {errorMessages.join(' ')}
            </ThemedText>
          </View>
        ) : null}

        {section === 'exercises' ? (
          <ExerciseLibrary
            query={query}
            onChangeQuery={setQuery}
            muscle={muscle}
            onChangeMuscle={setMuscle}
            exercises={exercises}
            logsByExercise={logsByExercise}
          />
        ) : null}

        {section === 'history' ? (
          <>
            <DeviceWorkouts state={deviceWorkouts} days={DEVICE_WORKOUT_DAYS} />
            <WorkoutHistory
              logs={logs}
              loading={loading}
              onBrowse={() => setSection('exercises')}
              onDeleted={refresh}
            />
          </>
        ) : null}

        {section === 'connections' ? (
          <Connections
            accountConnected={accountConnected}
            accountLoading={loading}
            connections={fitnessConnections.connections}
            busyProvider={fitnessConnections.busyProvider}
            operationInProgress={fitnessConnections.operationInProgress}
            loading={fitnessConnections.loading}
            onConnect={fitnessConnections.connect}
            onDisconnect={fitnessConnections.disconnect}
            failedDisconnectProvider={fitnessConnections.failedDisconnectProvider}
            onRemoveLocal={fitnessConnections.removeLocal}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

function TrainingSummary({
  entries,
  exercises,
  volumeKg,
}: {
  entries: number;
  exercises: number;
  volumeKg: number;
}) {
  const theme = useTheme();
  const formattedVolume = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    volumeKg
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(60).duration(320)}
      style={[styles.summaryCard, { backgroundColor: theme.primaryContainer }]}
    >
      <View style={styles.summaryHeader}>
        <View style={[styles.summaryIcon, { backgroundColor: theme.secondaryContainer }]}>
          <MetricIcon icon="dumbbell.fill" glyph="◆" size={22} color={theme.text} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold">This week</ThemedText>

        </View>
      </View>
      <View style={styles.summaryStats}>
        <SummaryStat value={String(entries)} label="Entries" />
        <SummaryStat value={String(exercises)} label="Exercises" />
        <SummaryStat value={formattedVolume} label="Volume kg" />
      </View>
    </Animated.View>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.summaryStat}>
      <ThemedText selectable type="metric" style={styles.tabular}>
        {value}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
    </View>
  );
}

function ExerciseLibrary({
  query,
  onChangeQuery,
  muscle,
  onChangeMuscle,
  exercises,
  logsByExercise,
}: {
  query: string;
  onChangeQuery: (value: string) => void;
  muscle: string | null;
  onChangeMuscle: (value: string | null) => void;
  exercises: readonly Exercise[];
  logsByExercise: ReadonlyMap<string, WorkoutLog[]>;
}) {
  const theme = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.section}>
      <Searchbar accessibilityLabel="Search exercises" placeholder="Search exercises" value={query} onChangeText={onChangeQuery} style={{ backgroundColor: theme.surfaceContainerHigh }} />

      <ScrollView
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <FilterChip label="All" selected={!muscle} onPress={() => onChangeMuscle(null)} />
        {EXERCISE_MUSCLES.map((item) => (
          <FilterChip
            key={item}
            label={item}
            selected={muscle === item}
            onPress={() => onChangeMuscle(muscle === item ? null : item)}
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
  return <Chip selected={selected} showSelectedCheck onPress={onPress} accessibilityLabel={label} style={{ borderRadius: 12 }} >{label}</Chip>;
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

function WorkoutHistory({
  logs,
  loading,
  onBrowse,
  onDeleted,
}: {
  logs: readonly WorkoutLog[];
  loading: boolean;
  onBrowse: () => void;
  onDeleted: () => Promise<void>;
}) {
  if (loading) {
    return (
      <EmptyState
        icon="clock"
        glyph="◷"
        title="Loading your history"
        detail="Your local training log will be ready in a moment."
      />
    );
  }

  if (!logs.length) {
    return (
      <EmptyState
        icon="list.bullet.clipboard"
        glyph="≡"
        title="No workouts yet"
        detail="Choose an exercise and record your first sets, reps, and weight."
        actionLabel="Browse exercises"
        onAction={onBrowse}
      />
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.section}>

      <View style={styles.results}>
        {logs.map((log) => (
          <HistoryRow key={log.id} log={log} onDeleted={onDeleted} />
        ))}
      </View>
    </Animated.View>
  );
}

function HistoryRow({ log, onDeleted }: { log: WorkoutLog; onDeleted: () => Promise<void> }) {
  const theme = useTheme();
  const [deleting, setDeleting] = useState(false);
  const exercise = getCatalogExercise(log.exerciseId);

  const remove = () => {
    const performDelete = async () => {
      setDeleting(true);
      try {
        await deleteWorkoutLog(log.id);
        await onDeleted();
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : String(deleteError);
        if (process.env.EXPO_OS === 'web' && typeof window !== 'undefined') {
          window.alert(`Could not delete the gym entry. ${message}`);
        } else {
          Alert.alert('Could not delete entry', message);
        }
      } finally {
        setDeleting(false);
      }
    };

    if (process.env.EXPO_OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Delete this gym entry?')) void performDelete();
      return;
    }

    Alert.alert('Delete gym entry?', 'This removes the entry from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void performDelete() },
    ]);
  };

  const date = new Date(log.performedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(log.performedAt).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });

  return (
    <Animated.View layout={LinearTransition.springify().damping(20)}>
      <View
        style={[
          styles.historyRow,
          { backgroundColor: theme.card, borderColor: theme.separator },
        ]}
      >
        <View style={styles.historyHeader}>
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {exercise?.name ?? 'Exercise'}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {date}
            </ThemedText>
          </View>
          <View style={styles.historyActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Log ${exercise?.name ?? 'exercise'} again`}
              onPress={() =>
                router.push(
                  { pathname: '/log-workout', params: { exerciseId: log.exerciseId } } as Href
                )
              }
              style={({ pressed }) => [styles.logAgainButton, pressed && styles.pressed]}
            >
              <ThemedText type="caption">Log again</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete gym entry"
              disabled={deleting}
              hitSlop={10}
              onPress={remove}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
            >
              <MetricIcon icon="trash" glyph="×" size={17} color={theme.error} />
            </Pressable>
          </View>
        </View>
        <View style={styles.historyStats}>
          <HistoryStat label="Sets × reps" value={`${log.sets} × ${log.reps}`} />
          <HistoryStat label="Weight" value={formatWeight(log.weightKg, log.enteredUnit)} />
          <HistoryStat label="Volume" value={`${Math.round(workoutVolumeKg(log))} kg`} />
        </View>
        {log.notes ? (
          <ThemedText selectable type="small" style={{ color: theme.textSecondary }}>
            {log.notes}
          </ThemedText>
        ) : null}
      </View>
    </Animated.View>
  );
}

function HistoryStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.historyStat}>
      <ThemedText selectable type="smallBold" style={styles.tabular}>
        {value}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
    </View>
  );
}

function Connections({
  accountConnected,
  accountLoading,
  connections,
  busyProvider,
  operationInProgress,
  loading,
  onConnect,
  onDisconnect,
  failedDisconnectProvider,
  onRemoveLocal,
}: {
  accountConnected: boolean;
  accountLoading: boolean;
  connections: readonly FitnessConnectionSummary[];
  busyProvider: ConnectableFitnessProviderId | null;
  operationInProgress: boolean;
  loading: boolean;
  onConnect: (provider: ConnectableFitnessProviderId) => Promise<void>;
  onDisconnect: (provider: ConnectableFitnessProviderId) => Promise<void>;
  failedDisconnectProvider: ConnectableFitnessProviderId | null;
  onRemoveLocal: (provider: ConnectableFitnessProviderId) => Promise<void>;
}) {
  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.section}>
      <View style={styles.results}>
        {FITNESS_PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            accountConnected={accountConnected}
            accountLoading={accountLoading}
            connection={
              provider.id === 'device-health'
                ? undefined
                : connections.find((item) => item.provider === provider.id)
            }
            busy={provider.id !== 'device-health' && busyProvider === provider.id}
            actionsBusy={operationInProgress}
            loading={provider.id !== 'device-health' && loading}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            removeLocalAvailable={failedDisconnectProvider === provider.id}
            onRemoveLocal={onRemoveLocal}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function ProviderCard({
  provider,
  accountConnected,
  accountLoading,
  connection,
  busy,
  actionsBusy,
  loading,
  onConnect,
  onDisconnect,
  removeLocalAvailable,
  onRemoveLocal,
}: {
  provider: FitnessProvider;
  accountConnected: boolean;
  accountLoading: boolean;
  connection?: FitnessConnectionSummary;
  busy: boolean;
  actionsBusy: boolean;
  loading: boolean;
  onConnect: (provider: ConnectableFitnessProviderId) => Promise<void>;
  onDisconnect: (provider: ConnectableFitnessProviderId) => Promise<void>;
  removeLocalAvailable: boolean;
  onRemoveLocal: (provider: ConnectableFitnessProviderId) => Promise<void>;
}) {
  const theme = useTheme();
  const isDevice = provider.id === 'device-health';
  const connected = isDevice ? false : connection?.state === 'connected';
  const unavailable = !isDevice && connection?.state === 'unavailable';
  const needsAccount = !isDevice && !accountConnected && !accountLoading;
  const actionLabel = providerActionLabel({
    busy,
    connected,
    isDevice,
    loading,
    needsAccount,
    provider,
    connection,
    removeLocalAvailable,
    accountLoading,
  });
  const statusLabel = providerStatusLabel({
    connected,
    isDevice,
    loading,
    needsAccount,
    provider,
    connection,
    removeLocalAvailable,
    accountLoading,
  });
  const disabled = actionsBusy || loading || accountLoading;

  const handlePress = () => {
    if (provider.id === 'device-health') {
      router.push(connected ? ('/settings' as Href) : ('/' as Href));
      return;
    }

    const providerId = provider.id;

    if (needsAccount) {
      router.push('/account');
      return;
    }

    if (unavailable || !connection) {
      void Linking.openURL(provider.infoUrl);
      return;
    }

    if (connection.state === 'connected') {
      if (removeLocalAvailable) {
        confirmProviderLocalRemoval(provider, () => void onRemoveLocal(providerId));
        return;
      }
      confirmProviderDisconnect(provider, () => void onDisconnect(providerId));
      return;
    }

    void onConnect(providerId);
  };

  return (
    <View style={[styles.providerCard, { backgroundColor: theme.card, borderColor: theme.separator }]}>
      <View style={styles.providerHeader}>
        <View style={[styles.providerMark, { backgroundColor: theme.secondaryContainer }]}>
          <ProviderGlyph providerId={provider.id} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold">{provider.name}</ThemedText>
          <ThemedText selectable type="small" style={{ color: theme.textSecondary }}>
            {provider.detail}
          </ThemedText>
          {connection?.externalAccountLabel ? (
            <ThemedText selectable type="caption" style={{ color: theme.textSecondary }}>
              Account {connection.externalAccountLabel}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View style={styles.providerFooter}>
        <View
          accessibilityLiveRegion="polite"
          style={[styles.statusPill, { backgroundColor: theme.secondaryContainer }]}
        >
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {statusLabel}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel} ${provider.name}`}
          accessibilityState={{ busy, disabled }}
          disabled={disabled}
          onPress={handlePress}
          style={({ pressed }) => [
            styles.providerButton,
            { backgroundColor: connected ? theme.backgroundSelected : theme.text },
            disabled && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <ThemedText
            type="smallBold"
            style={{ color: connected ? theme.text : theme.background }}
          >
            {actionLabel}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function providerActionLabel({
  busy,
  connected,
  isDevice,
  loading,
  needsAccount,
  provider,
  connection,
  removeLocalAvailable,
  accountLoading,
}: {
  busy: boolean;
  connected: boolean;
  isDevice: boolean;
  loading: boolean;
  needsAccount: boolean;
  provider: FitnessProvider;
  connection?: FitnessConnectionSummary;
  removeLocalAvailable: boolean;
  accountLoading: boolean;
}) {
  if (busy) return 'Working…';
  if (accountLoading) return 'Checking…';
  if (isDevice) return 'Open Health';
  if (needsAccount) return 'Sign in';
  if (loading) return 'Checking…';
  if (connected) return removeLocalAvailable ? 'Remove from OpenFit' : 'Disconnect';
  if (connection?.state === 'reauth-required') return 'Reconnect';
  if (connection?.state === 'disconnected') return 'Connect';
  return provider.actionLabel;
}

function providerStatusLabel({
  connected,
  isDevice,
  loading,
  needsAccount,
  provider,
  connection,
  removeLocalAvailable,
  accountLoading,
}: {
  connected: boolean;
  isDevice: boolean;
  loading: boolean;
  needsAccount: boolean;
  provider: FitnessProvider;
  connection?: FitnessConnectionSummary;
  removeLocalAvailable: boolean;
  accountLoading: boolean;
}) {
  if (accountLoading) return 'Checking account';
  if (connected) return removeLocalAvailable ? 'Revocation not confirmed' : 'Connected';
  if (isDevice) return Platform.OS === 'web' ? 'Use the mobile app' : 'On this phone';
  if (needsAccount) return 'Sign-in required';
  if (loading) return 'Checking server';
  if (connection?.state === 'reauth-required') return 'Reconnect required';
  if (connection?.state === 'disconnected') return 'Available';
  if (connection?.unavailableReason === 'policy-disabled') return 'Written clearance required';
  if (connection?.unavailableReason === 'approval-required') return 'Partner approval required';
  if (connection?.unavailableReason === 'not-configured') return 'Server setup required';
  return provider.statusLabel;
}

function confirmProviderDisconnect(provider: FitnessProvider, disconnect: () => void) {
  if (process.env.EXPO_OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`Disconnect ${provider.name}?`)) disconnect();
    return;
  }

  Alert.alert(
    `Disconnect ${provider.name}?`,
    'OpenFit will ask the provider to revoke access before deleting the encrypted connection.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: disconnect },
    ]
  );
}

function confirmProviderLocalRemoval(provider: FitnessProvider, removeLocal: () => void) {
  const message = `Revoke OpenFit in your ${provider.name} account first. This deletes OpenFit's encrypted server-held credential and cannot revoke provider access.`;
  if (process.env.EXPO_OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`Remove ${provider.name} from OpenFit?\n\n${message}`)) removeLocal();
    return;
  }

  Alert.alert(`Remove ${provider.name} from OpenFit?`, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove from OpenFit', style: 'destructive', onPress: removeLocal },
  ]);
}

function ProviderGlyph({ providerId }: { providerId: FitnessProvider['id'] }) {
  const theme = useTheme();
  const glyph = providerId === 'strava' ? '▲' : providerId === 'garmin' ? '△' : 'G';
  return (
    <ThemedText type="smallBold" style={{ color: theme.text }}>
      {glyph}
    </ThemedText>
  );
}

function EmptyState({
  icon,
  glyph,
  title,
  detail,
  actionLabel,
  onAction,
}: {
  icon: string;
  glyph: string;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
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
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.emptyAction,
            { borderColor: theme.separator },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="smallBold">{actionLabel}</ThemedText>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const RADIUS = 16;

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  container: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  intro: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  summaryCard: {
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  summaryStat: {
    flex: 1,
    gap: Spacing.half,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 10,
    borderCurve: 'continuous',
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.one,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  section: {
    alignSelf: 'stretch',
    maxWidth: '100%',
    gap: Spacing.three,
  },
  searchBar: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 25,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.three,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.sans,
    fontSize: 16,
    paddingVertical: Spacing.two,
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
  chip: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
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
  historyRow: {
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  historyStats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  historyStat: {
    flex: 1,
    gap: Spacing.half,
  },
  deleteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  logAgainButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  providerCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  providerMark: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  providerButton: {
    minHeight: 48,
    minWidth: 100,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyAction: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: Spacing.three,
    gap: Spacing.half,
  },
  centered: {
    textAlign: 'center',
    maxWidth: 340,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
