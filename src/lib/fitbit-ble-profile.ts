import type { Characteristic, Service } from 'react-native-ble-plx';

import {
  base64ToBytes,
  bytesToHex,
  decodeCharacteristicValue,
  labelForUuid,
  shortUuid,
  WEIGHT_SCALE_SERVICE,
} from '@/lib/fitbit-ble-codec';
import type {
  CharacteristicSummary,
  PendingDataEvent,
  ServiceSummary,
} from '@/lib/fitbit-ble-types';

type DiscoveredGattProfile = {
  monitorableCharacteristics: Characteristic[];
  services: ServiceSummary[];
};

export async function discoverGattProfile(
  services: Service[],
  appendDataEvent: (event: PendingDataEvent) => void,
  formatError: (error: unknown) => string
): Promise<DiscoveredGattProfile> {
  const serviceSummaries: ServiceSummary[] = [];
  const monitorableCharacteristics: Characteristic[] = [];

  // BLE GATT reads are intentionally serialized: many peripherals only support
  // one outstanding operation, but each characteristic is discovered once.
  for (const service of services) {
    const characteristics = await service.characteristics();
    const summaries: CharacteristicSummary[] = [];

    for (const characteristic of characteristics) {
      summaries.push(
        await summarizeCharacteristic(service.uuid, characteristic, appendDataEvent, formatError)
      );
      if (characteristic.isNotifiable || characteristic.isIndicatable) {
        monitorableCharacteristics.push(characteristic);
      }
    }

    serviceSummaries.push({
      uuid: service.uuid,
      label: labelForUuid(service.uuid),
      characteristics: summaries.sort((a, b) => a.label.localeCompare(b.label)),
    });
  }

  return {
    monitorableCharacteristics,
    services: serviceSummaries.sort((a, b) => {
      if (shortUuid(a.uuid) === WEIGHT_SCALE_SERVICE) return -1;
      if (shortUuid(b.uuid) === WEIGHT_SCALE_SERVICE) return 1;
      return a.label.localeCompare(b.label);
    }),
  };
}

export function updateCharacteristicSummary(
  services: ServiceSummary[],
  serviceUUID: string,
  characteristicUUID: string,
  update: (summary: CharacteristicSummary) => CharacteristicSummary
) {
  return services.map((service) =>
    service.uuid === serviceUUID
      ? {
          ...service,
          characteristics: service.characteristics.map((characteristic) =>
            characteristic.uuid === characteristicUUID ? update(characteristic) : characteristic
          ),
        }
      : service
  );
}

async function summarizeCharacteristic(
  serviceUUID: string,
  characteristic: Characteristic,
  appendDataEvent: (event: PendingDataEvent) => void,
  formatError: (error: unknown) => string
): Promise<CharacteristicSummary> {
  let valueBase64 = characteristic.value;
  let valueHex = valueBase64 ? bytesToHex(base64ToBytes(valueBase64)) : null;
  let decoded = valueBase64 ? decodeCharacteristicValue(characteristic.uuid, valueBase64) : null;
  let readError: string | null = null;

  if (characteristic.isReadable) {
    try {
      const readCharacteristic = await characteristic.read();
      valueBase64 = readCharacteristic.value;
      valueHex = valueBase64 ? bytesToHex(base64ToBytes(valueBase64)) : null;
      decoded = valueBase64 ? decodeCharacteristicValue(characteristic.uuid, valueBase64) : null;

      if (valueHex) {
        appendDataEvent({
          source: 'read',
          serviceUUID,
          characteristicUUID: characteristic.uuid,
          rawHex: valueHex,
          decoded,
        });
      }
    } catch (error) {
      readError = formatError(error);
    }
  }

  return {
    uuid: characteristic.uuid,
    label: labelForUuid(characteristic.uuid),
    isReadable: characteristic.isReadable,
    isWritableWithResponse: characteristic.isWritableWithResponse,
    isWritableWithoutResponse: characteristic.isWritableWithoutResponse,
    isNotifiable: characteristic.isNotifiable,
    isIndicatable: characteristic.isIndicatable,
    isMonitoring: false,
    valueBase64,
    valueHex,
    decodedText: decoded?.text ?? null,
    readError,
    monitorError: null,
  };
}
