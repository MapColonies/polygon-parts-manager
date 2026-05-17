import { type PartFeatureProperties } from '@map-colonies/raster-shared';
import { booleanEqual } from '@turf/boolean-equal';
import { feature, featureCollection } from '@turf/helpers';
import config from 'config';
import type { Polygon } from 'geojson';
import { isMatch } from 'lodash';
import type { ApplicationConfig } from '../../../../src/common/interfaces';
import { payloadToInsertPartsDataToHistory } from '../../../../src/polygonParts/DAL/utils';
import type { FindPolygonPartsResponseBody, ValidatePolygonPartsRequestBody } from '../../../../src/polygonParts/controllers/interfaces';
import type { EntityIdentifier, PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';
import { INTERNAL_DB_GEOM_PRECISION } from './constants';
import { type PartialPolygonPartsPayload, generatePolygonPartsPayload as generatePolygonPartsValidationPayload } from './db';
import type { PolygonPartsRequestSender } from './requestSender';
import type { ExpectedPostgresResponse, GetEntitiesMetadata } from './types';

const getApplicationConfig = (): ApplicationConfig => config.get<ApplicationConfig>('application');

export type GeneratePolygonPartsPayloadOverrides = Partial<Omit<ValidatePolygonPartsRequestBody, 'partsData'>> & {
  partsData?: ValidatePolygonPartsRequestBody['partsData'];
  geometry?: ValidatePolygonPartsRequestBody['partsData']['features'][number]['geometry'];
  features?: ValidatePolygonPartsRequestBody['partsData']['features'];
};

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

export const insertInitialPolygonParts = async ({
  input,
  requestSender,
  getEntitiesMetadata,
}: {
  input: PartialPolygonPartsPayload;
  requestSender: PolygonPartsRequestSender;
  getEntitiesMetadata: GetEntitiesMetadata;
}): Promise<{ entityIdentifier: EntityIdentifier; maxResolutionDegree: number; minResolutionDegree: number }> => {
  const { partsData, ...layerMetadata } = generatePolygonPartsValidationPayload(input);
  const validatePartsData = structuredClone(partsData);
  const validateRequest: ValidatePolygonPartsRequestBody = { ...layerMetadata, jobType: 'Ingestion_New', partsData: validatePartsData };
  await requestSender.validatePolygonParts(validateRequest);
  const processRequest = {
    productId: validateRequest.productId,
    productType: validateRequest.productType,
  };
  const resolutionDegrees = validateRequest.partsData.features.map((feature) => feature.properties.resolutionDegree);
  const [maxResolutionDegree, minResolutionDegree] = [Math.max(...resolutionDegrees), Math.min(...resolutionDegrees)];
  const { entityIdentifier } = getEntitiesMetadata(processRequest);
  await requestSender.process(processRequest);
  return { entityIdentifier, maxResolutionDegree, minResolutionDegree };
};

export function toExpectedPostgresResponse(polygonPartsPayload: PolygonPartsPayload): ExpectedPostgresResponse {
  const expectedPostgresResponse = payloadToInsertPartsDataToHistory(polygonPartsPayload, getApplicationConfig().arraySeparator).map((record) => {
    const { cities = null, countries = null, description = null, sourceId = null, ...props } = record;
    return { cities, countries, description, sourceId, ...props };
  });

  return expectedPostgresResponse;
}

export function toExpectedFindPolygonPartsResponse(polygonPartsPayload: PolygonPartsPayload, duplicates = 1): FindPolygonPartsResponseBody {
  const { partsData, ...layerMetadata } = polygonPartsPayload;
  const expectedFeatures = partsData.features
    .map((partFeature) => {
      const partData: PartFeatureProperties = partFeature.properties;
      const { cities = null, countries = null, description = null, imagingTimeBeginUTC, imagingTimeEndUTC, sourceId = null, ...props } = partData;
      const footprint = partFeature.geometry;

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

  return featureCollection(expectedFeatures) as FindPolygonPartsResponseBody;
}
