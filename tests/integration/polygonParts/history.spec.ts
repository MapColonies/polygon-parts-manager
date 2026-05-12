import jsLogger from '@map-colonies/js-logger';
import { JobTypes } from '@map-colonies/raster-shared';
import { trace } from '@opentelemetry/api';
import { multiPolygon } from '@turf/helpers';
import config from 'config';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';
import { DataSource, DataSourceOptions, EntityManager, SelectQueryBuilder } from 'typeorm';
import { getApp } from '../../../src/app';
import { ConnectionManager } from '../../../src/common/connectionManager';
import { SERVICES } from '../../../src/common/constants';
import { ApplicationConfig, DbConfig } from '../../../src/common/interfaces';
import { createConnectionOptions } from '../../../src/common/utils';
import { Transformer } from '../../../src/middlewares/transformer';
import { ValidatePolygonPartsRequestBody, ValidationEntityQuery } from '../../../src/polygonParts/controllers/interfaces';
import { History } from '../../../src/polygonParts/DAL/history';
import { PolygonPart } from '../../../src/polygonParts/DAL/polygonPart';
import { namingStrategy } from '../../../src/polygonParts/DAL/utils';
import { ValidatePart } from '../../../src/polygonParts/DAL/validationPart';
import { EntitiesMetadata, EntityIdentifierObject, PolygonPartsPayload } from '../../../src/polygonParts/models/interfaces';
import { validValidationPolygonPartsPayload } from '../../mocks/requestsMocks';
import { HelperDB } from './helpers/db';
import { PolygonPartsRequestSender } from './helpers/requestSender';

let testDataSourceOptions: DataSourceOptions;
const applicationConfig = config.get<ApplicationConfig>('application');
const dbConfig = config.get<Required<DbConfig>>('db');
const { schema } = dbConfig;

describe('history', () => {
  let requestSender: PolygonPartsRequestSender;
  let helperDB: HelperDB;
  let getEntitiesMetadata: (
    entityIdentifierOptions: EntityIdentifierObject | Pick<PolygonPartsPayload, 'productId' | 'productType'>
  ) => EntitiesMetadata;
  let connectionManager: ConnectionManager;

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
    // Ensure all connections are closed before dropping schema
    try {
      connectionManager = container.resolve<ConnectionManager>(ConnectionManager);
      if (connectionManager.isConnected()) {
        await connectionManager.destroy();
      }
    } catch (error) {
      // ConnectionManager may not be initialized in some tests
    }

    await helperDB.dropSchema();
    jest.restoreAllMocks();
  });

  describe('PUT /history', () => {
    describe('Happy Path', () => {
      it('should return 204 and move validation data to history table', async () => {
        const validateRequest: ValidatePolygonPartsRequestBody = {
          ...validValidationPolygonPartsPayload,
          jobType: JobTypes.Ingestion_New,
        };

        // Insert validation data directly into database
        await requestSender.validatePolygonParts(validateRequest);
        const historyQuery: ValidationEntityQuery = {
          productId: validateRequest.productId,
          productType: validateRequest.productType,
        };

        const entitiesMetadata = getEntitiesMetadata(historyQuery);
        const partsEntityName = entitiesMetadata.entitiesNames.history.entityName;
        const partsSuffix = applicationConfig.entities.history.nameSuffix;
        const historyTableName = partsEntityName.replace(new RegExp(`${partsSuffix}$`), '_history');

        const response = await requestSender.moveValidationsToHistory(historyQuery);

        expect(response.status).toBe(httpStatusCodes.NO_CONTENT);
        expect(response).toSatisfyApiSpec();

        // Verify history table was created
        const historyTableExists = await helperDB.tableExists(historyTableName);
        expect(historyTableExists).toBe(true);

        // Verify validation table was deleted
        const validationTableExists = await helperDB.tableExists(entitiesMetadata.entitiesNames.validations.entityName);
        expect(validationTableExists).toBe(false);

        // Verify data was inserted into history table
        const historyData = await helperDB.getTableData(historyTableName);
        expect(historyData.length).toBeGreaterThan(0);

        expect.assertions(5);
      });

      it('should split MultiPolygon geometries into individual Polygons when moving to history', async () => {
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
          ...validValidationPolygonPartsPayload,
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
        const historyQuery: ValidationEntityQuery = {
          productId: validateRequest.productId,
          productType: validateRequest.productType,
        };

        const entitiesMetadata = getEntitiesMetadata(historyQuery);
        const partsEntityName = entitiesMetadata.entitiesNames.history.entityName;
        const partsSuffix = applicationConfig.entities.history.nameSuffix;
        const historyTableName = partsEntityName.replace(new RegExp(`${partsSuffix}$`), '_history');

        const response = await requestSender.moveValidationsToHistory(historyQuery);

        expect(response.status).toBe(httpStatusCodes.NO_CONTENT);

        // Verify history table contains split polygons
        const historyData = await helperDB.getTableData(historyTableName);
        expect(historyData).toHaveLength(2); // MultiPolygon with 2 parts should create 2 records

        expect.assertions(2);
      });

      it('should create history table if it does not exist', async () => {
        const validateRequest: ValidatePolygonPartsRequestBody = {
          ...validValidationPolygonPartsPayload,
          jobType: JobTypes.Ingestion_New,
        };

        await requestSender.validatePolygonParts(validateRequest);
        const historyQuery: ValidationEntityQuery = {
          productId: validateRequest.productId,
          productType: validateRequest.productType,
        };

        const entitiesMetadata = getEntitiesMetadata(historyQuery);
        const partsEntityName = entitiesMetadata.entitiesNames.history.entityName;
        const partsSuffix = applicationConfig.entities.history.nameSuffix;
        const historyTableName = partsEntityName.replace(new RegExp(`${partsSuffix}$`), '_history');

        // Verify history table doesn't exist yet
        const historyTableExistsBefore = await helperDB.tableExists(historyTableName);
        expect(historyTableExistsBefore).toBe(false);

        const response = await requestSender.moveValidationsToHistory(historyQuery);

        expect(response.status).toBe(httpStatusCodes.NO_CONTENT);

        // Verify history table was created
        const historyTableExistsAfter = await helperDB.tableExists(historyTableName);
        expect(historyTableExistsAfter).toBe(true);

        expect.assertions(3);
      });

      it('should append to existing history table if it already exists', async () => {
        const validateRequest1: ValidatePolygonPartsRequestBody = {
          ...validValidationPolygonPartsPayload,
          partsData: {
            ...validValidationPolygonPartsPayload.partsData,
            features: [
              {
                ...validValidationPolygonPartsPayload.partsData.features[0],
                properties: {
                  ...validValidationPolygonPartsPayload.partsData.features[0].properties,
                  id: 'first-batch-id',
                },
              },
            ],
          },
          jobType: JobTypes.Ingestion_New,
        };

        const validateRequest2: ValidatePolygonPartsRequestBody = {
          ...validValidationPolygonPartsPayload,
          partsData: {
            ...validValidationPolygonPartsPayload.partsData,
            features: [
              {
                ...validValidationPolygonPartsPayload.partsData.features[0],
                properties: {
                  ...validValidationPolygonPartsPayload.partsData.features[0].properties,
                  id: 'second-batch-id',
                },
              },
            ],
          },
          jobType: JobTypes.Ingestion_New,
        };

        const historyQuery: ValidationEntityQuery = {
          productId: validateRequest1.productId,
          productType: validateRequest1.productType,
        };

        const entitiesMetadata = getEntitiesMetadata(historyQuery);
        const partsEntityName = entitiesMetadata.entitiesNames.history.entityName;
        const partsSuffix = applicationConfig.entities.history.nameSuffix;
        const historyTableName = partsEntityName.replace(new RegExp(`${partsSuffix}$`), '_history');

        // First batch
        await requestSender.validatePolygonParts(validateRequest1);
        await requestSender.moveValidationsToHistory(historyQuery);

        const historyDataAfterFirst = await helperDB.getTableData(historyTableName);
        const firstBatchCount = historyDataAfterFirst.length;

        // Second batch
        await requestSender.validatePolygonParts(validateRequest2);
        await requestSender.moveValidationsToHistory(historyQuery);

        const historyDataAfterSecond = await helperDB.getTableData(historyTableName);
        expect(historyDataAfterSecond).toHaveLength(firstBatchCount + 1);

        expect.assertions(1);
      });

      it('should preserve all required columns when moving to history', async () => {
        const validateRequest: ValidatePolygonPartsRequestBody = {
          ...validValidationPolygonPartsPayload,
          jobType: JobTypes.Ingestion_New,
        };

        await requestSender.validatePolygonParts(validateRequest);
        const historyQuery: ValidationEntityQuery = {
          productId: validateRequest.productId,
          productType: validateRequest.productType,
        };

        const entitiesMetadata = getEntitiesMetadata(historyQuery);
        const partsEntityName = entitiesMetadata.entitiesNames.history.entityName;
        const partsSuffix = applicationConfig.entities.history.nameSuffix;
        const historyTableName = partsEntityName.replace(new RegExp(`${partsSuffix}$`), '_history');

        await requestSender.moveValidationsToHistory(historyQuery);

        const historyData = await helperDB.getTableData(historyTableName);
        const firstRecord = historyData[0];

        // Verify essential columns exist
        expect(firstRecord).toHaveProperty('id');
        expect(firstRecord).toHaveProperty('product_id');
        expect(firstRecord).toHaveProperty('product_type');
        expect(firstRecord).toHaveProperty('footprint');
        expect(firstRecord).toHaveProperty('insertion_order');

        expect.assertions(5);
      });
    });

    describe('Sad Path', () => {
      it('should return 404 when validation table does not exist', async () => {
        const historyQuery: ValidationEntityQuery = {
          productId: validValidationPolygonPartsPayload.productId,
          productType: validValidationPolygonPartsPayload.productType,
        };

        const response = await requestSender.moveValidationsToHistory(historyQuery);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response).toSatisfyApiSpec();

        expect.assertions(2);
      });

      it('should return 500 when database error occurs - exists check fails', async () => {
        // Reset all mocks before this test to ensure clean state
        jest.restoreAllMocks();

        const validateRequest: ValidatePolygonPartsRequestBody = {
          ...validValidationPolygonPartsPayload,
          jobType: JobTypes.Ingestion_New,
        };

        await requestSender.validatePolygonParts(validateRequest);
        const historyQuery: ValidationEntityQuery = {
          productId: validateRequest.productId,
          productType: validateRequest.productType,
        };

        const expectedErrorMessage = 'exists check error';
        const spyGetExists = jest.spyOn(SelectQueryBuilder.prototype, 'getExists').mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.moveValidationsToHistory(historyQuery);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response).toSatisfyApiSpec();
        expect(spyGetExists).toHaveBeenCalledTimes(1);

        expect.assertions(3);
      });

      it('should return 500 when database error occurs - table creation fails', async () => {
        // Reset all mocks before this test to ensure clean state
        jest.restoreAllMocks();

        const validateRequest: ValidatePolygonPartsRequestBody = {
          ...validValidationPolygonPartsPayload,
          jobType: JobTypes.Ingestion_New,
        };

        // Insert validation data FIRST before setting up mocks
        await requestSender.validatePolygonParts(validateRequest);
        const historyQuery: ValidationEntityQuery = {
          productId: validateRequest.productId,
          productType: validateRequest.productType,
        };

        // Ensure history table doesn't exist from previous tests
        const entitiesMetadata = getEntitiesMetadata(historyQuery);
        const partsEntityName = entitiesMetadata.entitiesNames.history.entityName;
        const partsSuffix = applicationConfig.entities.history.nameSuffix;
        const historyTableName = partsEntityName.replace(new RegExp(`${partsSuffix}$`), '_history');
        await helperDB.query(`DROP TABLE IF EXISTS ${schema}.${historyTableName} CASCADE`);

        const expectedErrorMessage = 'table creation error';
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalQuery = EntityManager.prototype.query;
        let createTableCalled = false;
        const spyQuery = jest
          .spyOn(EntityManager.prototype, 'query')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .mockImplementation(async function (this: EntityManager, query: string, ...args: any[]) {
            // Let SET search_path pass through
            if (query.includes('SET search_path')) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              return originalQuery.call(this, query, ...args);
            }
            // Fail on CREATE TABLE, but only for history table creation
            if (query.includes('CREATE TABLE') && query.includes('_history')) {
              createTableCalled = true;
              throw new Error(expectedErrorMessage);
            }
            // Let all other queries pass through (including information_schema queries)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return originalQuery.call(this, query, ...args);
          });

        const response = await requestSender.moveValidationsToHistory(historyQuery);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response).toSatisfyApiSpec();
        expect(createTableCalled).toBe(true);
        expect(spyQuery).toHaveBeenCalled();

        expect.assertions(4);
      });

      it('should return 500 when database error occurs - insert fails', async () => {
        // Reset all mocks before this test to ensure clean state
        jest.restoreAllMocks();

        const validateRequest: ValidatePolygonPartsRequestBody = {
          ...validValidationPolygonPartsPayload,
          jobType: JobTypes.Ingestion_New,
        };

        await requestSender.validatePolygonParts(validateRequest);
        const historyQuery: ValidationEntityQuery = {
          productId: validateRequest.productId,
          productType: validateRequest.productType,
        };

        const expectedErrorMessage = 'insert error';
        const originalQuery = EntityManager.prototype.query.bind(EntityManager.prototype);
        const spyQuery = jest
          .spyOn(EntityManager.prototype, 'query')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .mockImplementation(async function (this: EntityManager, query: string, ...args: any[]) {
            // Let SET search_path pass through
            if (query.includes('SET search_path')) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              return originalQuery.call(this, query, ...args);
            }
            // Let CREATE TABLE pass through
            if (query.includes('CREATE TABLE')) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              return originalQuery.call(this, query, ...args);
            }
            // Fail on INSERT (the big INSERT statement)
            if (query.includes('INSERT INTO')) {
              throw new Error(expectedErrorMessage);
            }
            // Let all other queries pass through
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return originalQuery.call(this, query, ...args);
          });

        const response = await requestSender.moveValidationsToHistory(historyQuery);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response).toSatisfyApiSpec();
        expect(spyQuery).toHaveBeenCalled();

        expect.assertions(3);
      });

      it('should return 500 when transaction fails', async () => {
        // Reset all mocks before this test to ensure clean state
        jest.restoreAllMocks();

        const validateRequest: ValidatePolygonPartsRequestBody = {
          ...validValidationPolygonPartsPayload,
          jobType: JobTypes.Ingestion_New,
        };

        await requestSender.validatePolygonParts(validateRequest);
        const historyQuery: ValidationEntityQuery = {
          productId: validateRequest.productId,
          productType: validateRequest.productType,
        };

        const expectedErrorMessage = 'transaction error';
        const spyTransaction = jest.spyOn(DataSource.prototype, 'transaction').mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.moveValidationsToHistory(historyQuery);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
        expect(response).toSatisfyApiSpec();
        expect(spyTransaction).toHaveBeenCalledTimes(1);

        expect.assertions(4);
      });
    });
  });
});
