import { jsLogger } from '@map-colonies/js-logger';
import { JobTypes } from '@map-colonies/raster-shared';
import { trace } from '@opentelemetry/api';
import { multiPolygon, polygon } from '@turf/helpers';
import type { Feature, Polygon } from 'geojson';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';
import type { DataSourceOptions } from 'typeorm';
import { getApp } from '../../../src/app';
import { getConfigForTests, initConfigForTests } from '../../configurations/config';
import { ConnectionManager } from '../../../src/common/connectionManager';
import { SERVICES } from '../../../src/common/constants';
import type { DbConfig } from '../../../src/common/interfaces';
import { createConnectionOptions } from '../../../src/common/utils';
import { Transformer } from '../../../src/middlewares/transformer';
import type { ProcessPolygonPartsRequestBody } from '../../../src/polygonParts/controllers/interfaces';
import { History } from '../../../src/polygonParts/DAL/history';
import { PolygonPart } from '../../../src/polygonParts/DAL/polygonPart';
import { namingStrategy } from '../../../src/polygonParts/DAL/utils';
import { ValidatePart } from '../../../src/polygonParts/DAL/validationPart';
import type { EntitiesMetadata, EntityIdentifierObject, PolygonPartsPayload } from '../../../src/polygonParts/models/interfaces';
import { validValidationPolygonPartsPayload } from '../../mocks/requestsMocks';
import { HelperDB } from './helpers/db';
import type { InsertPayload } from './helpers/types';
import { PolygonPartsRequestSender } from './helpers/requestSender';
import { generatePolygonPartsPayload } from './helpers/utils';

let testDataSourceOptions: DataSourceOptions;

describe('process', () => {
  let requestSender: PolygonPartsRequestSender;
  let helperDB: HelperDB;
  let getEntitiesMetadata: (
    entityIdentifierOptions: EntityIdentifierObject | Pick<PolygonPartsPayload, 'productId' | 'productType'>
  ) => EntitiesMetadata;

  /**
   * Helper function to set up test tables with initial data
   * @param payload - Initial data payload to insert
   * @returns Object containing entity metadata and table names
   */
  const setupTestTablesWithInitialData = async (payload: InsertPayload) => {
    const entitiesMetadata = getEntitiesMetadata(payload);
    const polygonPartsTableName = entitiesMetadata.entitiesNames.polygonParts.entityName;
    const historyTableName = entitiesMetadata.entitiesNames.history.entityName;

    // Create polygon_parts and history tables
    await helperDB.createInheritedTable(polygonPartsTableName, 'polygon_parts');
    await helperDB.createInheritedTable(historyTableName, 'history');

    // Insert initial data directly into polygon_parts table
    await helperDB.insertPolygonPartsFromValidationPayload(polygonPartsTableName, payload);

    return {
      entitiesMetadata,
      polygonPartsTableName,
      historyTableName,
    };
  };

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

  describe('PUT /polygonParts/process', () => {
    describe('Happy Path', () => {
      describe('new product (creates tables)', () => {
        it('should process polygon parts from validation table and create polygon parts tables', async () => {
          const validateRequest = generatePolygonPartsPayload({ jobType: JobTypes.Ingestion_New });

          await requestSender.validatePolygonParts(validateRequest);
          const processRequest = {
            productId: validateRequest.productId,
            productType: validateRequest.productType,
          };

          const response = await requestSender.process(processRequest);

          const {
            entitiesNames: {
              history: { entityName: historyEntityName },
              polygonParts: { entityName: polygonPartsEntityName },
              validations: { entityName: validationsEntityName },
            },
          } = getEntitiesMetadata(processRequest);

          const polygonPartsTableExists = await helperDB.tableExists(polygonPartsEntityName);
          const polygonPartsData = await helperDB.getTableData(polygonPartsEntityName);
          const historyTableExists = await helperDB.tableExists(historyEntityName);
          const validationTableExists = await helperDB.tableExists(validationsEntityName);

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);
          expect(response).toSatisfyApiSpec();
          expect(polygonPartsTableExists).toBe(true);
          expect(polygonPartsData.length).toBeGreaterThan(0);
          expect(historyTableExists).toBe(true);
          expect(validationTableExists).toBeFalse();

          expect.assertions(6);
        });

        it('should handle MultiPolygon geometries by splitting them into individual polygons', async () => {
          const multiPolygonGeometry = multiPolygon([
            [
              [
                [0, 0],
                [0, 1],
                [1, 1],
                [1, 0],
                [0, 0],
              ],
            ],
            [
              [
                [2, 2],
                [2, 3],
                [3, 3],
                [3, 2],
                [2, 2],
              ],
            ],
          ]);

          const validateRequest = generatePolygonPartsPayload({
            jobType: JobTypes.Ingestion_New,
            partsData: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: multiPolygonGeometry.geometry }] },
          });

          await requestSender.validatePolygonParts(validateRequest);
          const processRequest = {
            productId: validateRequest.productId,
            productType: validateRequest.productType,
          };

          const response = await requestSender.process(processRequest);
          const entitiesMetadata = getEntitiesMetadata(processRequest);
          const historyData = await helperDB.getTableData(entitiesMetadata.entitiesNames.history.entityName);

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);
          expect(historyData).toHaveLength(2);

          expect.assertions(2);
        });

        it('should maintain insertion order when processing mixed Polygon and MultiPolygon geometries', async () => {
          const polygon1 = polygon([
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [1, 0],
              [0, 0],
            ],
          ]);

          const multiPoly1 = multiPolygon([
            [
              [
                [2, 2],
                [2, 3],
                [3, 3],
                [3, 2],
                [2, 2],
              ],
            ],
            [
              [
                [4, 4],
                [4, 5],
                [5, 5],
                [5, 4],
                [4, 4],
              ],
            ],
          ]);

          const polygon2 = polygon([
            [
              [6, 6],
              [6, 7],
              [7, 7],
              [7, 6],
              [6, 6],
            ],
          ]);

          const validateRequest = generatePolygonPartsPayload({
            productId: 'TEST_INSERTION_ORDER',
            jobType: JobTypes.Ingestion_New,
            partsData: {
              features: [
                {
                  type: 'Feature',
                  properties: {
                    ...validValidationPolygonPartsPayload.partsData.features[0].properties,
                    id: 'part-1',
                  },
                  geometry: polygon1.geometry,
                },
                {
                  type: 'Feature',
                  properties: {
                    ...validValidationPolygonPartsPayload.partsData.features[0].properties,
                    id: 'part-2',
                  },
                  geometry: multiPoly1.geometry,
                },
                {
                  type: 'Feature',
                  properties: {
                    ...validValidationPolygonPartsPayload.partsData.features[0].properties,
                    id: 'part-3',
                  },
                  geometry: polygon2.geometry,
                },
              ],
            },
          });

          await requestSender.validatePolygonParts(validateRequest);
          const processRequest = {
            productId: validateRequest.productId,
            productType: validateRequest.productType,
          };

          const response = await requestSender.process(processRequest);
          const entitiesMetadata = getEntitiesMetadata(processRequest);
          const historyData = (await helperDB.getTableDataWithGeoJSON(entitiesMetadata.entitiesNames.history.entityName)) as {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            insertion_order: number;
            // eslint-disable-next-line @typescript-eslint/naming-convention
            footprint_geojson: { type: string; coordinates: number[][][] };
          }[];

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);
          const { geometry, ...restMultiPolygon1 } = multiPoly1;
          const multiPolygonPart1: Feature<Polygon> = { ...restMultiPolygon1, geometry: { coordinates: geometry.coordinates[0], type: 'Polygon' } };
          const multiPolygonPart2: Feature<Polygon> = { ...restMultiPolygon1, geometry: { coordinates: geometry.coordinates[1], type: 'Polygon' } };
          const expectedResponse = [polygon1, multiPolygonPart1, multiPolygonPart2, polygon2].map((feature) => feature.geometry);
          expect(historyData.map((history) => history.footprint_geojson)).toStrictEqual(expectedResponse);

          expect.assertions(2);
        });
      });

      describe('existing product (shouldClearEntities: false)', () => {
        it('should add new data to existing polygon parts', async () => {
          const initialPayload = {
            productId: 'TEST_UPDATE',
            productType: validValidationPolygonPartsPayload.productType,
            catalogId: validValidationPolygonPartsPayload.catalogId,
            productVersion: validValidationPolygonPartsPayload.productVersion,
            partsData: {
              type: 'FeatureCollection' as const,
              features: [validValidationPolygonPartsPayload.partsData.features[0]],
            },
          };

          const { entitiesMetadata } = await setupTestTablesWithInitialData(initialPayload);

          const updateRequest = generatePolygonPartsPayload({
            productId: initialPayload.productId,
            productType: initialPayload.productType,
            productVersion: (parseInt(initialPayload.productVersion) + 1).toString(),
            jobType: JobTypes.Ingestion_Update,
            partsData: {
              features: [
                {
                  type: 'Feature',
                  properties: {
                    ...validValidationPolygonPartsPayload.partsData.features[0].properties,
                    id: 'update-part',
                  },
                  geometry: validValidationPolygonPartsPayload.partsData.features[0].geometry,
                },
              ],
            },
          });

          await requestSender.validatePolygonParts(updateRequest);
          const processRequest = {
            productId: updateRequest.productId,
            productType: updateRequest.productType,
          };

          const response = await requestSender.process(processRequest);
          const polygonPartsData = await helperDB.getTableData(entitiesMetadata.entitiesNames.polygonParts.entityName);
          const historyData = await helperDB.getTableData(entitiesMetadata.entitiesNames.history.entityName);

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);
          expect(polygonPartsData).toHaveLength(2);
          expect(historyData).toHaveLength(1);

          expect.assertions(3);
        });

        it('should add MultiPolygon data to existing polygon parts', async () => {
          const initialPayload = {
            productId: validValidationPolygonPartsPayload.productId,
            productType: validValidationPolygonPartsPayload.productType,
            catalogId: validValidationPolygonPartsPayload.catalogId,
            productVersion: validValidationPolygonPartsPayload.productVersion,
            partsData: {
              type: 'FeatureCollection' as const,
              features: [validValidationPolygonPartsPayload.partsData.features[0]],
            },
          };

          await setupTestTablesWithInitialData(initialPayload);

          const multiPolygonGeometry = multiPolygon([
            [
              [
                [10, 10],
                [10, 11],
                [11, 11],
                [11, 10],
                [10, 10],
              ],
            ],
            [
              [
                [20, 20],
                [20, 21],
                [21, 21],
                [21, 20],
                [20, 20],
              ],
            ],
          ]);

          const updateRequest = generatePolygonPartsPayload({
            productId: validValidationPolygonPartsPayload.productId,
            productType: validValidationPolygonPartsPayload.productType,
            productVersion: (parseInt(initialPayload.productVersion) + 1).toString(),
            jobType: JobTypes.Ingestion_Update,
            partsData: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: multiPolygonGeometry.geometry }] },
          });

          await requestSender.validatePolygonParts(updateRequest);
          const response = await requestSender.process({
            productId: updateRequest.productId,
            productType: updateRequest.productType,
          });

          const entitiesMetadata = getEntitiesMetadata(updateRequest);
          const historyData = (await helperDB.getTableDataWithGeoJSON(entitiesMetadata.entitiesNames.history.entityName)) as {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            insertion_order: number;
            // eslint-disable-next-line @typescript-eslint/naming-convention
            footprint_geojson: { type: string; coordinates: number[][][] };
          }[];
          const polygonPartsData = await helperDB.getTableData(entitiesMetadata.entitiesNames.polygonParts.entityName);

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);
          expect(historyData).toHaveLength(2);
          expect(polygonPartsData).toHaveLength(3);

          const { geometry, ...restMultiPolygon } = multiPolygonGeometry;
          const multiPolygonPart1: Feature<Polygon> = { ...restMultiPolygon, geometry: { coordinates: geometry.coordinates[0], type: 'Polygon' } };
          const multiPolygonPart2: Feature<Polygon> = { ...restMultiPolygon, geometry: { coordinates: geometry.coordinates[1], type: 'Polygon' } };
          const expectedResponse = [multiPolygonPart1, multiPolygonPart2].map((feature) => feature.geometry);
          expect(historyData.map((history) => history.footprint_geojson)).toStrictEqual(expectedResponse);

          expect.assertions(4);
        });
      });

      describe('existing product (shouldClearEntities: true)', () => {
        it('should replace existing polygon parts with new data', async () => {
          const initialPayload = {
            productId: 'TEST_SWAP',
            productType: validValidationPolygonPartsPayload.productType,
            catalogId: validValidationPolygonPartsPayload.catalogId,
            productVersion: validValidationPolygonPartsPayload.productVersion,
            partsData: {
              type: 'FeatureCollection' as const,
              features: [validValidationPolygonPartsPayload.partsData.features[0]],
            },
          };

          const { entitiesMetadata } = await setupTestTablesWithInitialData(initialPayload);

          const swapRequest = generatePolygonPartsPayload({
            productId: initialPayload.productId,
            productType: initialPayload.productType,
            productVersion: (parseInt(initialPayload.productVersion) + 1).toString(),
            jobType: JobTypes.Ingestion_Swap_Update,
            partsData: {
              type: 'FeatureCollection',
              features: [validValidationPolygonPartsPayload.partsData.features[0]],
            },
          });

          await requestSender.validatePolygonParts(swapRequest);
          const response = await requestSender.process({
            productId: swapRequest.productId,
            productType: swapRequest.productType,
            shouldClearEntities: true,
          });

          const polygonPartsData = await helperDB.getTableData(entitiesMetadata.entitiesNames.polygonParts.entityName);

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);
          expect(polygonPartsData).toHaveLength(1);

          expect.assertions(2);
        });

        it('should replace existing polygon parts with MultiPolygon data', async () => {
          const initialPayload = {
            productId: 'TEST_SWAP_MULTI',
            productType: validValidationPolygonPartsPayload.productType,
            catalogId: validValidationPolygonPartsPayload.catalogId,
            productVersion: validValidationPolygonPartsPayload.productVersion,
            partsData: {
              type: 'FeatureCollection' as const,
              features: [
                {
                  type: 'Feature' as const,
                  properties: validValidationPolygonPartsPayload.partsData.features[0].properties,
                  geometry: validValidationPolygonPartsPayload.partsData.features[0].geometry,
                },
              ],
            },
          };

          await setupTestTablesWithInitialData(initialPayload);

          const multiPolygonGeometry = multiPolygon([
            [
              [
                [30, 30],
                [30, 31],
                [31, 31],
                [31, 30],
                [30, 30],
              ],
            ],
            [
              [
                [40, 40],
                [40, 41],
                [41, 41],
                [41, 40],
                [40, 40],
              ],
            ],
            [
              [
                [50, 50],
                [50, 51],
                [51, 51],
                [51, 50],
                [50, 50],
              ],
            ],
          ]);

          const swapRequest = generatePolygonPartsPayload({
            productId: initialPayload.productId,
            productType: initialPayload.productType,
            productVersion: (parseInt(initialPayload.productVersion) + 1).toString(),
            jobType: JobTypes.Ingestion_Swap_Update,
            partsData: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: multiPolygonGeometry.geometry }] },
          });

          await requestSender.validatePolygonParts(swapRequest);
          const response = await requestSender.process({
            productId: swapRequest.productId,
            productType: swapRequest.productType,
            shouldClearEntities: true,
          });

          const entitiesMetadata = getEntitiesMetadata(swapRequest);
          const historyData = (await helperDB.getTableDataWithGeoJSON(entitiesMetadata.entitiesNames.history.entityName)) as {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            footprint_geojson: { type: string; coordinates: number[][][] };
            // eslint-disable-next-line @typescript-eslint/naming-convention
            product_version: string;
          }[];
          const polygonPartsData = await helperDB.getTableData(entitiesMetadata.entitiesNames.polygonParts.entityName);

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);
          expect(historyData).toHaveLength(3);
          expect(polygonPartsData).toHaveLength(3);

          // Verify old data was cleared - all parts should have the new product version
          expect(historyData.every((row) => row.product_version === (parseInt(initialPayload.productVersion) + 1).toString())).toBe(true);

          // Verify new data is from the multiPolygonGeometry (check coordinates match)
          const { geometry, ...restMultiPolygon } = multiPolygonGeometry;
          const multiPolygonPart1: Feature<Polygon> = { ...restMultiPolygon, geometry: { coordinates: geometry.coordinates[0], type: 'Polygon' } };
          const multiPolygonPart2: Feature<Polygon> = { ...restMultiPolygon, geometry: { coordinates: geometry.coordinates[1], type: 'Polygon' } };
          const multiPolygonPart3: Feature<Polygon> = { ...restMultiPolygon, geometry: { coordinates: geometry.coordinates[2], type: 'Polygon' } };
          const expectedResponse = [multiPolygonPart1, multiPolygonPart2, multiPolygonPart3].map((feature) => feature.geometry);
          expect(historyData.map((history) => history.footprint_geojson)).toStrictEqual(expectedResponse);

          expect.assertions(5);
        });
      });
    });

    describe('Bad Path', () => {
      it('should return 400 for invalid request body', async () => {
        const invalidRequest = {
          productId: validValidationPolygonPartsPayload.productId,
          // Missing productType
        };

        const response = await requestSender.process(invalidRequest as ProcessPolygonPartsRequestBody);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();

        expect.assertions(2);
      });

      it('should return 400 when productId is invalid', async () => {
        const validateRequest = generatePolygonPartsPayload({ jobType: JobTypes.Ingestion_New });
        await requestSender.validatePolygonParts(validateRequest);

        const invalidRequest = {
          productId: 'invalid id with spaces!',
          productType: validateRequest.productType,
        };

        const response = await requestSender.process(invalidRequest);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();

        expect.assertions(2);
      });

      it('should return 400 when productType is invalid', async () => {
        const validateRequest = generatePolygonPartsPayload({ jobType: JobTypes.Ingestion_New });
        await requestSender.validatePolygonParts(validateRequest);

        const invalidRequest = {
          productId: validateRequest.productId,
          productType: 'InvalidProductType',
        };

        const response = await requestSender.process(invalidRequest as ProcessPolygonPartsRequestBody);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();

        expect.assertions(2);
      });

      it('should return 400 when shouldClearEntities is not a boolean', async () => {
        const validateRequest = generatePolygonPartsPayload({ jobType: JobTypes.Ingestion_New });
        await requestSender.validatePolygonParts(validateRequest);

        const invalidRequest = {
          productId: validateRequest.productId,
          productType: validateRequest.productType,
          shouldClearEntities: 'yes' as unknown as boolean,
        };

        const response = await requestSender.process(invalidRequest);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();

        expect.assertions(2);
      });
    });

    describe('Sad Path', () => {
      it('should return 404 when validation table does not exist', async () => {
        const processRequest = {
          productId: validValidationPolygonPartsPayload.productId,
          productType: validValidationPolygonPartsPayload.productType,
        };

        const response = await requestSender.process(processRequest);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response).toSatisfyApiSpec();

        expect.assertions(2);
      });

      it('should return 404 when polygon parts table does not exist and shouldClearEntities is true', async () => {
        const validateRequest = generatePolygonPartsPayload({ jobType: JobTypes.Ingestion_New });

        await requestSender.validatePolygonParts(validateRequest);
        const processRequest = {
          productId: validateRequest.productId,
          productType: validateRequest.productType,
          shouldClearEntities: true,
        };

        const response = await requestSender.process(processRequest);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response).toSatisfyApiSpec();

        expect.assertions(2);
      });
    });
  });
});
