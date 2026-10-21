import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFitnessConnections } from '@/hooks/use-fitness-connections';
import { useTheme } from '@/hooks/use-theme';
import { clerkSession } from '@/lib/clerk-session';
import type {
  ConnectableFitnessProviderId,
  FitnessConnectionSummary,
} from '@/lib/fitness-connections-contract';
import { FITNESS_PROVIDERS, type FitnessProvider } from '@/lib/fitness-providers';

const RADIUS = 16;

export function ConnectionsScreen() {
  const theme = useTheme();
  const [accountConnected, setAccountConnected] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);
  const fitnessConnections = useFitnessConnections(accountConnected);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      clerkSession()
        .then((session) => {
          if (active) setAccountConnected(Boolean(session?.user.id));
        })
        .catch(() => {
          if (active) setAccountConnected(false);
        })
        .finally(() => {
          if (active) setAccountLoading(false);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <Animated.View entering={FadeIn.duration(180)} style={styles.container}>
        {fitnessConnections.error ? (
          <View accessibilityRole="alert" style={styles.errorBanner}>
            <ThemedText selectable type="small" style={{ color: theme.error }}>
              {fitnessConnections.error}
            </ThemedText>
          </View>
        ) : null}

        {FITNESS_PROVIDERS.map((provider) => {
          const isDevice = provider.id === 'device-health';
          return (
            <ProviderCard
              key={provider.id}
              provider={provider}
              accountConnected={accountConnected}
              accountLoading={accountLoading}
              connection={
                isDevice
                  ? undefined
                  : fitnessConnections.connections.find((item) => item.provider === provider.id)
              }
              busy={!isDevice && fitnessConnections.busyProvider === provider.id}
              actionsBusy={fitnessConnections.operationInProgress}
              loading={!isDevice && fitnessConnections.loading}
              onConnect={fitnessConnections.connect}
              onDisconnect={fitnessConnections.disconnect}
              removeLocalAvailable={fitnessConnections.failedDisconnectProvider === provider.id}
              onRemoveLocal={fitnessConnections.removeLocal}
            />
          );
        })}
      </Animated.View>
    </ScrollView>
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
  const state = {
    connected,
    isDevice,
    loading,
    needsAccount,
    provider,
    connection,
    removeLocalAvailable,
    accountLoading,
  };
  const actionLabel = providerActionLabel({ ...state, busy });
  const statusLabel = providerStatusLabel(state);
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
          <ThemedText type="smallBold" style={{ color: connected ? theme.text : theme.background }}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

type ProviderState = {
  connected: boolean;
  isDevice: boolean;
  loading: boolean;
  needsAccount: boolean;
  provider: FitnessProvider;
  connection?: FitnessConnectionSummary;
  removeLocalAvailable: boolean;
  accountLoading: boolean;
};

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
}: ProviderState & { busy: boolean }) {
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
}: ProviderState) {
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
    gap: Spacing.two,
  },
  errorBanner: {
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
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
  flex: {
    flex: 1,
    gap: Spacing.half,
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
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
