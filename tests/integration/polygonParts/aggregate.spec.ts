import { faker } from '@faker-js/faker';
import { jsLogger } from '@map-colonies/js-logger';
import { degreesPerPixelToZoomLevel, zoomLevelToResolutionDeg } from '@map-colonies/mc-utils';
import { CORE_VALIDATIONS } from '@map-colonies/raster-shared';
import { trace } from '@opentelemetry/api';
import { featureCollection, multiPolygon, polygon, polygons } from '@turf/helpers';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';
import { type DataSourceOptions } from 'typeorm';
import { getApp } from '../../../src/app';
import { getConfigForTests, initConfigForTests } from '../../configurations/config';
import { ConnectionManager } from '../../../src/common/connectionManager';
import { SERVICES } from '../../../src/common/constants';
import type { DbConfig } from '../../../src/common/interfaces';
import { createConnectionOptions } from '../../../src/common/utils';
import { Transformer } from '../../../src/middlewares/transformer';
import { History } from '../../../src/polygonParts/DAL/history';
import { PolygonPart } from '../../../src/polygonParts/DAL/polygonPart';
import { namingStrategy } from '../../../src/polygonParts/DAL/utils';
import { ValidatePart } from '../../../src/polygonParts/DAL/validationPart';
import type { EntityIdentifier } from '../../../src/polygonParts/models/interfaces';
import { invalidGeometryTopologyTestCases } from '../../mocks/geometryTestCases';
import { HelperDB } from './helpers/db';
import { PolygonPartsRequestSender } from './helpers/requestSender';
import type { GetEntitiesMetadata } from './helpers/types';
import { generateResolutionDegree, ingestPolygonParts } from './helpers/utils';

let testDataSourceOptions: DataSourceOptions;

const seed = process.env.TEST_SEED ?? Math.floor(Math.random() * 1000000);
faker.seed(Number(seed));
console.info(`Test seed: ${seed}`);

describe('aggregate', () => {
  let requestSender: PolygonPartsRequestSender;
  let helperDB: HelperDB;
  let getEntitiesMetadata: GetEntitiesMetadata;

  beforeAll(async () => {
    await initConfigForTests();
    const dbConfig = getConfigForTests().get<Required<DbConfig>>('db');
    const { schema } = dbConfig;
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

    const [app] = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: await jsLogger({ enabled: false }) } },
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

  describe('POST /polygonParts/:polygonPartsEntityName/aggregate', () => {
    describe('Happy Path', () => {
      it.todo('should return 200 status code ...');
    });

    describe('Bad Path', () => {
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
          'should return 400 status code if polygon geometry inside a feature, inside a feature collection, inside filter property, in req body is an invalid value - $testCase',
          async ({ coordinates }) => {
            const response = await requestSender.aggregateLayerMetadata({
              params: { polygonPartsEntityName: entityIdentifier },
              body: {
                filter: {
                  type: 'FeatureCollection',
                  features: [
                    {
                      type: 'Feature',
                      properties: { resolutionDegree: generateResolutionDegree() },
                      geometry: polygon(coordinates).geometry,
                    },
                  ],
                },
              },
            });

            expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
            expect(response).toSatisfyApiSpec();
            expect.assertions(2);
          }
        );

        it.each(invalidGeometryTopologyTestCases)(
          'should return 400 status code if multi-polygon geometry inside a feature, inside a feature collection, inside a filter property, in req body is an invalid value - $testCase',
          async ({ coordinates }) => {
            const response = await requestSender.aggregateLayerMetadata({
              params: { polygonPartsEntityName: entityIdentifier },
              body: {
                filter: {
                  type: 'FeatureCollection',
                  features: [
                    {
                      type: 'Feature',
                      properties: { resolutionDegree: generateResolutionDegree() },
                      geometry: multiPolygon([coordinates]).geometry,
                    },
                  ],
                },
              },
            });

            expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
            expect(response).toSatisfyApiSpec();
            expect.assertions(2);
          }
        );

        it('should return 400 status code if geometry inside a feature, inside a feature collection, inside a filter property, in req body is an invalid value - multi-polygon parts must not overlap', async () => {
          const response = await requestSender.aggregateLayerMetadata({
            params: { polygonPartsEntityName: entityIdentifier },
            body: {
              filter: featureCollection([
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
            },
          });

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response).toSatisfyApiSpec();
          expect.assertions(2);
        });

        it('should return 400 status code if geometry inside a feature, inside a feature collection, inside a filter property, in req body is an invalid value - multi-polygon parts must not touch along a line', async () => {
          const response = await requestSender.aggregateLayerMetadata({
            params: { polygonPartsEntityName: entityIdentifier },
            body: {
              filter: featureCollection([
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
            },
          });

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response).toSatisfyApiSpec();
          expect.assertions(2);
        });

        it('should return 400 status code if geometry inside a feature, inside a feature collection, inside a filter property, in req body is an invalid value - polygon must have coordinates values in (-180,180) range', async () => {
          const response = await requestSender.aggregateLayerMetadata({
            params: { polygonPartsEntityName: entityIdentifier },
            body: {
              filter: polygons(
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
            },
          });

          expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
          expect(response).toSatisfyApiSpec();
          expect.assertions(2);
        });
      });
    });

    describe('Sad Path', () => {
      it.todo('should return 500 status code for a ...');
    });
  });
});
