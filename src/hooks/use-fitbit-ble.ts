import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  BleManager,
  fullUUID,
  State,
  type BleError,
  type Subscription,
} from 'react-native-ble-plx';

import {
  base64ToBytes,
  bytesToHex,
  decodeCharacteristicValue,
  labelForUuid,
  mergeBleDeviceSummary,
} from '@/lib/fitbit-ble-codec';
import { discoverGattProfile, updateCharacteristicSummary } from '@/lib/fitbit-ble-profile';
import type {
  BleState,
  DataEvent,
  LoadState,
  PendingDataEvent,
  PermissionState,
  BleDeviceSummary,
  ServiceSummary,
} from '@/lib/fitbit-ble-types';

const CONNECTED_LOOKUP_SERVICES = ['1800', '1801', '180a', '180f', '181b', '181d'].map(fullUUID);
const BLE_STATE_SETTLE_TIMEOUT_MS = 5_000;

export function useFitbitBle() {
  const managerRef = useRef<BleManager | null>(null);
  const monitorsRef = useRef<Subscription[]>([]);
  const connectedDeviceIdRef = useRef<string | null>(null);
  const eventCounterRef = useRef(0);
  const [bleState, setBleState] = useState<BleState>(State.Unknown);
  const [permissionState, setPermissionState] = useState<PermissionState>('idle');
  const [listState, setListState] = useState<LoadState>('idle');
  const [connectionState, setConnectionState] = useState<LoadState>('idle');
  const [devices, setDevices] = useState<Record<string, BleDeviceSummary>>({});
  const [connectedDevice, setConnectedDevice] = useState<BleDeviceSummary | null>(null);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [dataEvents, setDataEvents] = useState<DataEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const clearMonitors = useCallback(() => {
    for (const subscription of monitorsRef.current) {
      subscription.remove();
    }
    monitorsRef.current = [];
  }, []);

  const appendDataEvent = useCallback((event: PendingDataEvent) => {
    eventCounterRef.current += 1;
    const now = Date.now();
    const next: DataEvent = {
      id: `${now}-${eventCounterRef.current}`,
      receivedAt: now,
      source: event.source,
      serviceUUID: event.serviceUUID,
      characteristicUUID: event.characteristicUUID,
      characteristicLabel: labelForUuid(event.characteristicUUID),
      rawHex: event.rawHex,
      decodedText: event.decoded?.text ?? null,
      details: event.decoded?.details ?? [],
    };

    setDataEvents((current) => [next, ...current].slice(0, 30));
  }, []);

  useEffect(() => {
    let manager: BleManager;

    try {
      manager = new BleManager();
      managerRef.current = manager;
    } catch (error) {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) {
          setBleState('Unavailable');
          setMessage(formatBleError(error));
        }
      });
      return () => {
        cancelled = true;
      };
    }

    void manager
      .state()
      .then(setBleState)
      .catch((error) => {
        setBleState(State.Unknown);
        setMessage(formatBleError(error));
      });

    const stateSubscription = manager.onStateChange(setBleState);

    return () => {
      stateSubscription.remove();
      clearMonitors();

      if (connectedDeviceIdRef.current) {
        void manager.cancelDeviceConnection(connectedDeviceIdRef.current).catch(() => undefined);
      }

      void manager.destroy().catch(() => undefined);
      managerRef.current = null;
    };
  }, [clearMonitors]);

  const sortedDevices = useMemo(
    () =>
      Object.values(devices).sort((a, b) => {
        if (a.isLikelyFitbit !== b.isLikelyFitbit) {
          return a.isLikelyFitbit ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      }),
    [devices]
  );

  const loadConnectedDevices = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) {
      setMessage('Bluetooth module is not available in this build.');
      setListState('error');
      return;
    }

    setListState('loading');
    setMessage('Checking Bluetooth state.');

    const hasPermission = await requestBlePermissions();
    setPermissionState(hasPermission ? 'granted' : 'denied');
    if (!hasPermission) {
      setMessage('Bluetooth permission was denied.');
      setListState('error');
      return;
    }

    const currentState = await waitForReadyBleState(manager, bleState, setBleState);
    if (currentState !== State.PoweredOn) {
      setMessage(messageForBleState(currentState));
      setListState('error');
      return;
    }

    setMessage(null);
    setDevices({});

    try {
      const connected = await manager.connectedDevices(CONNECTED_LOOKUP_SERVICES);
      setDevices(
        connected.reduce<Record<string, BleDeviceSummary>>(
          (current, device) => mergeBleDeviceSummary(current, device),
          {}
        )
      );
      setListState('loaded');
      if (connected.length === 0) {
        setMessage('No connected BLE devices found. Connect the device in system Bluetooth settings first.');
      }
    } catch (error) {
      setMessage(formatBleError(error));
      setListState('error');
    }
  }, [bleState]);

  const disconnect = useCallback(async () => {
    const manager = managerRef.current;
    const deviceId = connectedDeviceIdRef.current;
    clearMonitors();

    if (manager && deviceId) {
      await manager.cancelDeviceConnection(deviceId).catch(() => undefined);
    }

    connectedDeviceIdRef.current = null;
    setConnectedDevice(null);
    setServices([]);
    setConnectionState('idle');
  }, [clearMonitors]);

  const connectDevice = useCallback(
    async (device: BleDeviceSummary) => {
      const manager = managerRef.current;
      if (!manager) {
        setMessage('Bluetooth module is not available in this build.');
        setConnectionState('error');
        return;
      }

      clearMonitors();
      setConnectionState('loading');
      setConnectedDevice(device);
      setServices([]);
      setDataEvents([]);
      setMessage(null);

      if (connectedDeviceIdRef.current && connectedDeviceIdRef.current !== device.id) {
        await manager.cancelDeviceConnection(connectedDeviceIdRef.current).catch(() => undefined);
      }

      try {
        const options =
          Platform.OS === 'android' ? { requestMTU: 247, timeout: 15_000 } : { timeout: 15_000 };
        const connected = await manager.connectToDevice(device.id, options);
        connectedDeviceIdRef.current = connected.id;
        const discovered = await connected.discoverAllServicesAndCharacteristics();
        const profile = await discoverGattProfile(
          await discovered.services(),
          appendDataEvent,
          formatBleError
        );

        setServices(profile.services);
        setConnectionState('loaded');

        for (const characteristic of profile.monitorableCharacteristics) {
          try {
            const subscription = characteristic.monitor((error, nextCharacteristic) => {
              if (error) {
                const monitorError = formatBleError(error);
                setMessage(monitorError);
                setServices((current) =>
                  updateCharacteristicSummary(
                    current,
                    characteristic.serviceUUID,
                    characteristic.uuid,
                    (summary) => ({ ...summary, monitorError })
                  )
                );
                return;
              }

              if (!nextCharacteristic?.value) {
                return;
              }

              const valueBase64 = nextCharacteristic.value;
              const decoded = decodeCharacteristicValue(nextCharacteristic.uuid, valueBase64);
              const valueHex = bytesToHex(base64ToBytes(valueBase64));
              appendDataEvent({
                source: 'notify',
                serviceUUID: characteristic.serviceUUID,
                characteristicUUID: nextCharacteristic.uuid,
                rawHex: valueHex,
                decoded,
              });
              setServices((current) =>
                updateCharacteristicSummary(
                  current,
                  characteristic.serviceUUID,
                  nextCharacteristic.uuid,
                  (summary) => ({
                    ...summary,
                    valueBase64,
                    valueHex,
                    decodedText: decoded?.text ?? null,
                  })
                )
              );
            });

            monitorsRef.current.push(subscription);
            setServices((current) =>
              updateCharacteristicSummary(
                current,
                characteristic.serviceUUID,
                characteristic.uuid,
                (summary) => ({ ...summary, isMonitoring: true, monitorError: null })
              )
            );
          } catch (error) {
            const monitorError = formatBleError(error);
            setServices((current) =>
              updateCharacteristicSummary(
                current,
                characteristic.serviceUUID,
                characteristic.uuid,
                (summary) => ({ ...summary, monitorError })
              )
            );
          }
        }
      } catch (error) {
        clearMonitors();
        await manager.cancelDeviceConnection(connectedDeviceIdRef.current ?? device.id).catch(() => undefined);
        connectedDeviceIdRef.current = null;
        setConnectedDevice(null);
        setServices([]);
        setConnectionState('error');
        setMessage(formatBleError(error));
      }
    },
    [appendDataEvent, clearMonitors]
  );

  return {
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
  };
}

async function requestBlePermissions() {
  if (Platform.OS !== 'android') {
    return true;
  }

  const apiLevel =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : Number.parseInt(String(Platform.Version), 10);
  if (apiLevel < 31) return true;
  const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  return status === PermissionsAndroid.RESULTS.GRANTED;
}

async function waitForReadyBleState(
  manager: BleManager,
  fallbackState: BleState,
  onStateChange: (state: State) => void
) {
  const currentState = await manager.state().catch(() => fallbackState);
  if (currentState !== 'Unavailable') {
    onStateChange(currentState);
  }
  if (currentState !== State.Unknown && currentState !== State.Resetting) {
    return currentState;
  }

  return new Promise<BleState>((resolve) => {
    let latestState: BleState = currentState;
    const timeout = setTimeout(() => {
      subscription.remove();
      resolve(latestState);
    }, BLE_STATE_SETTLE_TIMEOUT_MS);
    const subscription = manager.onStateChange((nextState) => {
      latestState = nextState;
      onStateChange(nextState);
      if (nextState !== State.Unknown && nextState !== State.Resetting) {
        clearTimeout(timeout);
        subscription.remove();
        resolve(nextState);
      }
    });
  });
}

function messageForBleState(state: BleState) {
  if (state === State.PoweredOff) return 'Turn on Bluetooth before loading connected devices.';
  if (state === State.Unauthorized) {
    return 'Bluetooth permission is off for OpenFit. Enable it in iOS Settings, then refresh the device list.';
  }
  if (state === State.Unsupported) return 'This device does not support Bluetooth LE.';
  if (state === State.Resetting || state === State.Unknown) {
    return 'Bluetooth is still initializing. Wait a moment, then refresh the device list.';
  }
  return 'Bluetooth is not available in this build.';
}

function formatBleError(error: unknown) {
  const bleError = error as Partial<BleError> | null;
  return (
    bleError?.reason ??
    bleError?.message ??
    (error instanceof Error ? error.message : String(error || 'Unknown Bluetooth error'))
  );
}
