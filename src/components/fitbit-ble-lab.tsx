import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { State } from 'react-native-ble-plx';

import { ThemedText } from '@/components/themed-text';
import { ErrorRed, MaxContentWidth, Spacing } from '@/constants/theme';
import { useFitbitBle } from '@/hooks/use-fitbit-ble';
import { useTheme } from '@/hooks/use-theme';
import { labelForUuid } from '@/lib/fitbit-ble-codec';
import type {
  BleState,
  CharacteristicSummary,
  LoadState,
  PermissionState,
} from '@/lib/fitbit-ble-types';

const RADIUS = 12;

export function FitbitBleLab() {
  const theme = useTheme();
  const {
    bleState,
    connectedDevice,
    connectionState,
    connectDevice,
    dataEvents,
    disconnect,
    message,
    permissionState,
    listState,
    services,
    sortedDevices,
    loadConnectedDevices,
  } = useFitbitBle();
  const statusColor =
    listState === 'error' || connectionState === 'error' || permissionState === 'denied'
      ? ErrorRed
      : theme.textSecondary;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.container}>
        <Section index={0}>
          <ThemedText type="title">Fitbit BLE Lab</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Direct BLE access depends on what the scale exposes over GATT.
          </ThemedText>
        </Section>

        <Section index={1}>
          <View style={styles.statusGrid}>
            <StatusTile title="Bluetooth" value={formatBleState(bleState)} />
            <StatusTile title="Permission" value={formatPermissionState(permissionState)} />
            <StatusTile title="Connection" value={formatLoadState(connectionState)} />
          </View>
          {message ? (
            <ThemedText type="small" style={{ color: statusColor }}>
              {message}
            </ThemedText>
          ) : null}
        </Section>

        <Section index={2}>
          <View style={styles.actionRow}>
            <ActionButton
              label={listState === 'loading' ? 'Loading...' : 'Refresh devices'}
              disabled={connectionState === 'loading' || listState === 'loading'}
              primary
              onPress={loadConnectedDevices}
            />
            <ActionButton
              label="Disconnect"
              disabled={!connectedDevice}
              onPress={() => void disconnect()}
            />
          </View>
        </Section>

        <Section index={3}>
          <SectionHeader title="Connected devices" trailing={null} />
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {sortedDevices.length > 0 ? (
              sortedDevices.map((device) => (
                <Pressable
                  key={device.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Connect to ${device.name}`}
                  disabled={connectionState === 'loading'}
                  onPress={() => void connectDevice(device)}
                  style={({ pressed }) => [
                    styles.deviceRow,
                    { borderColor: theme.separator },
                    pressed && styles.pressed,
                    connectedDevice?.id === device.id && {
                      backgroundColor: theme.backgroundSelected,
                    },
                  ]}
                >
                  <View style={styles.deviceMain}>
                    <View style={styles.deviceTitleRow}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {device.name}
                      </ThemedText>
                      {device.isLikelyFitbit ? (
                        <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
                          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                            Fitbit
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <ThemedText type="code" numberOfLines={1} style={{ color: theme.textSecondary }}>
                      {device.id}
                    </ThemedText>
                    {device.serviceUUIDs.length > 0 ? (
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {device.serviceUUIDs.map(labelForUuid).join(', ')}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              ))
            ) : (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {listState === 'loading' ? 'Loading connected BLE devices.' : 'Refresh to load devices connected to this phone.'}
              </ThemedText>
            )}
          </View>
        </Section>

        {connectedDevice ? (
          <Section index={4}>
            <SectionHeader title="GATT Profile" trailing={connectedDevice.name} />
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {connectionState === 'loading' ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Connecting and discovering services.
                </ThemedText>
              ) : null}
              {services.map((service) => (
                <View key={service.uuid} style={[styles.serviceBlock, { borderColor: theme.separator }]}>
                  <ThemedText type="smallBold">{service.label}</ThemedText>
                  <ThemedText type="code" style={{ color: theme.textSecondary }}>
                    {service.uuid}
                  </ThemedText>
                  <View style={styles.characteristics}>
                    {service.characteristics.map((characteristic) => (
                      <View
                        key={`${service.uuid}-${characteristic.uuid}`}
                        style={[styles.characteristicRow, { borderColor: theme.separator }]}
                      >
                        <View style={styles.characteristicMain}>
                          <ThemedText type="smallBold">{characteristic.label}</ThemedText>
                          <ThemedText type="code" style={{ color: theme.textSecondary }}>
                            {characteristic.uuid}
                          </ThemedText>
                          {characteristic.decodedText ? (
                            <ThemedText type="small">{characteristic.decodedText}</ThemedText>
                          ) : null}
                          {characteristic.valueHex ? (
                            <ThemedText type="code" numberOfLines={2} style={{ color: theme.textSecondary }}>
                              {characteristic.valueHex}
                            </ThemedText>
                          ) : null}
                          {characteristic.readError || characteristic.monitorError ? (
                            <ThemedText type="caption" style={{ color: ErrorRed }}>
                              {characteristic.readError ?? characteristic.monitorError}
                            </ThemedText>
                          ) : null}
                        </View>
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                          {formatProperties(characteristic)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        <Section index={5}>
          <SectionHeader title="Data Events" trailing={dataEvents.length ? String(dataEvents.length) : null} />
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {dataEvents.length > 0 ? (
              dataEvents.map((event) => (
                <View key={event.id} style={[styles.eventRow, { borderColor: theme.separator }]}>
                  <View style={styles.eventTitleRow}>
                    <ThemedText type="smallBold">{event.decodedText ?? event.characteristicLabel}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {event.source}
                    </ThemedText>
                  </View>
                  {event.details.map((detail) => (
                    <ThemedText key={detail} type="caption" style={{ color: theme.textSecondary }}>
                      {detail}
                    </ThemedText>
                  ))}
                  <ThemedText type="code" numberOfLines={2} style={{ color: theme.textSecondary }}>
                    {event.rawHex}
                  </ThemedText>
                </View>
              ))
            ) : (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Readable values and notifications will appear here.
              </ThemedText>
            )}
          </View>
        </Section>
      </View>
    </ScrollView>
  );
}

function Section({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(450).delay(index * 70)} style={{ gap: Spacing.three }}>
      {children}
    </Animated.View>
  );
}

function SectionHeader({ title, trailing }: { title: string; trailing?: string | null }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {trailing ? (
        <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary }}>
          {trailing}
        </ThemedText>
      ) : null}
    </View>
  );
}

function StatusTile({ title, value }: { title: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statusTile, { backgroundColor: theme.card }]}>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {title}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: primary ? theme.text : theme.card,
          borderColor: primary ? theme.text : theme.separator,
        },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <ThemedText type="smallBold" style={{ color: primary ? theme.background : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function formatProperties(characteristic: CharacteristicSummary) {
  const properties = [
    characteristic.isReadable ? 'read' : null,
    characteristic.isNotifiable ? 'notify' : null,
    characteristic.isIndicatable ? 'indicate' : null,
    characteristic.isWritableWithResponse || characteristic.isWritableWithoutResponse ? 'write' : null,
    characteristic.isMonitoring ? 'live' : null,
  ].filter(Boolean);
  return properties.length > 0 ? properties.join(', ') : 'locked';
}

function formatBleState(state: BleState) {
  if (state === State.PoweredOn) return 'On';
  if (state === State.PoweredOff) return 'Off';
  if (state === State.Unknown || state === State.Resetting) return 'Initializing';
  if (state === State.Unauthorized) return 'No Access';
  if (state === State.Unsupported) return 'Unsupported';
  if (state === 'Unavailable') return 'Unavailable';
  return String(state);
}

function formatPermissionState(state: PermissionState) {
  if (state === 'granted') return 'Granted';
  if (state === 'denied') return 'Denied';
  return Platform.OS === 'android' ? 'Needed' : 'System';
}

function formatLoadState(state: LoadState) {
  if (state === 'loading') return 'Working';
  if (state === 'loaded') return 'Connected';
  if (state === 'error') return 'Error';
  return 'Idle';
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    paddingTop: Spacing.four,
  },
  container: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.four },
  statusGrid: { flexDirection: 'row', gap: Spacing.two },
  statusTile: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
  },
  card: { gap: Spacing.two, borderRadius: RADIUS, borderCurve: 'continuous', padding: Spacing.three },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
  },
  deviceMain: { flex: 1, minWidth: 0, gap: Spacing.half },
  deviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: {
    borderRadius: 6,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  serviceBlock: {
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.three,
  },
  characteristics: { gap: Spacing.two },
  characteristicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  characteristicMain: { flex: 1, minWidth: 0, gap: Spacing.half },
  eventRow: {
    gap: Spacing.half,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.two,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
