import type { State } from 'react-native-ble-plx';

export type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
export type PermissionState = 'idle' | 'granted' | 'denied';
export type BleState = State | 'Unavailable';

export type ScannedDevice = {
  id: string;
  name: string;
  rssi: number | null;
  serviceUUIDs: string[];
  manufacturerData: string | null;
  rawScanRecord: string | null;
  isLikelyFitbit: boolean;
  lastSeenAt: number;
};

export type CharacteristicSummary = {
  uuid: string;
  label: string;
  isReadable: boolean;
  isWritableWithResponse: boolean;
  isWritableWithoutResponse: boolean;
  isNotifiable: boolean;
  isIndicatable: boolean;
  isMonitoring: boolean;
  valueBase64: string | null;
  valueHex: string | null;
  decodedText: string | null;
  readError: string | null;
  monitorError: string | null;
};

export type ServiceSummary = {
  uuid: string;
  label: string;
  characteristics: CharacteristicSummary[];
};

export type DataEvent = {
  id: string;
  receivedAt: number;
  source: 'read' | 'notify';
  serviceUUID: string;
  characteristicUUID: string;
  characteristicLabel: string;
  rawHex: string;
  decodedText: string | null;
  details: string[];
};

export type DecodedValue = {
  text: string;
  details: string[];
};

export type PendingDataEvent = {
  source: DataEvent['source'];
  serviceUUID: string;
  characteristicUUID: string;
  rawHex: string;
  decoded: DecodedValue | null;
};
