import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  BleManager,
  ScanMode,
  State,
  type BleError,
  type Subscription,
} from 'react-native-ble-plx';

import {
  base64ToBytes,
  bytesToHex,
  decodeCharacteristicValue,
  labelForUuid,
  mergeScannedDevice,
} from '@/lib/fitbit-ble-codec';
import { discoverGattProfile, updateCharacteristicSummary } from '@/lib/fitbit-ble-profile';
import type {
  BleState,
  DataEvent,
  LoadState,
  PendingDataEvent,
  PermissionState,
  ScannedDevice,
  ServiceSummary,
} from '@/lib/fitbit-ble-types';

const SCAN_TIMEOUT_MS = 15_000;
const BLE_STATE_SETTLE_TIMEOUT_MS = 5_000;

export function useFitbitBle() {
  const managerRef = useRef<BleManager | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monitorsRef = useRef<Subscription[]>([]);
  const connectedDeviceIdRef = useRef<string | null>(null);
  const eventCounterRef = useRef(0);
  const [bleState, setBleState] = useState<BleState>(State.Unknown);
  const [permissionState, setPermissionState] = useState<PermissionState>('idle');
  const [scanState, setScanState] = useState<LoadState>('idle');
  const [connectionState, setConnectionState] = useState<LoadState>('idle');
  const [devices, setDevices] = useState<Record<string, ScannedDevice>>({});
  const [connectedDevice, setConnectedDevice] = useState<ScannedDevice | null>(null);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [dataEvents, setDataEvents] = useState<DataEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const clearScanTimer = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }, []);

  const clearMonitors = useCallback(() => {
    for (const subscription of monitorsRef.current) {
      subscription.remove();
    }
    monitorsRef.current = [];
  }, []);

  const stopScan = useCallback(
    (nextState: LoadState = 'loaded') => {
      clearScanTimer();
      void managerRef.current?.stopDeviceScan().catch(() => undefined);
      setScanState(nextState);
    },
    [clearScanTimer]
  );

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
      clearScanTimer();
      clearMonitors();
      void manager.stopDeviceScan().catch(() => undefined);

      if (connectedDeviceIdRef.current) {
        void manager.cancelDeviceConnection(connectedDeviceIdRef.current).catch(() => undefined);
      }

      void manager.destroy().catch(() => undefined);
      managerRef.current = null;
    };
  }, [clearMonitors, clearScanTimer]);

  const sortedDevices = useMemo(
    () =>
      Object.values(devices).sort((a, b) => {
        if (a.isLikelyFitbit !== b.isLikelyFitbit) {
          return a.isLikelyFitbit ? -1 : 1;
        }
        return (b.rssi ?? -999) - (a.rssi ?? -999);
      }),
    [devices]
  );

  const startScan = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) {
      setMessage('Bluetooth module is not available in this build.');
      setScanState('error');
      return;
    }

    setScanState('loading');
    setMessage('Checking Bluetooth state.');

    const hasPermission = await requestBlePermissions();
    setPermissionState(hasPermission ? 'granted' : 'denied');
    if (!hasPermission) {
      setMessage('Bluetooth permission was denied.');
      setScanState('error');
      return;
    }

    const currentState = await waitForReadyBleState(manager, bleState, setBleState);
    if (currentState !== State.PoweredOn) {
      setMessage(messageForBleState(currentState));
      setScanState('error');
      return;
    }

    setMessage(null);
    setDevices({});
    manager.stopDeviceScan().catch(() => undefined);

    try {
      await manager.startDeviceScan(
        null,
        { allowDuplicates: false, scanMode: ScanMode.LowLatency },
        (error, device) => {
          if (error) {
            setMessage(formatBleError(error));
            stopScan('error');
          } else if (device) {
            setDevices((current) => mergeScannedDevice(current, device));
          }
        }
      );

      clearScanTimer();
      scanTimerRef.current = setTimeout(() => stopScan('loaded'), SCAN_TIMEOUT_MS);
    } catch (error) {
      setMessage(formatBleError(error));
      setScanState('error');
    }
  }, [bleState, clearScanTimer, stopScan]);

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
    async (device: ScannedDevice) => {
      const manager = managerRef.current;
      if (!manager) {
        setMessage('Bluetooth module is not available in this build.');
        setConnectionState('error');
        return;
      }

      stopScan('loaded');
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
    [appendDataEvent, clearMonitors, stopScan]
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
    scanState,
    services,
    sortedDevices,
    startScan,
    stopScan,
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
  const permissions =
    apiLevel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const statuses = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every((permission) => statuses[permission] === PermissionsAndroid.RESULTS.GRANTED);
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
  if (state === State.PoweredOff) return 'Turn on Bluetooth before scanning.';
  if (state === State.Unauthorized) {
    return 'Bluetooth permission is off for OpenFit. Enable it in iOS Settings, then scan again.';
  }
  if (state === State.Unsupported) return 'This device does not support Bluetooth LE scanning.';
  if (state === State.Resetting || state === State.Unknown) {
    return 'Bluetooth is still initializing. Wait a moment, then scan again.';
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
