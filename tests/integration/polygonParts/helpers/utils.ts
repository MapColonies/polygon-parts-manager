/* eslint-disable @typescript-eslint/no-magic-numbers */
import { faker } from '@faker-js/faker';
import {
  CORE_VALIDATIONS,
  INGESTION_VALIDATIONS,
  JobTypes,
  RASTER_PRODUCT_TYPE_LIST,
  type PartFeatureProperties,
  type RasterProductTypes,
} from '@map-colonies/raster-shared';
import { booleanEqual } from '@turf/boolean-equal';
import { feature, featureCollection } from '@turf/helpers';
import { randomPolygon } from '@turf/random';
import config from 'config';
import type { Feature, Polygon } from 'geojson';
import { isMatch } from 'lodash';
import { randexp } from 'randexp';
import type { ApplicationConfig } from '../../../../src/common/interfaces';
import { payloadToInsertPartsDataToHistory } from '../../../../src/polygonParts/DAL/utils';
import type {
  FindPolygonPartsResponseBody,
  ValidatePolygonPartsRequestBody
} from '../../../../src/polygonParts/controllers/interfaces';
import type { EntityIdentifier, PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';
import { INTERNAL_DB_GEOM_PRECISION } from './constants';
import type { PolygonPartsRequestSender } from './requestSender';
import type { ExpectedPostgresResponse, GetEntitiesMetadata, PartialPolygonPartsPayload, PolygonPartFeature } from './types';

const getApplicationConfig = (): ApplicationConfig => config.get<ApplicationConfig>('application');

const generateProductId = (): string => randexp(INGESTION_VALIDATIONS.productId.pattern);
const generateProductType = (): RasterProductTypes => faker.helpers.arrayElement(RASTER_PRODUCT_TYPE_LIST);

export const generateFeatureId = (): NonNullable<Feature['id']> => {
  return faker.helpers.arrayElement([faker.number.float({ max: Number.MAX_VALUE }), faker.string.uuid(), faker.string.alphanumeric({ length: 20 })]);
};

export const generateResolutionDegree = (): PolygonPartFeature['properties']['resolutionDegree'] =>
  faker.number.float(CORE_VALIDATIONS.resolutionDeg);

export const generatePolygon = (
  options: Parameters<typeof randomPolygon>[1] = {
    bbox: [-170, -80, 170, 80],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    max_radial_length: faker.number.float({ min: Number.EPSILON, max: 10 }),
  } // polygon maximum extent cannot exceed [-180,-90,180,90]
): Polygon => {
  return randomPolygon(1, options).features[0].geometry;
};

export const generatePolygonPart = (): PolygonPartFeature => {
  const date1 = faker.date.past();
  const date2 = faker.date.past();
  const [dateOlder, dateRecent] = date1 < date2 ? [date1, date2] : [date2, date1];
  return {
    type: 'Feature',
    id: generateFeatureId(),
    geometry: generatePolygon(),
    properties: {
      id: faker.string.uuid(),
      horizontalAccuracyCE90: faker.number.float(INGESTION_VALIDATIONS.horizontalAccuracyCE90),
      imagingTimeBeginUTC: dateOlder,
      imagingTimeEndUTC: dateRecent,
      resolutionDegree: generateResolutionDegree(),
      resolutionMeter: faker.number.float(INGESTION_VALIDATIONS.resolutionMeter),
      sensors: faker.helpers.multiple(
        () => {
          return faker.word.words();
        },
        { count: { min: 1, max: 3 } }
      ),
      sourceName: faker.word.words().replace(' ', '_'),
      sourceResolutionMeter: faker.number.float(INGESTION_VALIDATIONS.resolutionMeter),
      cities: faker.helpers.maybe(() => {
        return faker.helpers.multiple(
          () => {
            return faker.word.words();
          },
          { count: { min: 1, max: 3 } }
        );
      }),
      countries: faker.helpers.maybe(() => {
        return faker.helpers.multiple(
          () => {
            return faker.word.words();
          },
          { count: { min: 1, max: 3 } }
        );
      }),
      description: faker.helpers.maybe(() => faker.word.words({ count: { min: 0, max: 10 } })),
      sourceId: faker.helpers.maybe(() => faker.word.words()),
    },
  };
};

export function generatePolygonPartsPayload(partsCount?: number): PolygonPartsPayload;
export function generatePolygonPartsPayload(template?: PartialPolygonPartsPayload): PolygonPartsPayload;
export function generatePolygonPartsPayload(input?: number | PartialPolygonPartsPayload): PolygonPartsPayload {
  const layerMetadata = {
    catalogId: faker.string.uuid(),
    productId: generateProductId(),
    productType: generateProductType(),
    productVersion: randexp(INGESTION_VALIDATIONS.productVersion.pattern),
    jobType: faker.helpers.arrayElement([JobTypes.Ingestion_New, JobTypes.Ingestion_Update, JobTypes.Ingestion_Swap_Update]),
  } satisfies Omit<PolygonPartsPayload, 'partsData'>;

  if (typeof input === 'number' || input === undefined) {
    const partsCount = input ?? 1;
    return {
      ...layerMetadata,
      partsData: {
        type: 'FeatureCollection',
        features: Array.from({ length: partsCount }, generatePolygonPart),
      },
    };
  }

  const { partsData: templatePartsData, ...templateLayerMetadata } = structuredClone(input);
  const features = templatePartsData?.features;
  const featureCount = features?.length ?? 1;

  return {
    ...layerMetadata,
    ...templateLayerMetadata,
    partsData: {
      type: 'FeatureCollection',
      features: Array.from({ length: featureCount }, generatePolygonPart).map((partData, index) => {
        const templateFeature = features?.[index];

        if (!templateFeature) {
          return partData;
        }

        const feature = {
          ...partData,
          ...(templateFeature.id !== undefined && { id: templateFeature.id }),
          ...(templateFeature.geometry !== undefined && { geometry: templateFeature.geometry }),
          ...(templateFeature.properties !== undefined && {
            properties: {
              ...partData.properties,
              ...templateFeature.properties,
            },
          }),
        };

        return feature;
      }),
    },
  };
}

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
  const { partsData, ...layerMetadata } = generatePolygonPartsPayload(input);
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
