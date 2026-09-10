import { useUser, useAuth } from '@clerk/expo';
import { Button, List } from 'react-native-paper';
import { Stack, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadDashboardPrefs } from '@/lib/dashboard-prefs';
import { clearSnapshotCache, setCachedSnapshot } from '@/lib/health-cache';
import { connectDeviceHealth, fetchHealthSnapshot, healthSourceName, openHealthSettings } from '@/lib/health-source';
import { clearHealthSession } from '@/lib/clear-health-session';
import { buildWidgetData, getWidgetMetricIds } from '@/lib/widget-data';
import { syncWidgets } from '@/lib/widget-sync';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user } = useUser();
  const router = useRouter();
  const { userId } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function refresh() {
    setBusy(true); setMessage(null);
    try {
      await connectDeviceHealth();
      clearSnapshotCache();
      const prefs = await loadDashboardPrefs();
      const snapshot = await fetchHealthSnapshot({ days: 1, metricIds: getWidgetMetricIds(prefs, { includeConfigurable: Platform.OS === 'ios' }) });
      setCachedSnapshot(1, snapshot);
      await syncWidgets(buildWidgetData(prefs, snapshot.metrics));
      setMessage('Health data and widgets refreshed. If data is missing, check permissions and the records in your health app.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true);
    try { await clearHealthSession(); setMessage('Device health disconnected from OpenFit. You can also revoke permissions in your health app.'); }
    catch (cause) { setMessage(String(cause)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Settings',
          headerBackTitle: 'Home',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.container}>
          <List.Item
            accessibilityRole="button"
            title={user ? user.fullName || 'Your account' : 'Sign in to OpenFit'}
            description={user?.primaryEmailAddress?.emailAddress}
            left={(props) => <List.Icon {...props} icon="account-circle-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/account')}
            style={{
              backgroundColor: theme.primaryContainer,
              borderRadius: 28,
            }}
          />

          {Platform.OS !== 'web' && <View style={{ gap: 16 }}>
            <ThemedText type="subtitle">{healthSourceName}</ThemedText>
            <Button mode="contained" loading={busy} disabled={busy || !userId} onPress={refresh}>Choose permissions and refresh</Button>
            <Button mode="outlined" disabled={busy} onPress={() => void openHealthSettings()}>Manage health permissions</Button>
            <Button disabled={busy} onPress={disconnect}>Disconnect device health</Button>
            {message && <ThemedText type="small" accessibilityRole="alert">{message}</ThemedText>}
          </View>}

          {__DEV__ && (
            <Section index={Platform.OS === 'ios' ? 4 : 3}>
              <SectionHeader
                title="Experimental"
                trailing={
                  <TextButton
                    label="Open"
                    color={theme.text}
                    onPress={() => router.push('/fitbit-ble' as Href)}
                  />
                }
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Fitbit Bluetooth lab"
                onPress={() => router.push('/fitbit-ble' as Href)}
                style={({ pressed }) => [
                  styles.bluetoothCard,
                  { backgroundColor: theme.card },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.bluetoothCopy}>
                  <ThemedText type="smallBold">Fitbit Bluetooth</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Inspect Aria Air devices connected to this phone.
                  </ThemedText>
                </View>
              </Pressable>
            </Section>
          )}

          <View
            style={{
              borderRadius: 28,
              overflow: 'hidden',
              backgroundColor: theme.surfaceContainer,
            }}
          >
            {(
              [
                {
                  title: 'Privacy',
                  href: '/privacy',
                  icon: 'shield-lock-outline',
                },
                {
                  title: 'Terms',
                  href: '/terms',
                  icon: 'file-document-outline',
                },
                {
                  title: 'Support',
                  href: '/support',
                  icon: 'help-circle-outline',
                },
              ] as const
            ).map((item) => (
              <List.Item
                accessibilityRole="button"
                key={item.href}
                title={item.title}
                left={(props) => <List.Icon {...props} icon={item.icon} />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => router.push(item.href)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

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
    <Button mode="text" textColor={color} disabled={disabled} onPress={onPress}>
      {label}
    </Button>
  );
}

const RADIUS = 12;

const styles = StyleSheet.create({
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  accountCopy: {
    minWidth: 0,
    flex: 1,
    gap: Spacing.half,
  },
  widgetsCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  widgetMetricPill: {
    minWidth: 0,
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  widgetMetricText: {
    minWidth: 0,
    flex: 1,
    gap: Spacing.half,
  },
  appleHealthCard: {
    gap: Spacing.three,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  appleHealthCopy: {
    gap: Spacing.half,
  },
  bluetoothCard: {
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  bluetoothCopy: {
    gap: Spacing.half,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
