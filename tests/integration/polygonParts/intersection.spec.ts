import { faker } from '@faker-js/faker';
import jsLogger from '@map-colonies/js-logger';
import { degreesPerPixelToZoomLevel, zoomLevelToResolutionDeg } from '@map-colonies/mc-utils';
import { CORE_VALIDATIONS } from '@map-colonies/raster-shared';
import { trace } from '@opentelemetry/api';
import { feature, featureCollection, multiPolygon, polygon, polygons } from '@turf/helpers';
import config from 'config';
import { BBox, MultiPolygon, Polygon } from 'geojson';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { cloneDeep, get as getValue, merge, omit } from 'lodash';
import { xor } from 'martinez-polygon-clipping';
import { container } from 'tsyringe';
import { DataSource, DataSourceOptions, EntityManager, SelectQueryBuilder } from 'typeorm';
import { getApp } from '../../../src/app';
import { ConnectionManager } from '../../../src/common/connectionManager';
import { SERVICES } from '../../../src/common/constants';
import { ApplicationConfig, DbConfig } from '../../../src/common/interfaces';
import { createConnectionOptions } from '../../../src/common/utils';
import { Transformer } from '../../../src/middlewares/transformer';
import { History } from '../../../src/polygonParts/DAL/history';
import { PolygonPart } from '../../../src/polygonParts/DAL/polygonPart';
import { namingStrategy } from '../../../src/polygonParts/DAL/utils';
import { ValidatePart } from '../../../src/polygonParts/DAL/validationPart';
import { IntersectionRequestBody, IntersectionResponseBody, ValidatePolygonPartsRequestBody } from '../../../src/polygonParts/controllers/interfaces';
import { EntitiesMetadata, EntityIdentifier, EntityIdentifierObject, PolygonPartsPayload } from '../../../src/polygonParts/models/interfaces';
import { INITIAL_DB } from './helpers/constants';
import {
  HelperDB,
  PartialPolygonPartsPayload,
  createDB,
  generatePolygon,
  generatePolygonPartsPayload as generatePolygonPartsValidationPayload,
  generateResolutionDegree,
} from './helpers/db';
import { PolygonPartsRequestSender } from './helpers/requestSender';
import { DeepPartial } from './helpers/types';

type ConfigImport = typeof import('config') & { application: ApplicationConfig };

const mockGetConfig = jest.fn<{ application: DeepPartial<ApplicationConfig> } | undefined, [string]>();
jest.mock<{ default: ConfigImport }>('config', () => {
  const originalModule = jest.requireActual<ConfigImport>('config');
  return {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __esModule: true,
    default: {
      ...originalModule,
      get<T>(setting: string): T {
        const overrideConfig = mockGetConfig(setting);
        return getValue(merge({}, originalModule, overrideConfig), setting) as unknown as T;
      },
    },
  };
});
let testDataSourceOptions: DataSourceOptions;

const seed = process.env.TEST_SEED ?? Math.floor(Math.random() * 1000000);
faker.seed(Number(seed));
console.info(`Test seed: ${seed}`);

const dbConfig = config.get<Required<DbConfig>>('db');
const { schema } = dbConfig;

describe('intersection', () => {
  let requestSender: PolygonPartsRequestSender;
  let helperDB: HelperDB;
  let getEntitiesMetadata: (
    entityIdentifierOptions: EntityIdentifierObject | Pick<PolygonPartsPayload, 'productId' | 'productType'>
  ) => EntitiesMetadata;

  const insertInitialPolygonParts = async (
    input: PartialPolygonPartsPayload
  ): Promise<{ entityIdentifier: EntityIdentifier; maxResolutionDegree: number; minResolutionDegree: number }> => {
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

  beforeAll(async () => {
    testDataSourceOptions = {
      entities: [History, PolygonPart, ValidatePart],
      namingStrategy,
      ...createConnectionOptions(dbConfig),
    };
    await createDB({ options: testDataSourceOptions, initialDatabase: INITIAL_DB });
    helperDB = new HelperDB(testDataSourceOptions, schema);
    await helperDB.initConnection();
  });

  afterAll(async () => {
    try {
      await helperDB.destroyConnection();
    } catch (error) {
      console.error('Error destroying helperDB connection:', error);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    /* uncomment this when running locally, this deletes the created db after all tests,
    instead of removing it manually after each run.*/
    // try {
    //   await deleteDB(testDataSourceOptions);
    // } catch (error) {
    //   console.error('Error deleting database:', error);
    // }
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    await helperDB.createSchema();
    await helperDB.sync();
    container.clearInstances();
    const app = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    getEntitiesMetadata = container.resolve(Transformer).getEntitiesMetadata;
    requestSender = new PolygonPartsRequestSender(app);
  });

  afterEach(async () => {
    const connectionManager = container.resolve<ConnectionManager>(ConnectionManager);
    await connectionManager.destroy();
    await helperDB.dropSchema();
    jest.restoreAllMocks();
  });

  describe('POST /polygonParts/:polygonPartsEntityName/intersection', () => {
    describe('Happy Path', () => {
      let entityIdentifier: EntityIdentifier;
      let maxResolutionDegree: number;
      const { max: maxResolutionDeg, min: minResolutionDeg } = CORE_VALIDATIONS.resolutionDeg;

      beforeEach(async () => {
        const polygon1 = polygon(
          [
            [
              [-5, -5],
              [5, -5],
              [5, 5],
              [-5, 5],
              [-5, -5],
            ],
          ],
          {
            resolutionDegree: faker.number.float({
              max: maxResolutionDeg,
              min: zoomLevelToResolutionDeg(degreesPerPixelToZoomLevel(minResolutionDeg) - 1),
            }),
          }
        );
        const polygon2 = polygon(
          [
            [
              [-25, -25],
              [25, -25],
              [25, 25],
              [-25, 25],
              [-25, -25],
            ],
            [
              [-20, -20],
              [20, -20],
              [20, 20],
              [-20, 20],
              [-20, -20],
            ],
          ],
          {
            resolutionDegree: faker.number.float({
              max: maxResolutionDeg,
              min: zoomLevelToResolutionDeg(degreesPerPixelToZoomLevel(minResolutionDeg) - 1),
            }),
          }
        );
        const polygons = [polygon1, polygon2];
        const initialPolygonParts = await insertInitialPolygonParts({
          partsData: {
            features: polygons,
          },
        });
        entityIdentifier = initialPolygonParts.entityIdentifier;
        maxResolutionDegree = initialPolygonParts.maxResolutionDegree;
      });

      it('should return 200 status code and empty geometry with an input polygon which does not intersect polygon parts', async () => {
        const request = featureCollection([
          polygon(
            [
              [
                [-10, 10],
                [10, 10],
                [10, 20],
                [-10, 20],
                [-10, 10],
              ],
            ],
            { resolutionDegree: maxResolutionDegree }
          ),
        ]);

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: entityIdentifier },
          body: request,
        });

        const expected = featureCollection([]);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toStrictEqual(expected);
        expect(response).toSatisfyApiSpec();
        expect.assertions(3);
      });

      it('should return 200 status code and empty geometry with an input polygon which filter resolution degree does not match existing polygon parts', async () => {
        const request = featureCollection([
          polygon(
            [
              [
                [-10, 10],
                [10, 10],
                [10, 20],
                [-10, 20],
                [-10, 10],
              ],
            ],
            { resolutionDegree: minResolutionDeg }
          ),
        ]);

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: entityIdentifier },
          body: request,
        });

        const expected = featureCollection([]);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toStrictEqual(expected);
        expect(response).toSatisfyApiSpec();
        expect.assertions(3);
      });

      it('should return 200 status code and intersected polygon parts polygon geometry with an input polygon', async () => {
        const request = featureCollection([
          polygon(
            [
              [
                [-10, 0],
                [10, 0],
                [10, 10],
                [-10, 10],
                [-10, 0],
              ],
            ],
            { resolutionDegree: maxResolutionDegree }
          ),
        ]);

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: entityIdentifier },
          body: request,
        });

        const expected = featureCollection([
          polygon([
            [
              [-5, 0],
              [5, 0],
              [5, 5],
              [-5, 5],
              [-5, 0],
            ],
          ]),
        ]);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(omit(cloneDeep(response.body), ['features[0].geometry.coordinates'])).toStrictEqual(
          omit(cloneDeep(expected), ['features[0].geometry.coordinates'])
        );
        expect(
          xor((response.body as IntersectionResponseBody).features[0].geometry.coordinates, expected.features[0].geometry.coordinates)
        ).toHaveLength(0);
        expect(response).toSatisfyApiSpec();
        expect.assertions(4);
      });

      it('should return 200 status code and intersected polygon parts multi-polygon geometry with an input polygon', async () => {
        const request = featureCollection([
          polygon(
            [
              [
                [-10, 0],
                [10, 0],
                [10, 30],
                [-10, 30],
                [-10, 0],
              ],
            ],
            { resolutionDegree: maxResolutionDegree }
          ),
        ]);

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: entityIdentifier },
          body: request,
        });

        const expected = featureCollection([
          multiPolygon([
            [
              [
                [-5, 0],
                [5, 0],
                [5, 5],
                [-5, 5],
                [-5, 0],
              ],
            ],
            [
              [
                [-10, 20],
                [10, 20],
                [10, 25],
                [-10, 25],
                [-10, 20],
              ],
            ],
          ]),
        ]);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(omit(cloneDeep(response.body), ['features[0].geometry.coordinates'])).toStrictEqual(
          omit(cloneDeep(expected), ['features[0].geometry.coordinates'])
        );
        expect(
          xor((response.body as IntersectionResponseBody).features[0].geometry.coordinates, expected.features[0].geometry.coordinates)
        ).toHaveLength(0);
        expect(response).toSatisfyApiSpec();
        expect.assertions(4);
      });

      it('should return 200 status code and intersected polygon parts polygon geometry with an input multi-polygon', async () => {
        const request = featureCollection([
          multiPolygon(
            [
              [
                [
                  [-10, 0],
                  [10, 0],
                  [10, 30],
                  [-10, 30],
                  [-10, 0],
                ],
              ],
            ],
            { resolutionDegree: maxResolutionDegree }
          ),
        ]);

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: entityIdentifier },
          body: request,
        });

        const expected = featureCollection([
          multiPolygon([
            [
              [
                [-5, 0],
                [5, 0],
                [5, 5],
                [-5, 5],
                [-5, 0],
              ],
            ],
            [
              [
                [-10, 20],
                [10, 20],
                [10, 25],
                [-10, 25],
                [-10, 20],
              ],
            ],
          ]),
        ]);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(omit(cloneDeep(response.body), ['features[0].geometry.coordinates'])).toStrictEqual(
          omit(cloneDeep(expected), ['features[0].geometry.coordinates'])
        );
        expect(
          xor((response.body as IntersectionResponseBody).features[0].geometry.coordinates, expected.features[0].geometry.coordinates)
        ).toHaveLength(0);
        expect(response).toSatisfyApiSpec();
        expect.assertions(4);
      });

      it('should return 200 status code and intersected polygon parts multi-polygon geometry with an input multi-polygon', async () => {
        const request = featureCollection([
          multiPolygon(
            [
              [
                [
                  [-10, 20],
                  [10, 20],
                  [10, 30],
                  [-10, 30],
                  [-10, 20],
                ],
              ],
              [
                [
                  [-10, 0],
                  [10, 0],
                  [10, 10],
                  [-10, 10],
                  [-10, 0],
                ],
              ],
            ],
            { resolutionDegree: maxResolutionDegree }
          ),
        ]);

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: entityIdentifier },
          body: request,
        });

        const expected = featureCollection([
          multiPolygon([
            [
              [
                [-5, 0],
                [5, 0],
                [5, 5],
                [-5, 5],
                [-5, 0],
              ],
            ],
            [
              [
                [-10, 20],
                [10, 20],
                [10, 25],
                [-10, 25],
                [-10, 20],
              ],
            ],
          ]),
        ]);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(omit(cloneDeep(response.body), ['features[0].geometry.coordinates'])).toStrictEqual(
          omit(cloneDeep(expected), ['features[0].geometry.coordinates'])
        );
        expect(
          xor((response.body as IntersectionResponseBody).features[0].geometry.coordinates, expected.features[0].geometry.coordinates)
        ).toHaveLength(0);
        expect(response).toSatisfyApiSpec();
        expect.assertions(4);
      });
    });

    describe('Bad Path', () => {
      const polygon1 = polygon(
        [
          [
            [-5, -5],
            [5, -5],
            [5, 5],
            [-5, 5],
            [-5, -5],
          ],
        ],
        {
          resolutionDegree: generateResolutionDegree(),
        }
      );
      const validBody = featureCollection([polygon1]);

      it('should return 400 status code if polygonPartsEntityName is an invalid value - must follow a regex pattern (start with [a-z] char)', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: '0invalid_raster' as EntityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if polygonPartsEntityName is an invalid value - must follow a regex pattern (contain [a-z0-9_] characters inside)', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'invalid@name_raster' as EntityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if polygonPartsEntityName is an invalid value - must follow a regex pattern (end with [a-z] char or [0-9] digit)', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'invalid_' as EntityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if polygonPartsEntityName is an invalid value - must follow a regex pattern (not less than 2 chars)', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'a' as EntityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if polygonPartsEntityName is an invalid value - must follow a regex pattern (not more than 63 chars)', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'a'.repeat(64) as EntityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if polygonPartsEntityName is an invalid value - must end with raster product type', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'invalid_name' as EntityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if polygonPartsEntityName is an invalid value - must resolve to a valid resource identifier (no longer than 63 chars)', async () => {
        mockGetConfig.mockImplementation((setting: string) => {
          return setting === 'application'
            ? { application: { entities: { validations: { namePrefix: 'very_long_prefix_', nameSuffix: '_very_long_suffix' } } } }
            : undefined;
        });
        const connectionManager = container.resolve<ConnectionManager>(ConnectionManager);
        await connectionManager.destroy();
        container.clearInstances();
        const app = await getApp({
          override: [
            { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
            { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
          ],
          useChild: true,
        });
        requestSender = new PolygonPartsRequestSender(app);

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'very_long_valid_name_orthophoto' as EntityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature collection in req body is an invalid value - does not contain entry "type": "FeatureCollection"', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: { type: 'invalid', features: [polygon1] } as unknown as IntersectionRequestBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature collection in req body is an invalid value - does not contain entry for "features" property', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: { type: 'FeatureCollection' } as unknown as IntersectionRequestBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature collection in req body is an invalid value - "bbox" value must be an array with 4 or 6 items', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [polygon1],
            bbox: Array.from(
              {
                length: faker.helpers.arrayElement([
                  faker.helpers.rangeToNumber({ min: 0, max: 3 }),
                  faker.helpers.rangeToNumber({ min: 5, max: 10 }),
                ]),
              },
              () => faker.number.float()
            ),
          } as unknown as IntersectionRequestBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature collection in req body is an invalid value - "features" value must be an array with exactly 1 item', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: Array.from(
              {
                length: faker.helpers.arrayElement([
                  faker.helpers.rangeToNumber({ min: 0, max: 0 }),
                  faker.helpers.rangeToNumber({ min: 2, max: 10 }),
                ]),
              },
              () => feature(generatePolygon(), { resolutionDegree: generateResolutionDegree() })
            ),
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature inside a feature collection in req body is an invalid value - does not contain entry "type": "Feature"', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [{ type: 'invalid', properties: {}, geometry: generatePolygon() }],
          } as unknown as IntersectionRequestBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature inside a feature collection in req body is an invalid value - does not contain entry for "properties" property', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: generatePolygon() }],
          } as unknown as IntersectionRequestBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature inside a feature collection in req body is an invalid value - does not contain entry for "geometry" property', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: {} }],
          } as unknown as IntersectionRequestBody,
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature inside a feature collection in req body is an invalid value - "id" value must be a number or string', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                id: {} as unknown as string,
                properties: { resolutionDegree: generateResolutionDegree() },
                geometry: generatePolygon(),
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature inside a feature collection in req body is an invalid value - "properties" value must be an object', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: 'invalid' as unknown as IntersectionRequestBody['features'][number]['properties'],
                geometry: generatePolygon(),
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature inside a feature collection in req body is an invalid value - does not contain entry for "resolutionDegree" property', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {} as unknown as IntersectionRequestBody['features'][number]['properties'],
                geometry: generatePolygon(),
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature inside a feature collection in req body is an invalid value - "resolutionDegree" value must be a number', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { resolutionDegree: '' } as unknown as IntersectionRequestBody['features'][number]['properties'],
                geometry: generatePolygon(),
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature inside a feature collection in req body is an invalid value - "resolutionDegree" value must be a number in a range', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {
                  resolutionDegree: faker.helpers.arrayElement([
                    faker.number.float({ min: 0, max: CORE_VALIDATIONS.resolutionDeg.min }),
                    faker.number.float({ min: CORE_VALIDATIONS.resolutionDeg.max, max: Number.MAX_VALUE }),
                  ]),
                },
                geometry: generatePolygon(),
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature inside a feature collection in req body is an invalid value - "geometry" value must be an object', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { resolutionDegree: generateResolutionDegree() },
                geometry: null as unknown as Polygon | MultiPolygon,
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if feature inside a feature collection in req body is an invalid value - "bbox" value must be an array with 4 or 6 items', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { resolutionDegree: generateResolutionDegree() },
                geometry: generatePolygon(),
                bbox: Array.from(
                  {
                    length: faker.helpers.arrayElement([
                      faker.helpers.rangeToNumber({ min: 0, max: 3 }),
                      faker.helpers.rangeToNumber({ min: 5, max: 10 }),
                    ]),
                  },
                  () => faker.number.float()
                ) as BBox,
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if geometry inside a feature, inside a feature collection, in req body is an invalid value - does not contain entry "type": "Polygon" or "type": "MultiPolygon"', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { resolutionDegree: generateResolutionDegree() },
                geometry: {
                  type: 'Point',
                  coordinates: [0, 0],
                } as unknown as Polygon | MultiPolygon,
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if geometry inside a feature, inside a feature collection, in req body is an invalid value - does not contain entry for "coordinates" property', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { resolutionDegree: generateResolutionDegree() },
                geometry: {
                  type: 'Polygon',
                } as unknown as Polygon,
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if geometry inside a feature, inside a feature collection, in req body is an invalid value - "bbox" value must be an array with 4 or 6 items', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { resolutionDegree: generateResolutionDegree() },
                geometry: {
                  type: 'Polygon',
                  coordinates: [
                    [
                      [0, 0],
                      [1, 0],
                      [1, 1],
                      [0, 1],
                      [0, 0],
                    ],
                  ],
                  bbox: Array.from(
                    {
                      length: faker.helpers.arrayElement([
                        faker.helpers.rangeToNumber({ min: 0, max: 3 }),
                        faker.helpers.rangeToNumber({ min: 5, max: 10 }),
                      ]),
                    },
                    () => faker.number.float()
                  ) as BBox,
                } as unknown as Polygon,
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if geometry inside a feature, inside a feature collection, in req body is an invalid value - first and last vertices are not equal', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { resolutionDegree: generateResolutionDegree() },
                geometry: {
                  type: 'Polygon',
                  coordinates: [
                    [
                      [0, 0],
                      [1, 0],
                      [1, 1],
                      [0, 1],
                      [0, 0.1],
                    ],
                  ],
                },
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if geometry inside a feature, inside a feature collection, in req body is an invalid value - must have at least 3 vertices', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { resolutionDegree: generateResolutionDegree() },
                geometry: {
                  type: 'Polygon',
                  coordinates: [
                    [
                      [0, 0],
                      [1, 0],
                      [0, 0],
                    ],
                  ],
                },
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
        expect.assertions(2);
      });

      it('should return 400 status code if geometry inside a feature, inside a feature collection, in req body is an invalid value - hole must have at least 3 vertices', async () => {
        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: 'valid_name_orthophoto' as EntityIdentifier },
          body: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { resolutionDegree: generateResolutionDegree() },
                geometry: {
                  type: 'Polygon',
                  coordinates: [
                    [
                      [0, 0],
                      [2, 0],
                      [2, 2],
                      [0, 2],
                      [0, 0],
                    ],
                    [
                      [1, 1],
                      [1.5, 1],
                      [1, 1],
                    ],
                  ],
                },
              },
            ],
          },
        });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();

        expect.assertions(2);
      });

      const invalidGeometryTopologyTestCases = [
        {
          testCase: 'exterior ring must not cross itself',
          coordinates: [
            [
              [0, 0],
              [2, 0],
              [1, 1],
              [0, 2],
              [2, 2],
              [1, -1],
              [0, 0],
            ],
          ],
        },
        {
          testCase: 'exterior ring must not self-touch',
          coordinates: [
            [
              [0, 0],
              [2, 0],
              [1, 1],
              [1, 2],
              [1, 1],
              [0, 0],
            ],
          ],
        },
        {
          testCase: 'interior hole ring must not cross the exterior',
          coordinates: [
            [
              [0, 0],
              [3, 0],
              [3, 3],
              [0, 3],
              [0, 0],
            ],
            [
              [1, 1],
              [2, 1],
              [2, 4],
              [1, 4],
              [1, 1],
            ],
          ],
        },
        {
          testCase: 'interior hole rings must not cross each other',
          coordinates: [
            [
              [0, 0],
              [4, 0],
              [4, 4],
              [0, 4],
              [0, 0],
            ],
            [
              [1, 1],
              [2, 1],
              [2, 3],
              [1, 3],
              [1, 1],
            ],
            [
              [1, 1],
              [1, 2],
              [3, 2],
              [3, 1],
              [1, 1],
            ],
          ],
        },
        {
          testCase: 'interior hole ring must not touch the exterior ring along a line',
          coordinates: [
            [
              [0, 0],
              [3, 0],
              [3, 3],
              [0, 3],
              [0, 0],
            ],
            [
              [0, 1],
              [2, 1],
              [2, 2],
              [0, 2],
              [0, 1],
            ],
          ],
        },
        {
          testCase: 'interior hole rings must not touch each other along a line',
          coordinates: [
            [
              [0, 0],
              [4, 0],
              [4, 4],
              [0, 4],
              [0, 0],
            ],
            [
              [1, 1],
              [2, 1],
              [2, 2],
              [1, 2],
              [1, 1],
            ],
            [
              [2, 1],
              [3, 1],
              [3, 2],
              [2, 2],
              [2, 1],
            ],
          ],
        },
        {
          testCase: 'interior hole rings must be contained in exterior ring',
          coordinates: [
            [
              [0, 0],
              [2, 0],
              [2, 2],
              [0, 2],
              [0, 0],
            ],
            [
              [3, 3],
              [4, 3],
              [4, 4],
              [3, 4],
              [3, 3],
            ],
          ],
        },
        {
          testCase: 'interior hole rings must not split the geometry into more than one part',
          coordinates: [
            [
              [0, 0],
              [4, 0],
              [4, 4],
              [0, 4],
              [0, 0],
            ],
            [
              [2, 1],
              [4, 2],
              [0, 2],
              [2, 1],
            ],
          ],
        },
      ] satisfies { testCase: string; coordinates: Polygon['coordinates'] }[];

      describe('topological error', () => {
        let entityIdentifier: EntityIdentifier;
        const { max: maxResolutionDeg, min: minResolutionDeg } = CORE_VALIDATIONS.resolutionDeg;

        beforeEach(async () => {
          const polygon1 = polygon(
            [
              [
                [-5, -5],
                [5, -5],
                [5, 5],
                [-5, 5],
                [-5, -5],
              ],
            ],
            {
              resolutionDegree: faker.number.float({
                max: maxResolutionDeg,
                min: zoomLevelToResolutionDeg(degreesPerPixelToZoomLevel(minResolutionDeg) - 1),
              }),
            }
          );
          const polygon2 = polygon(
            [
              [
                [-25, -25],
                [25, -25],
                [25, 25],
                [-25, 25],
                [-25, -25],
              ],
              [
                [-20, -20],
                [20, -20],
                [20, 20],
                [-20, 20],
                [-20, -20],
              ],
            ],
            {
              resolutionDegree: faker.number.float({
                max: maxResolutionDeg,
                min: zoomLevelToResolutionDeg(degreesPerPixelToZoomLevel(minResolutionDeg) - 1),
              }),
            }
          );
          const polygons = [polygon1, polygon2];
          const initialPolygonParts = await insertInitialPolygonParts({
            partsData: {
              features: polygons,
            },
          });
          entityIdentifier = initialPolygonParts.entityIdentifier;
        });

        it.each(invalidGeometryTopologyTestCases)(
          'should return 400 status code if polygon geometry inside a feature, inside a feature collection, in req body is an invalid value - $testCase',
          async ({ coordinates }) => {
            const response = await requestSender.intersection({
              params: { polygonPartsEntityName: entityIdentifier },
              body: {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: { resolutionDegree: generateResolutionDegree() },
                    geometry: polygon(coordinates).geometry,
                  },
                ],
              },
            });

            expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
            expect(response).toSatisfyApiSpec();
            expect.assertions(2);
          }
        );

        it.each(invalidGeometryTopologyTestCases)(
          'should return 400 status code if multi-polygon geometry inside a feature, inside a feature collection, in req body is an invalid value - $testCase',
          async ({ coordinates }) => {
            const response = await requestSender.intersection({
              params: { polygonPartsEntityName: entityIdentifier },
              body: {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: { resolutionDegree: generateResolutionDegree() },
                    geometry: multiPolygon([coordinates]).geometry,
                  },
                ],
              },
            });

            expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
            expect(response).toSatisfyApiSpec();
            expect.assertions(2);
          }
        );

        it('should return 400 status code if geometry inside a feature, inside a feature collection, in req body is an invalid value - multi-polygon parts must not overlap', async () => {
          const response = await requestSender.intersection({
            params: { polygonPartsEntityName: entityIdentifier },
            body: featureCollection([
              multiPolygon(
                [
                  [
                    [
                      [0, 0],
                      [2, 0],
                      [2, 2],
                      [0, 2],
                      [0, 0],
                    ],
                  ],
                  [
                    [
                      [0, 1],
                      [2, 1],
                      [2, 3],
                      [0, 3],
                      [0, 1],
                    ],
                  ],
                ],
                { resolutionDegree: generateResolutionDegree() }
              ),
            ]),
          });

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response).toSatisfyApiSpec();
          expect.assertions(2);
        });

        it('should return 400 status code if geometry inside a feature, inside a feature collection, in req body is an invalid value - multi-polygon parts must not touch along a line', async () => {
          const response = await requestSender.intersection({
            params: { polygonPartsEntityName: entityIdentifier },
            body: featureCollection([
              multiPolygon(
                [
                  [
                    [
                      [0, 0],
                      [2, 0],
                      [2, 2],
                      [0, 2],
                      [0, 0],
                    ],
                  ],
                  [
                    [
                      [2, 0],
                      [4, 0],
                      [2, 1],
                      [2, 0],
                    ],
                  ],
                ],
                { resolutionDegree: generateResolutionDegree() }
              ),
            ]),
          });

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response).toSatisfyApiSpec();
          expect.assertions(2);
        });

        it('should return 400 status code if geometry inside a feature, inside a feature collection, in req body is an invalid value - polygon must have coordinates values in (-180,180) range', async () => {
          const response = await requestSender.intersection({
            params: { polygonPartsEntityName: entityIdentifier },
            body: polygons(
              [
                [
                  [
                    [0, 0],
                    [180, 0],
                    [180 + 0.1, 90],
                    [0, 0],
                  ],
                ],
              ],
              { resolutionDegree: generateResolutionDegree() }
            ),
          });

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response).toSatisfyApiSpec();
          expect.assertions(2);
        });
      });
    });

    describe('Sad Path', () => {
      let entityIdentifier: EntityIdentifier;
      const { max: maxResolutionDeg, min: minResolutionDeg } = CORE_VALIDATIONS.resolutionDeg;

      beforeEach(async () => {
        const polygon1 = polygon(
          [
            [
              [-5, -5],
              [5, -5],
              [5, 5],
              [-5, 5],
              [-5, -5],
            ],
          ],
          {
            resolutionDegree: faker.number.float({
              max: maxResolutionDeg,
              min: zoomLevelToResolutionDeg(degreesPerPixelToZoomLevel(minResolutionDeg) - 1),
            }),
          }
        );
        const polygon2 = polygon(
          [
            [
              [-25, -25],
              [25, -25],
              [25, 25],
              [-25, 25],
              [-25, -25],
            ],
            [
              [-20, -20],
              [20, -20],
              [20, 20],
              [-20, 20],
              [-20, -20],
            ],
          ],
          {
            resolutionDegree: faker.number.float({
              max: maxResolutionDeg,
              min: zoomLevelToResolutionDeg(degreesPerPixelToZoomLevel(minResolutionDeg) - 1),
            }),
          }
        );
        const polygons = [polygon1, polygon2];
        const initialPolygonParts = await insertInitialPolygonParts({
          partsData: {
            features: polygons,
          },
        });
        entityIdentifier = initialPolygonParts.entityIdentifier;
      });

      const polygon1 = polygon(
        [
          [
            [-5, -5],
            [5, -5],
            [5, 5],
            [-5, 5],
            [-5, -5],
          ],
        ],
        {
          resolutionDegree: generateResolutionDegree(),
        }
      );
      const validBody = featureCollection([polygon1]);

      it('should return 404 status code if a polygon part resource does not exists', async () => {
        const polygonPartsEntityName = 'very_long_valid_name_orthophoto';

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toMatchObject({ message: `Table with the name '${polygonPartsEntityName}' doesn't exists` });
        expect(response).toSatisfyApiSpec();
        expect.assertions(3);
      });

      it('should return 500 status code for a database error - transaction error', async () => {
        const expectedErrorMessage = 'transaction error';
        const spyQuery = jest.spyOn(DataSource.prototype, 'transaction').mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: entityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
        expect(response).toSatisfyApiSpec();
        expect(spyQuery).toHaveBeenCalledTimes(1);
        expect.assertions(4);
      });

      it('should return 500 status code for a database error - entity exists check query error', async () => {
        const expectedErrorMessage = 'entity exists error';
        const spyQuery = jest.spyOn(SelectQueryBuilder.prototype, 'getExists').mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: entityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
        expect(response).toSatisfyApiSpec();
        expect(spyQuery).toHaveBeenCalledTimes(1);
        expect.assertions(4);
      });

      it('should return 500 status code for a database error - geometry validity check query error', async () => {
        const expectedErrorMessage = 'geometry validity error';
        const spyQuery = jest.spyOn(EntityManager.prototype, 'query').mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: entityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
        expect(response).toSatisfyApiSpec();
        expect(spyQuery).toHaveBeenCalledTimes(1);
        expect.assertions(4);
      });

      it('should return 500 status code for a database error - intersection query error', async () => {
        const expectedErrorMessage = 'intersection query error';
        const spyGetRawOne = jest.spyOn(SelectQueryBuilder.prototype, 'getRawOne').mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: entityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
        expect(response).toSatisfyApiSpec();
        expect(spyGetRawOne).toHaveBeenCalledTimes(1);
        expect.assertions(4);
      });

      it('should return 500 status code for a database error - find polygon parts query unexpected empty response', async () => {
        const expectedErrorMessage = 'Could not generate response';
        const spyGetRawOne = jest.spyOn(SelectQueryBuilder.prototype, 'getRawOne').mockResolvedValueOnce(undefined);

        const response = await requestSender.intersection({
          params: { polygonPartsEntityName: entityIdentifier },
          body: validBody,
        });

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
        expect(response).toSatisfyApiSpec();
        expect(spyGetRawOne).toHaveBeenCalledTimes(1);
        expect.assertions(4);
      });
    });
  });
});
