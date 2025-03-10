import { feature, featureCollection } from '@turf/helpers';
import config from 'config';
import type { ApplicationConfig } from '../../../../src/common/interfaces';
import { payloadToInsertPartsData } from '../../../../src/polygonParts/DAL/utils';
import type { FindPolygonPartsResponseBody } from '../../../../src/polygonParts/controllers/interfaces';
import type { PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';
import type { ExpectedPostgresResponse } from './types';

const applicationConfig = config.get<ApplicationConfig>('application');

export function toExpectedPostgresResponse(polygonPartsPayload: PolygonPartsPayload): ExpectedPostgresResponse {
  const expectedPostgresResponse = payloadToInsertPartsData(polygonPartsPayload, applicationConfig.arraySeparator).map((record) => {
    const { cities = null, countries = null, description = null, sourceId = null, ...props } = record;
    return { cities, countries, description, sourceId, ...props };
  });

  return expectedPostgresResponse;
}

export function toExpectedFindPolygonPartsResponse(polygonPartsPayload: PolygonPartsPayload, duplicates = 1): FindPolygonPartsResponseBody {
  const { partsData, ...layerMetadata } = polygonPartsPayload;
  const expectedFeatures = partsData
    .map((partData) => {
      const {
        cities = null,
        countries = null,
        description = null,
        footprint,
        imagingTimeBeginUTC,
        imagingTimeEndUTC,
        sourceId = null,
        ...props
      } = partData;

      return Array.from({ length: duplicates }, () =>
        feature(footprint, {
          ...layerMetadata,
          ...props,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          id: expect.toBeUuidV4(),
          imagingTimeBeginUTC: imagingTimeBeginUTC.toISOString(),
          imagingTimeEndUTC: imagingTimeEndUTC.toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          ingestionDateUTC: expect.toBeDateString(),
          cities,
          countries,
          description,
          sourceId,
        })
      );
    })
    .flat();

  const expectedPostgresResponse = featureCollection(expectedFeatures);
  return expectedPostgresResponse;
}
