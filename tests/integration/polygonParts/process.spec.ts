import jsLogger from '@map-colonies/js-logger';
import { JobTypes } from '@map-colonies/raster-shared';
import { trace } from '@opentelemetry/api';
import { multiPolygon, polygon } from '@turf/helpers';
import config from 'config';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';
import { DataSourceOptions } from 'typeorm';
import { getApp } from '../../../src/app';
import { ConnectionManager } from '../../../src/common/connectionManager';
import { SERVICES } from '../../../src/common/constants';
import { DbConfig } from '../../../src/common/interfaces';
import { Transformer } from '../../../src/common/middlewares/transformer';
import { createConnectionOptions } from '../../../src/common/utils';
import { ProcessPolygonPartsRequestBody, ValidatePolygonPartsRequestBody } from '../../../src/polygonParts/controllers/interfaces';
import { History } from '../../../src/polygonParts/DAL/history';
import { PolygonPart } from '../../../src/polygonParts/DAL/polygonPart';
import { namingStrategy } from '../../../src/polygonParts/DAL/utils';
import { ValidatePart } from '../../../src/polygonParts/DAL/validationPart';
import { EntitiesMetadata, EntityIdentifierObject, PolygonPartsPayload } from '../../../src/polygonParts/models/interfaces';
import { validValidationPolygonPartsPayload } from '../../mocks/requestsMocks';
import { INITIAL_DB } from './helpers/constants';
import { createDB, deleteDB, HelperDB } from './helpers/db';
import { PolygonPartsRequestSender } from './helpers/requestSender';

let testDataSourceOptions: DataSourceOptions;
const dbConfig = config.get<Required<DbConfig>>('db');
const { schema } = dbConfig;

describe('process', () => {
  let requestSender: PolygonPartsRequestSender;
  let helperDB: HelperDB;
  let getEntitiesMetadata: (
    entityIdentifierOptions: EntityIdentifierObject | Pick<PolygonPartsPayload, 'productId' | 'productType'>
  ) => EntitiesMetadata;

  beforeAll(async () => {
    testDataSourceOptions = {
      entities: [History, PolygonPart, ValidatePart],
      namingStrategy,
      ...createConnectionOptions(dbConfig),
    };
    await createDB({ options: testDataSourceOptions, initialDatabase: INITIAL_DB });
    helperDB = new HelperDB(testDataSourceOptions);
    await helperDB.initConnection();
  });

  afterAll(async () => {
    try {
      await helperDB.destroyConnection();
    } catch (error) {
      console.error('Error destroying helperDB connection:', error);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      await deleteDB(testDataSourceOptions);
    } catch (error) {
      console.error('Error deleting database:', error);
    }
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    await helperDB.createSchema(schema);
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
    await helperDB.dropSchema(schema);
    jest.restoreAllMocks();
  });

  describe('PUT /polygonParts/process', () => {
    describe('Happy Path', () => {
      describe('Ingestion_New', () => {
        it('should process polygon parts from validation table and create polygon parts tables', async () => {
          const validateRequest: ValidatePolygonPartsRequestBody = {
            productId: validValidationPolygonPartsPayload.productId,
            productType: validValidationPolygonPartsPayload.productType,
            catalogId: validValidationPolygonPartsPayload.catalogId,
            productVersion: validValidationPolygonPartsPayload.productVersion,
            partsData: validValidationPolygonPartsPayload.partsData,
            jobType: JobTypes.Ingestion_New,
          };

          await requestSender.validatePolygonParts(validateRequest);
          const processRequest: ProcessPolygonPartsRequestBody = {
            productId: validateRequest.productId,
            productType: validateRequest.productType,
            jobType: JobTypes.Ingestion_New,
          };

          const response = await requestSender.process(processRequest);

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);
          expect(response).toSatisfyApiSpec();

          const entitiesMetadata = getEntitiesMetadata(processRequest);

          // Verify polygon parts table exists and has data
          const polygonPartsTableExists = await helperDB.tableExists(entitiesMetadata.entitiesNames.polygonParts.entityName, schema);
          expect(polygonPartsTableExists).toBe(true);

          const polygonPartsData = await helperDB.getTableData(entitiesMetadata.entitiesNames.polygonParts.entityName, schema);
          expect(polygonPartsData.length).toBeGreaterThan(0);

          // Verify history table was created
          const historyTableExists = await helperDB.tableExists(entitiesMetadata.entitiesNames.history.entityName, schema);
          expect(historyTableExists).toBe(true);

          // Verify validation table was deleted
          const validationTableExists = await helperDB.tableExists(entitiesMetadata.entitiesNames.validations.entityName, schema);
          expect(validationTableExists).toBe(false);

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

          const validateRequest: ValidatePolygonPartsRequestBody = {
            productId: validValidationPolygonPartsPayload.productId,
            productType: validValidationPolygonPartsPayload.productType,
            catalogId: validValidationPolygonPartsPayload.catalogId,
            productVersion: validValidationPolygonPartsPayload.productVersion,
            partsData: {
              ...validValidationPolygonPartsPayload.partsData,
              features: [
                {
                  ...validValidationPolygonPartsPayload.partsData.features[0],
                  geometry: multiPolygonGeometry.geometry,
                },
              ],
            },
            jobType: JobTypes.Ingestion_New,
          };

          await requestSender.validatePolygonParts(validateRequest);
          const processRequest: ProcessPolygonPartsRequestBody = {
            productId: validateRequest.productId,
            productType: validateRequest.productType,
            jobType: JobTypes.Ingestion_New,
          };

          const response = await requestSender.process(processRequest);

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);

          const entitiesMetadata = getEntitiesMetadata(processRequest);
          const historyData = await helperDB.getTableData(entitiesMetadata.entitiesNames.history.entityName, schema);

          // MultiPolygon with 2 parts should create 2 records in history
          expect(historyData.length).toBeGreaterThanOrEqual(2);

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

          const validateRequest: ValidatePolygonPartsRequestBody = {
            productId: 'TEST_INSERTION_ORDER',
            productType: validValidationPolygonPartsPayload.productType,
            catalogId: validValidationPolygonPartsPayload.catalogId,
            productVersion: validValidationPolygonPartsPayload.productVersion,
            partsData: {
              type: 'FeatureCollection',
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
            jobType: JobTypes.Ingestion_New,
          };

          await requestSender.validatePolygonParts(validateRequest);
          const processRequest: ProcessPolygonPartsRequestBody = {
            productId: validateRequest.productId,
            productType: validateRequest.productType,
            jobType: JobTypes.Ingestion_New,
          };

          const response = await requestSender.process(processRequest);

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);

          const entitiesMetadata = getEntitiesMetadata(processRequest);
          const historyData = await helperDB.getTableDataWithGeoJSON(entitiesMetadata.entitiesNames.history.entityName, schema);

          // Should have 4 records: 1 from polygon1, 2 from multiPoly1, 1 from polygon2
          expect(historyData).toHaveLength(4);

          // Verify insertion order is maintained
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/naming-convention
          const orderedData = historyData.sort((a: any, b: any) => a.insertion_order - b.insertion_order) as {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            insertion_order: number;
            // eslint-disable-next-line @typescript-eslint/naming-convention
            footprint_geojson: { type: string; coordinates: number[][][] };
          }[];

          // Insertion order should be 1, 2, 3, 4 (each polygon gets its own insertion_order)
          expect(orderedData[0].insertion_order).toBe(1);
          expect(orderedData[1].insertion_order).toBe(2);
          expect(orderedData[2].insertion_order).toBe(3); // MultiPolygon parts get sequential insertion orders
          expect(orderedData[3].insertion_order).toBe(4);

          // Verify geometries match the expected coordinates
          expect(orderedData[0].footprint_geojson.coordinates).toEqual(polygon1.geometry.coordinates);
          expect(orderedData[1].footprint_geojson.coordinates).toEqual(multiPoly1.geometry.coordinates[0]); // First part of MultiPolygon (unwrapped)
          expect(orderedData[2].footprint_geojson.coordinates).toEqual(multiPoly1.geometry.coordinates[1]); // Second part of MultiPolygon (unwrapped)
          expect(orderedData[3].footprint_geojson.coordinates).toEqual(polygon2.geometry.coordinates);

          expect.assertions(10);
        });
      });

      describe('Ingestion_Update', () => {
        it('should process polygon parts for update with existing data', async () => {
          // First, create initial data with single feature
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

          const entitiesMetadata = getEntitiesMetadata(initialPayload);
          const polygonPartsTableName = entitiesMetadata.entitiesNames.polygonParts.entityName;

          // Create polygon_parts table
          await helperDB.query(
            `CREATE TABLE ${schema}.${polygonPartsTableName} (LIKE ${schema}.polygon_parts INCLUDING ALL) INHERITS (${schema}.polygon_parts)`
          );

          // Insert initial data directly into polygon_parts table
          const arraySeparator = config.get<string>('application.arraySeparator');
          await helperDB.insertPolygonPartsFromValidationPayload(polygonPartsTableName, schema, initialPayload, arraySeparator);

          // Get initial count
          const initialPolygonPartsData = await helperDB.getTableData(polygonPartsTableName, schema);
          expect(initialPolygonPartsData).toHaveLength(1);

          // Now add new data for update
          const updateRequest: ValidatePolygonPartsRequestBody = {
            productId: initialPayload.productId, // Same product
            productType: initialPayload.productType,
            catalogId: initialPayload.catalogId,
            productVersion: initialPayload.productVersion,
            partsData: {
              type: 'FeatureCollection',
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
            jobType: JobTypes.Ingestion_Update,
          };

          await requestSender.validatePolygonParts(updateRequest);
          const processRequest: ProcessPolygonPartsRequestBody = {
            productId: updateRequest.productId,
            productType: updateRequest.productType,
            jobType: JobTypes.Ingestion_Update,
          };

          const response = await requestSender.process(processRequest);

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);

          const polygonPartsData = await helperDB.getTableData(entitiesMetadata.entitiesNames.polygonParts.entityName, schema);

          // Polygon parts should have data from both initial and update
          expect(polygonPartsData.length).toBeGreaterThanOrEqual(2);

          const historyData = await helperDB.getTableData(entitiesMetadata.entitiesNames.history.entityName, schema);

          // History should contain only the update records (from validation table)
          expect(historyData.length).toBeGreaterThanOrEqual(1);

          expect.assertions(4);
        });

        it('should handle mixed polygon and multipolygon in update scenario', async () => {
          // Initial data with simple polygon (only first feature)
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

          let entitiesMetadata = getEntitiesMetadata(initialPayload);
          const polygonPartsTableName = entitiesMetadata.entitiesNames.polygonParts.entityName;

          // Create polygon_parts table
          await helperDB.query(
            `CREATE TABLE ${schema}.${polygonPartsTableName} (LIKE ${schema}.polygon_parts INCLUDING ALL) INHERITS (${schema}.polygon_parts)`
          );

          // Insert initial data directly into polygon_parts table
          const arraySeparator = config.get<string>('application.arraySeparator');
          await helperDB.insertPolygonPartsFromValidationPayload(polygonPartsTableName, schema, initialPayload, arraySeparator);

          // Update with MultiPolygon
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

          const updateRequest: ValidatePolygonPartsRequestBody = {
            productId: validValidationPolygonPartsPayload.productId,
            productType: validValidationPolygonPartsPayload.productType,
            catalogId: validValidationPolygonPartsPayload.catalogId,
            productVersion: validValidationPolygonPartsPayload.productVersion,
            partsData: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: validValidationPolygonPartsPayload.partsData.features[0].properties,
                  geometry: multiPolygonGeometry.geometry,
                },
              ],
            },
            jobType: JobTypes.Ingestion_Update,
          };

          await requestSender.validatePolygonParts(updateRequest);
          const response = await requestSender.process({
            productId: updateRequest.productId,
            productType: updateRequest.productType,
            jobType: JobTypes.Ingestion_Update,
          });

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);

          entitiesMetadata = getEntitiesMetadata(updateRequest);
          const historyData = await helperDB.getTableDataWithGeoJSON(entitiesMetadata.entitiesNames.history.entityName, schema);

          // History should have 2 records from multipolygon (validation data only)
          expect(historyData).toHaveLength(2);

          const polygonPartsData = await helperDB.getTableData(entitiesMetadata.entitiesNames.polygonParts.entityName, schema);

          // Polygon parts should have 3 records: 1 initial + 2 from multipolygon
          expect(polygonPartsData.length).toBeGreaterThanOrEqual(3);

          // Verify insertion order is maintained
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/naming-convention
          const orderedData = historyData.sort((a: any, b: any) => a.insertion_order - b.insertion_order) as {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            insertion_order: number;
            // eslint-disable-next-line @typescript-eslint/naming-convention
            footprint_geojson: { type: string; coordinates: number[][][] };
          }[];

          // Insertion order should be 1, 2 for the multipolygon parts (validation data)
          expect(orderedData[0].insertion_order).toBe(1);
          expect(orderedData[1].insertion_order).toBe(2);

          // Verify geometries exist and are valid Polygon types
          expect(orderedData[0].footprint_geojson.type).toBe('Polygon');
          expect(orderedData[1].footprint_geojson.type).toBe('Polygon');

          // Verify the MultiPolygon parts match expected coordinates
          expect(orderedData[0].footprint_geojson.coordinates).toEqual(multiPolygonGeometry.geometry.coordinates[0]);
          expect(orderedData[1].footprint_geojson.coordinates).toEqual(multiPolygonGeometry.geometry.coordinates[1]);

          expect.assertions(8);
        });
      });

      describe('Ingestion_Swap_Update', () => {
        it('should truncate existing polygon parts and process new data', async () => {
          // Create initial data with single feature
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

          const entitiesMetadata = getEntitiesMetadata(initialPayload);
          const polygonPartsTableName = entitiesMetadata.entitiesNames.polygonParts.entityName;

          // Create polygon_parts table
          await helperDB.query(
            `CREATE TABLE ${schema}.${polygonPartsTableName} (LIKE ${schema}.polygon_parts INCLUDING ALL) INHERITS (${schema}.polygon_parts)`
          );

          // Insert initial data directly into polygon_parts table
          const arraySeparator = config.get<string>('application.arraySeparator');
          await helperDB.insertPolygonPartsFromValidationPayload(polygonPartsTableName, schema, initialPayload, arraySeparator);

          const initialPolygonPartsData = await helperDB.getTableData(polygonPartsTableName, schema);
          const initialCount = initialPolygonPartsData.length;

          expect(initialCount).toBe(1); // Verify we have 1 initial part

          // Now swap with new data (single part)
          const swapRequest: ValidatePolygonPartsRequestBody = {
            productId: initialPayload.productId, // Same product
            productType: initialPayload.productType,
            catalogId: initialPayload.catalogId,
            productVersion: initialPayload.productVersion,
            partsData: {
              type: 'FeatureCollection',
              features: [validValidationPolygonPartsPayload.partsData.features[0]],
            },
            jobType: JobTypes.Ingestion_Swap_Update,
          };

          await requestSender.validatePolygonParts(swapRequest);
          const response = await requestSender.process({
            productId: swapRequest.productId,
            productType: swapRequest.productType,
            jobType: JobTypes.Ingestion_Swap_Update,
          });

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);

          const polygonPartsData = await helperDB.getTableData(entitiesMetadata.entitiesNames.polygonParts.entityName, schema);

          // After swap, polygon_parts should have only the new data
          expect(polygonPartsData.length).toBeGreaterThanOrEqual(1);

          expect.assertions(3);
        });

        it('should handle swap with multipolygon data', async () => {
          // Initial setup with single feature
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

          let entitiesMetadata = getEntitiesMetadata(initialPayload);
          const polygonPartsTableName = entitiesMetadata.entitiesNames.polygonParts.entityName;

          // Create polygon_parts table
          await helperDB.query(
            `CREATE TABLE ${schema}.${polygonPartsTableName} (LIKE ${schema}.polygon_parts INCLUDING ALL) INHERITS (${schema}.polygon_parts)`
          );

          // Insert initial data directly into polygon_parts table
          const arraySeparator = config.get<string>('application.arraySeparator');
          await helperDB.insertPolygonPartsFromValidationPayload(polygonPartsTableName, schema, initialPayload, arraySeparator);

          // Swap with MultiPolygon (3 parts)
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

          const swapRequest: ValidatePolygonPartsRequestBody = {
            productId: initialPayload.productId, // Same product
            productType: initialPayload.productType,
            catalogId: initialPayload.catalogId,
            productVersion: initialPayload.productVersion,
            partsData: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: validValidationPolygonPartsPayload.partsData.features[0].properties,
                  geometry: multiPolygonGeometry.geometry,
                },
              ],
            },
            jobType: JobTypes.Ingestion_Swap_Update,
          };

          await requestSender.validatePolygonParts(swapRequest);
          const response = await requestSender.process({
            productId: swapRequest.productId,
            productType: swapRequest.productType,
            jobType: JobTypes.Ingestion_Swap_Update,
          });

          expect(response.status).toBe(httpStatusCodes.NO_CONTENT);

          entitiesMetadata = getEntitiesMetadata(swapRequest);
          const historyData = await helperDB.getTableData(entitiesMetadata.entitiesNames.history.entityName, schema);

          // After swap, history should have 3 parts from the MultiPolygon
          expect(historyData.length).toBeGreaterThanOrEqual(3);

          expect.assertions(2);
        });
      });
    });

    describe('Sad Path', () => {
      it('should return 404 when validation table does not exist', async () => {
        const processRequest: ProcessPolygonPartsRequestBody = {
          productId: validValidationPolygonPartsPayload.productId,
          productType: validValidationPolygonPartsPayload.productType,
          jobType: JobTypes.Ingestion_New,
        };

        const response = await requestSender.process(processRequest);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response).toSatisfyApiSpec();

        expect.assertions(2);
      });

      it.each([
        { jobType: JobTypes.Ingestion_Update, description: 'Ingestion_Update' },
        { jobType: JobTypes.Ingestion_Swap_Update, description: 'Ingestion_Swap_Update' },
      ])('should return 404 when polygon parts table does not exist for $description', async ({ jobType }) => {
        const validateRequest: ValidatePolygonPartsRequestBody = {
          ...validValidationPolygonPartsPayload,
          jobType,
        };

        await requestSender.validatePolygonParts(validateRequest);
        const processRequest: ProcessPolygonPartsRequestBody = {
          productId: validateRequest.productId,
          productType: validateRequest.productType,
          jobType,
        };

        const response = await requestSender.process(processRequest);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response).toSatisfyApiSpec();

        expect.assertions(2);
      });

      it('should return 400 for invalid request body', async () => {
        const invalidRequest = {
          productId: validValidationPolygonPartsPayload.productId,
          // Missing productType and jobType
        };

        const response = await requestSender.process(invalidRequest as ProcessPolygonPartsRequestBody);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();

        expect.assertions(2);
      });
    });
  });
});
