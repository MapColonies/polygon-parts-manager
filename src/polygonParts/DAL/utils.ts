import config from 'config';
import type { ApplicationConfig } from '../../common/interfaces';
import type { UndefineProperties } from '../../common/types';
import type { CommonRecord, NonGeneratedCommonRecord, PolygonPartsPayload } from '../models/interfaces';

const arraySeparator = config.get<ApplicationConfig['arraySeparator']>('application.arraySeparator');

export function payloadToIngestionValues(polygonPartsPayload: PolygonPartsPayload): UndefineProperties<CommonRecord, 'ingestionDateUTC'>[] {
  return payloadToRecords(polygonPartsPayload).map((record) => {
    return { ...record, ingestionDateUTC: undefined };
  });
}

export function payloadToRecords(polygonPartsPayload: PolygonPartsPayload): NonGeneratedCommonRecord[] {
  const { partsData, ...layerMetadata } = polygonPartsPayload;

  return partsData.map((partData) => {
    return {
      ...layerMetadata,
      ...partData,
      sensors: partData.sensors.join(arraySeparator),
      countries: partData.countries?.join(arraySeparator),
      cities: partData.cities?.join(arraySeparator),
    };
  });
}
