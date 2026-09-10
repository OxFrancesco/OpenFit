import { useAuth, useUser } from '@clerk/expo';
import { Button, List, SegmentedButtons } from 'react-native-paper';
import { MaterialIcon } from '@/components/material-icon';
import { Link, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityRings, type RingSlot } from '@/components/activity-rings';
import { CardEditor } from '@/components/card-editor';
import { LoadingDots, SkeletonCard } from '@/components/loading';
import { MetricCard } from '@/components/metric-card';
import { SleepCard } from '@/components/sleep-card';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getApiBaseUrl } from '@/lib/api-base';
import { DEBUG_ENABLED } from '@/lib/debug';
import { bindSnapshotAccount, clearSnapshotCache, getCachedSnapshot, setCachedSnapshot } from '@/lib/health-cache';
import { connectDeviceHealth, fetchHealthSnapshot, fetchHealthMetrics, isHealthEnabled, healthSourceName } from '@/lib/health-source';
import { registerWidgetRefresh } from '@/lib/background-refresh';
import { loadDashboardPrefs, saveDashboardPrefs } from '@/lib/dashboard-prefs';
import { defaultPrefs, type DashboardPrefs } from '@/lib/dashboard-prefs-core';
import { getDefaultGoal, getMetricDef, SLEEP_CARD_ID } from '@/lib/metric-catalog';
import { buildWidgetData, emptyWidgetData, getWidgetMetricIds } from '@/lib/widget-data';
import { syncWidgets } from '@/lib/widget-sync';
import type { HealthMetric, HealthSnapshot } from '@/lib/health-data';
type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
type DashboardRangeDays = 1 | 7 | 14 | 30 | 90;

const RANGE_OPTIONS: { label: string; value: DashboardRangeDays }[] = [
  { label: 'Today', value: 1 },
  { label: '7D', value: 7 },
  { label: '14D', value: 14 },
  { label: '30D', value: 30 },
  ...(Platform.OS === 'android' ? [] : [{ label: '90D', value: 90 as const }]),
];
const LEGAL_LINKS: { href: Href; label: string }[] = [
  { href: '/privacy' as Href, label: 'Privacy' },
  { href: '/terms' as Href, label: 'Terms' },
  { href: '/support' as Href, label: 'Support' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isLoaded: accountLoaded, userId } = useAuth();
  const { user } = useUser();
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [authState, setAuthState] = useState<LoadState>('idle');
  const [healthState, setHealthState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<DashboardRangeDays>(1);
  const [prefs, setPrefs] = useState<DashboardPrefs>(defaultPrefs);
  const [cardEditorOpen, setCardEditorOpen] = useState(false);
  const [ringEditorSlot, setRingEditorSlot] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [restoring, setRestoring] = useState(Platform.OS !== 'web');
  const generation = useRef(0);
  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  const ownerRef = useRef(userId);
  useEffect(() => { ownerRef.current = userId; }, [userId]);
  const neededIds = useMemo(() => [...new Set([...prefs.rings, ...prefs.cards,
    ...getWidgetMetricIds(prefs, { includeConfigurable: Platform.OS === 'ios' })])].filter(id => id !== SLEEP_CARD_ID), [prefs]);

  useFocusEffect(useCallback(() => {
    if (!accountLoaded) return;
    let active = true;
    ++generation.current;
    bindSnapshotAccount(userId ?? null);
    setSnapshot(null);
    setConnected(false);
    Promise.all([loadDashboardPrefs(), isHealthEnabled()]).then(([stored, enabled]) => {
      if (!active) return;
      setPrefs(stored); setConnected(enabled); setRestoring(false);
    }).catch(cause => { if (active) { setError(String(cause)); setRestoring(false); } });
    return () => { active = false; ++generation.current; };
  }, [accountLoaded, userId]));

  const loadHealth = useCallback(async () => {
    if (!connected || !userId) return;
    const request = ++generation.current;
    const cached = getCachedSnapshot(rangeDays);
    setSnapshot(cached?.snapshot ?? null);
    setHealthState('loading'); setError(null);
    try {
      const next = await fetchHealthSnapshot({ days: rangeDays, metricIds: neededIds });
      if (generation.current !== request) return;
      setCachedSnapshot(rangeDays, next); setSnapshot(next); setHealthState('loaded');
      const widgetMetrics = rangeDays === 1 ? next.metrics : (await fetchHealthMetrics(getWidgetMetricIds(prefsRef.current, { includeConfigurable: Platform.OS === 'ios' }), 1)).metrics;
      if (generation.current === request) await syncWidgets(buildWidgetData(prefsRef.current, widgetMetrics));
    } catch (cause) {
      if (generation.current === request) { setHealthState('error'); setError(cause instanceof Error ? cause.message : String(cause)); }
    }
  }, [connected, userId, rangeDays, neededIds]);
  useEffect(() => {
    const timer = setTimeout(() => { void loadHealth(); }, 0);
    return () => { clearTimeout(timer); };
  }, [loadHealth]);
  useEffect(() => {
    if (restoring) return;
    if (connected) void registerWidgetRefresh().catch(() => undefined);
    else void syncWidgets(emptyWidgetData(prefs)).catch(() => undefined);
  }, [connected, restoring, prefs]);

  async function connect() {
    if (!userId) { router.push('/account'); return; }
    const owner = userId;
    setAuthState('loading'); setError(null);
    try {
      await connectDeviceHealth();
      if (ownerRef.current !== owner) return;
      clearSnapshotCache(); setConnected(true); setAuthState('loaded');
    } catch (cause) {
      if (ownerRef.current === owner) { setAuthState('error'); setError(cause instanceof Error ? cause.message : String(cause)); }
    }
  }
  const persistPrefs = useCallback((next: DashboardPrefs) => {
    setPrefs(next); void saveDashboardPrefs(next).catch(() => undefined);
  }, []);
  const selectRingMetric = (slot: number, metricId: string) => {
    const rings = [...prefs.rings] as DashboardPrefs['rings']; rings[slot] = metricId;
    persistPrefs({ ...prefs, rings });
  };
  const changeRingGoal = (metricId: string, goal: number) => persistPrefs({ ...prefs, goals: { ...prefs.goals, [metricId]: goal } });
  const toggleCard = (id: string) => persistPrefs({ ...prefs, cards: prefs.cards.includes(id) ? prefs.cards.filter(c => c !== id) : [...prefs.cards, id] });
  const updateRangeDays = (days: DashboardRangeDays) => { ++generation.current; setRangeDays(days); };
  const initialLoading = healthState === 'loading' && !snapshot;
  const metricsMap = useMemo(() => Object.fromEntries((snapshot?.metrics ?? []).map(m => [m.id, m])) as Record<string, HealthMetric>, [snapshot]);
  const ringSlots: RingSlot[] = prefs.rings.map(id => ({ metricId: id, value: metricsMap[id]?.value ?? null, goal: prefs.goals[id] ?? getDefaultGoal(id) }));
  const userName = user?.firstName || user?.fullName || 'User';
  // Greeting — time-aware
  const hour = new Date().getHours();
  const daypart = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const greeting = userName === 'User' ? `Good ${daypart}` : `Good ${daypart}, ${userName}`;
  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // ── Auth gate: sign-in screen when not authenticated ──
  if (!userId || !connected) {
    // Avoid flashing the sign-in screen while the stored session restores.
    if (restoring || !accountLoaded) {
      return (
        <View style={[styles.signInScreen, { backgroundColor: theme.background }]}>
          <LoadingDots color={theme.textSecondary} size={8} />
        </View>
      );
    }

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.signInScroll}
      >
        <View style={styles.signInContent}>
          <ThemedText type="title">Health overview</ThemedText>
          <View style={[styles.connectionCard, { backgroundColor: theme.primaryContainer }]}>
            <MaterialIcon name="monitor-heart" size={40} color={theme.onPrimaryContainer} />
            <ThemedText type="subtitle" style={{ color: theme.onPrimaryContainer }}>
              {userId ? `Connect ${healthSourceName}` : 'Sign in to OpenFit'}
            </ThemedText>
            <ThemedText style={{ color: theme.onPrimaryContainer }}>
              {Platform.OS === 'web' ? 'Use OpenFit on iPhone or Android to read device health data. Your workouts and account are available here.' : 'Read activity, sleep, heart, body and nutrition data from this phone for your dashboard and widgets. Choose what to allow on the next screen.'}
            </ThemedText>
            {authState === 'loading' ? (
              <LoadingDots color={theme.primary} />
            ) : (
              <Button mode="contained" disabled={Boolean(userId) && Platform.OS === 'web'} onPress={connect}>
                {userId ? `Choose ${healthSourceName} permissions` : 'Sign in'}
              </Button>
            )}
          </View>
          {error && <ErrorBanner message={error} />}
          <List.Accordion
            title="How your data is used"
            left={(props) => <List.Icon {...props} icon="shield-lock-outline" />}
            style={{
              backgroundColor: theme.surfaceContainer,
              borderRadius: 24,
            }}
          >
            <View style={styles.signInDisclosureBlock}>
              <ThemedText type="small" themeColor="textSecondary">
                Health records are read on your phone. They are not uploaded for the dashboard or widgets. You can separately choose to share a health summary with the coach through Cloudflare AI.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Clerk manages sign-in. Coach messages are encrypted and retained for up to 90 days. Voice recordings go to ElevenLabs only when you use voice input. OpenFit does not sell health data or share it with advertisers.
              </ThemedText>
            </View>
          </List.Accordion>
          <View style={styles.legalLinks}>
            {LEGAL_LINKS.map((link) => (
              <Link key={link.label} href={link.href} asChild>
                <Button mode="text">{link.label}</Button>
              </Link>
            ))}
          </View>
          {DEBUG_ENABLED && (
            <DebugPanel
              expanded={showDebug}
              onToggle={() => setShowDebug((v) => !v)}
              items={[
                { label: 'API server', value: getApiBaseUrl() },
              ]}
            />
          )}
        </View>
      </ScrollView>
    );
  }

  // ── Authenticated dashboard ──
  return (
    <View
      style={[
        styles.dashboardScreen,
        {
          backgroundColor: theme.background,
          paddingTop: 0,
          paddingBottom: 0,
        },
      ]}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === 'android' ? Spacing.four : Spacing.three,
            paddingBottom: Math.max(Spacing.six, insets.bottom + Spacing.six),
          },
        ]}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : 'never'}
      >
        <View style={styles.container}>
          {/* ── Header ── */}
          <Section index={0}>
            <View style={styles.headerBlock}>
              <View style={styles.headerTopRow}>
                <ThemedText
                  type="smallBold"
                  style={[styles.dateLabel, { color: theme.textSecondary }]}
                >
                  {todayStr}
                </ThemedText>
              </View>
              <ThemedText type="title">{greeting}</ThemedText>
            </View>
          </Section>

          {error && <ErrorBanner message={error} />}

          {/* ── Range segmented control ── */}
          <Section index={1}>
            <SegmentedButtons
              value={String(rangeDays)}
              onValueChange={(value) => {
                const option = RANGE_OPTIONS.find((item) => String(item.value) === value);
                if (option) updateRangeDays(option.value);
              }}
              buttons={RANGE_OPTIONS.map((option) => ({
                value: String(option.value),
                label: option.label,
                disabled: false,
              }))}
            />
          </Section>

          {/* ── Activity rings ── */}
          <Section index={2}>
            <SectionHeader
              title="Activity"
              trailing={
                <TextButton label="Edit" color={theme.text} onPress={() => setRingEditorSlot(0)} />
              }
            />
            <View style={[styles.ringsCard, { backgroundColor: theme.card }]}>
              <ActivityRings
                slots={ringSlots}
                days={rangeDays}
                editingSlot={ringEditorSlot}
                onEditSlot={setRingEditorSlot}
                onSelectMetric={selectRingMetric}
                onChangeGoal={changeRingGoal}
              />
            </View>
          </Section>

          {/* ── Metrics (user-curated cards) ── */}
          <Section index={3}>
            <SectionHeader
              title="Metrics"
              trailing={
                <TextButton
                  label="Edit"
                  color={theme.text}
                  onPress={() => setCardEditorOpen(true)}
                />
              }
            />
            {initialLoading ? (
              <View style={styles.metricGrid}>
                {[0, 1, 2, 3].map((slot) => (
                  <SkeletonCard key={slot} />
                ))}
              </View>
            ) : prefs.cards.length === 0 ? (
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
                Choose the health metrics you want to see.
              </ThemedText>
            ) : (
              <View style={styles.metricGrid}>
                {prefs.cards.map((id) => {
                  if (id === SLEEP_CARD_ID) {
                    return (
                      <Animated.View
                        key={id}
                        entering={FadeInDown.duration(350)}
                        exiting={FadeOut.duration(200)}
                        layout={LinearTransition.springify().damping(18)}
                        style={styles.sleepSlot}
                      >
                        <SleepCard sessions={snapshot?.sleepSessions ?? []} />
                      </Animated.View>
                    );
                  }

                  const def = getMetricDef(id);
                  return def ? (
                    <MetricCard key={id} def={def} metric={metricsMap[id]} days={rangeDays} />
                  ) : null;
                })}
              </View>
            )}
          </Section>

          <CardEditor
            visible={cardEditorOpen}
            selected={prefs.cards}
            onToggle={toggleCard}
            onClose={() => setCardEditorOpen(false)}
          />

          {DEBUG_ENABLED && <DebugPanel expanded={showDebug} onToggle={() => setShowDebug(v => !v)} items={[{ label: 'Health source', value: healthSourceName }, { label: 'Range', value: snapshot?.rangeLabel ?? '' }]} />}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Staggered entrance for dashboard sections — one orchestrated page load. */
function Section({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(index * 70)}
      style={{ gap: Spacing.three }}
    >
      {children}
    </Animated.View>
  );
}

function SectionHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {trailing}
    </View>
  );
}

function TextButton({
  label,
  onPress,
  disabled,
  color,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  color: string;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function DebugPanel({
  expanded,
  onToggle,
  items,
}: {
  expanded: boolean;
  onToggle: () => void;
  items: { label: string; value: string }[];
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: Spacing.two, alignSelf: 'stretch' }}>
      <Pressable onPress={onToggle} style={styles.debugToggle}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Connection details {expanded ? '▾' : '▸'}
        </ThemedText>
      </Pressable>

      {expanded && (
        <View style={[styles.debugPanel, { backgroundColor: theme.card }]}>
          {items.map((item) => (
            <View key={item.label} style={styles.configItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {item.label}
              </ThemedText>
              <ThemedText type="code" selectable>
                {item.value}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={styles.errorBanner}>
      <ThemedText type="smallBold" style={{ color: theme.error }}>
        Error
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.error }}>
        {message}
      </ThemedText>
    </View>
  );
}

// ─── Helpers (unchanged logic) ─────────────────────────────────────────────────

const RADIUS = 28;
const styles = StyleSheet.create({
  dashboardScreen: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    paddingTop: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  headerBlock: {
    gap: Spacing.half,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  dateLabel: {
    letterSpacing: 0,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconButton: {
    width: 48,
    height: 48,
    marginVertical: -Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 9,
    borderCurve: 'continuous',
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: 7,
    borderCurve: 'continuous',
  },
  ringsCard: {
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  sleepSlot: {
    minWidth: 140,
    flexGrow: 1,
    flexBasis: '40%',
  },
  googleSignInButton: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  errorBanner: {
    alignSelf: 'stretch',
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    gap: Spacing.half,
  },
  signInLoading: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutLogLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  debugToggle: {
    paddingVertical: Spacing.one,
    alignSelf: 'center',
  },
  debugPanel: {
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  configItem: {
    gap: Spacing.half,
  },
  signInScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.six,
    paddingBottom: Spacing.six * 3,
  },
  signInScroll: { flexGrow: 1, padding: 24, alignItems: 'center' },
  connectionCard: { borderRadius: 32, padding: 28, gap: 20 },
  signInContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
    paddingBottom: 24,
  },
  signInDisclosureBlock: {
    width: '100%',
    padding: 20,
    gap: 16,
  },
  signInDisclosure: {
    textAlign: 'center',
    lineHeight: 20,
  },
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
