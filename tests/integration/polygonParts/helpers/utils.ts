import { booleanEqual } from '@turf/boolean-equal';
import { feature, featureCollection } from '@turf/helpers';
import config from 'config';
import type { Polygon } from 'geojson';
import { isMatch } from 'lodash';
import type { ApplicationConfig } from '../../../../src/common/interfaces';
import { payloadToInsertPartsData } from '../../../../src/polygonParts/DAL/utils';
import type { FindPolygonPartsResponseBody } from '../../../../src/polygonParts/controllers/interfaces';
import type { PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';
import { INTERNAL_DB_GEOM_PRECISION } from './constants';
import type { ExpectedPostgresResponse } from './types';

const applicationConfig = config.get<ApplicationConfig>('application');

export const allFindFeaturesEqual = <T extends FindPolygonPartsResponseBody<ShouldClip>['features'][number], ShouldClip extends boolean = boolean>(
  expectedGeometries: Polygon[],
  expectedProperties?: Partial<T['properties']>[]
): ((feature: T) => boolean) => {
  return (feature) => {
    const index = expectedGeometries.findIndex((expectedGeometry, index) => {
      const geometryEquality = booleanEqual(feature.geometry, expectedGeometry, { precision: INTERNAL_DB_GEOM_PRECISION });
      const propertiesEquality = expectedProperties ? isMatch(feature.properties, expectedProperties[index]) : true;
      return geometryEquality && propertiesEquality;
    });
    if (index < 0) {
      return false;
    }
    const sucessfullyRemoveGeometry = expectedGeometries.splice(index, 1).length === 1;
    const sucessfullyRemoveProperty = expectedProperties ? expectedProperties.splice(index, 1).length === 1 : true;
    return sucessfullyRemoveGeometry && sucessfullyRemoveProperty;
  };
};

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
          id: expect.toBeUuidV4(),
          imagingTimeBeginUTC: imagingTimeBeginUTC.toISOString(),
          imagingTimeEndUTC: imagingTimeEndUTC.toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          ingestionDateUTC: expect.toBeDateString(),
          partId: expect.toBeUuidV4(),
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
