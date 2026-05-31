import { faker } from '@faker-js/faker';
import jsLogger from '@map-colonies/js-logger';
import { degreesPerPixelToZoomLevel, zoomLevelToResolutionDeg } from '@map-colonies/mc-utils';
import { CORE_VALIDATIONS } from '@map-colonies/raster-shared';
import { trace } from '@opentelemetry/api';
import { feature, featureCollection, multiPolygon, polygon, polygons } from '@turf/helpers';
import config from 'config';
import type { BBox, MultiPolygon, Polygon } from 'geojson';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { cloneDeep, get as getValue, merge, omit } from 'lodash';
import { xor } from 'martinez-polygon-clipping';
import { container } from 'tsyringe';
import { DataSource, type DataSourceOptions, SelectQueryBuilder } from 'typeorm';
import { getApp } from '../../../src/app';
import { ConnectionManager } from '../../../src/common/connectionManager';
import { SERVICES } from '../../../src/common/constants';
import type { ApplicationConfig, DbConfig } from '../../../src/common/interfaces';
import { createConnectionOptions } from '../../../src/common/utils';
import { Transformer } from '../../../src/middlewares/transformer';
import { History } from '../../../src/polygonParts/DAL/history';
import { PolygonPart } from '../../../src/polygonParts/DAL/polygonPart';
import { namingStrategy } from '../../../src/polygonParts/DAL/utils';
import { ValidatePart } from '../../../src/polygonParts/DAL/validationPart';
import type { IntersectionRequestBody, IntersectionResponseBody } from '../../../src/polygonParts/controllers/interfaces';
import type { EntityIdentifier } from '../../../src/polygonParts/models/interfaces';
import { invalidGeometryTopologyTestCases } from '../../mocks/geometryTestCases';
import { HelperDB } from './helpers/db';
import { PolygonPartsRequestSender } from './helpers/requestSender';
import type { DeepPartial, GetEntitiesMetadata } from './helpers/types';
import { generatePolygon, generateResolutionDegree, ingestPolygonParts } from './helpers/utils';

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
  let getEntitiesMetadata: GetEntitiesMetadata;

  beforeAll(async () => {
    testDataSourceOptions = {
      entities: [History, PolygonPart, ValidatePart],
      namingStrategy,
      ...createConnectionOptions(dbConfig),
    };
    helperDB = new HelperDB(testDataSourceOptions, schema);
    await helperDB.initConnection();
  });

  afterAll(async () => {
    try {
      await helperDB.destroyConnection();
    } catch (error) {
      console.error('Error destroying helperDB connection:', error);
    }
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
        const initialPolygonParts = await ingestPolygonParts({
          input: {
            partsData: {
              features: polygons,
            },
          },
          getEntitiesMetadata,
          requestSender,
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

      it('should return 200 status code and empty geometry when input polygon only shares an edge with a polygon part', async () => {
        // polygon1 occupies [-5,-5] to [5,5].
        // The request polygon starts at x=5 — touching polygon1 along that edge only.
        // ST_Intersection returns a LineString (zero area), which the
        // ST_GeometryType IN ('ST_Polygon','ST_MultiPolygon') filter discards.
        const request = featureCollection([
          polygon(
            [
              [
                [5, -5],
                [10, -5],
                [10, 5],
                [5, 5],
                [5, -5],
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

      it('should return 200 status code and empty geometry when input polygon produces a sliver (tiny) intersection', async () => {
        // polygon1 occupies [-5,-5] to [5,5].
        // The request polygon's left edge is at x = 4.999999999999999, which is the
        // largest IEEE 754 double less than 5 (ULP at 5 ≈ 8.88e-16). The intersection
        // sliver has width ≈ 8.88e-16 degrees and height 10 degrees → ST_Area ≈ 8.88e-15.
        // The ST_Area filter in unionedGeometriesCTE discards it → empty result.
        const request = featureCollection([
          polygon(
            [
              [
                [4.999999999999999, -5],
                [10, -5],
                [10, 5],
                [4.999999999999999, 5],
                [4.999999999999999, -5],
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
          const initialPolygonParts = await ingestPolygonParts({
            input: {
              partsData: {
                features: polygons,
              },
            },
            getEntitiesMetadata,
            requestSender,
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
        const initialPolygonParts = await ingestPolygonParts({
          input: {
            partsData: {
              features: polygons,
            },
          },
          getEntitiesMetadata,
          requestSender,
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

      it('should return 500 status code for a database error - input geometry validity query error', async () => {
        const expectedErrorMessage = 'geometry validity query error';
        const spyQuery = jest.spyOn(DataSource.prototype, 'query').mockRejectedValueOnce(new Error(expectedErrorMessage));

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
