import jsLogger from '@map-colonies/js-logger';
import type { PolygonPartValidationErrorItem } from '@map-colonies/raster-shared';
import { ValidationErrorType } from '@map-colonies/raster-shared';
import { trace } from '@opentelemetry/api';
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
import { History } from '../../../src/polygonParts/DAL/history';
import { PolygonPart } from '../../../src/polygonParts/DAL/polygonPart';
import { namingStrategy } from '../../../src/polygonParts/DAL/utils';
import { ValidatePart } from '../../../src/polygonParts/DAL/validationPart';
import type { ValidatePolygonPartsRequestBody, ValidatePolygonPartsResponseBody } from '../../../src/polygonParts/controllers/interfaces';
import { EntitiesMetadata, EntityIdentifierObject, PolygonPartsPayload } from '../../../src/polygonParts/models/interfaces';
import {
  createCustomInitPayloadRequestForAggregation,
  highResolutionInitPayload,
  invalidGeometriesValidateRequest,
  invalidSmallGeometriesValidateRequest,
  invalidSmallHolesValidateRequest,
  mockMultipleInvalidGeometries,
  mockTouchingLayerInitPayload,
  mockUpdateWithExceededResolution,
  mockUpdateWithIntersectingParts,
  mockUpdateWithMixedResolutions,
  mockUpdateWithNonIntersectingPart,
  mockUpdateWithResolutionAndSmallGeometry,
  mockUpdateWithTouchPart,
  validValidationPolygonPartsPayload,
} from '../../mocks/requestsMocks';
import { INITIAL_DB } from './helpers/constants';
import { createDB, deleteDB, HelperDB, InsertPayload } from './helpers/db';
import { PolygonPartsRequestSender } from './helpers/requestSender';

let testDataSourceOptions: DataSourceOptions;
const dbConfig = config.get<Required<DbConfig>>('db');
const { schema } = dbConfig;

describe('validate', () => {
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

    try {
      await deleteDB(testDataSourceOptions);
    } catch (error) {
      console.error('Error deleting database:', error);
    }
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.clearAllMocks();

    await helperDB.createSchema();
    await helperDB.sync();

    await helperDB.destroyConnection();
    await helperDB.initConnection();

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
    try {
      connectionManager = container.resolve<ConnectionManager>(ConnectionManager);
      if (connectionManager.isConnected()) {
        await connectionManager.destroy();
      }
    } catch {
      // ConnectionManager may not be initialized in some tests
    }

    await helperDB.dropSchema();
  });

  describe('POST /polygonParts/validate', () => {
    describe('Happy Path', () => {
      describe('Resolution validation', () => {
        it('should set isExceeded: false when zoom level difference is within the threshold', async () => {
          const initPayload = createCustomInitPayloadRequestForAggregation as unknown as InsertPayload;
          const { entitiesNames } = getEntitiesMetadata(initPayload);
          await helperDB.createInheritedTable(entitiesNames.polygonParts.entityName, 'polygon_parts');
          await helperDB.insertPolygonPartsFromValidationPayload(entitiesNames.polygonParts.entityName, initPayload);

          const response = await requestSender.validatePolygonParts(mockUpdateWithIntersectingParts);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(2);
          expect(responseBody.parts).toEqual(
            expect.arrayContaining([
              {
                id: mockUpdateWithIntersectingParts.partsData.features[0].properties.id,
                errors: [{ code: ValidationErrorType.RESOLUTION, isExceeded: false }],
              },
              {
                id: mockUpdateWithIntersectingParts.partsData.features[1].properties.id,
                errors: [{ code: ValidationErrorType.RESOLUTION, isExceeded: false }],
              },
            ])
          );
          expect(responseBody.smallHolesCount).toBe(0);
          expect(response).toSatisfyApiSpec();

          expect.assertions(5);
        });

        it('should set isExceeded: true when zoom level difference exceeds the threshold', async () => {
          const { entitiesNames } = getEntitiesMetadata(highResolutionInitPayload);
          await helperDB.createInheritedTable(entitiesNames.polygonParts.entityName, 'polygon_parts');
          await helperDB.insertPolygonPartsFromValidationPayload(entitiesNames.polygonParts.entityName, highResolutionInitPayload as InsertPayload);

          const response = await requestSender.validatePolygonParts(mockUpdateWithExceededResolution);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(1);
          expect(responseBody.parts[0]).toMatchObject({
            id: mockUpdateWithExceededResolution.partsData.features[0].properties.id,
            errors: [{ code: ValidationErrorType.RESOLUTION, isExceeded: true }],
          });
          expect(responseBody.smallHolesCount).toBe(0);
          expect(response).toSatisfyApiSpec();

          expect.assertions(5);
        });

        it('should return no resolution errors when new parts do not intersect existing parts', async () => {
          const initPayload = createCustomInitPayloadRequestForAggregation as unknown as InsertPayload;
          const { entitiesNames } = getEntitiesMetadata(initPayload);
          await helperDB.createInheritedTable(entitiesNames.polygonParts.entityName, 'polygon_parts');
          await helperDB.insertPolygonPartsFromValidationPayload(entitiesNames.polygonParts.entityName, initPayload);

          const response = await requestSender.validatePolygonParts(mockUpdateWithNonIntersectingPart);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(0);
          expect(responseBody.smallHolesCount).toBe(0);
          expect(response).toSatisfyApiSpec();

          expect.assertions(4);
        });

        it('should return no resolution errors when new parts only touch (share a boundary with) existing parts', async () => {
          const initPayload = mockTouchingLayerInitPayload as unknown as InsertPayload;
          const { entitiesNames } = getEntitiesMetadata(mockUpdateWithTouchPart);
          await helperDB.createInheritedTable(entitiesNames.polygonParts.entityName, 'polygon_parts');
          await helperDB.insertPolygonPartsFromValidationPayload(entitiesNames.polygonParts.entityName, initPayload);

          const response = await requestSender.validatePolygonParts(mockUpdateWithTouchPart);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(0);
          expect(responseBody.smallHolesCount).toBe(0);
          expect(response).toSatisfyApiSpec();

          expect.assertions(4);
        });

        it('should skip resolution validation and return no errors for Ingestion_New job type', async () => {
          const response = await requestSender.validatePolygonParts(validValidationPolygonPartsPayload);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(0);
          expect(responseBody.smallHolesCount).toBe(0);
          expect(response).toSatisfyApiSpec();

          expect.assertions(4);
        });

        it('should return mixed isExceeded values when parts have different zoom level differences relative to the existing layer', async () => {
          const { entitiesNames } = getEntitiesMetadata(highResolutionInitPayload);
          await helperDB.createInheritedTable(entitiesNames.polygonParts.entityName, 'polygon_parts');
          await helperDB.insertPolygonPartsFromValidationPayload(entitiesNames.polygonParts.entityName, highResolutionInitPayload as InsertPayload);

          const response = await requestSender.validatePolygonParts(mockUpdateWithMixedResolutions);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(2);
          expect(responseBody.parts).toEqual(
            expect.arrayContaining([
              {
                id: mockUpdateWithMixedResolutions.partsData.features[0].properties.id,
                errors: [{ code: ValidationErrorType.RESOLUTION, isExceeded: true }],
              },
              {
                id: mockUpdateWithMixedResolutions.partsData.features[1].properties.id,
                errors: [{ code: ValidationErrorType.RESOLUTION, isExceeded: false }],
              },
            ])
          );
          expect(responseBody.smallHolesCount).toBe(0);
          expect(response).toSatisfyApiSpec();

          expect.assertions(5);
        });

        it('should return both RESOLUTION and SMALL_GEOMETRY errors on the same part', async () => {
          const { entitiesNames } = getEntitiesMetadata(highResolutionInitPayload);
          await helperDB.createInheritedTable(entitiesNames.polygonParts.entityName, 'polygon_parts');
          await helperDB.insertPolygonPartsFromValidationPayload(entitiesNames.polygonParts.entityName, highResolutionInitPayload as InsertPayload);

          const response = await requestSender.validatePolygonParts(mockUpdateWithResolutionAndSmallGeometry);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(1);
          expect(responseBody.parts[0]).toMatchObject({
            id: mockUpdateWithResolutionAndSmallGeometry.partsData.features[0].properties.id,
            errors: expect.arrayContaining([
              { code: ValidationErrorType.SMALL_GEOMETRY },
              { code: ValidationErrorType.RESOLUTION, isExceeded: true },
            ]) as PolygonPartValidationErrorItem[],
          });
          expect(responseBody.smallHolesCount).toBe(0);
          expect(response).toSatisfyApiSpec();

          expect.assertions(5);
        });
      });

      describe('Geometry validation', () => {
        it('should return GEOMETRY_VALIDITY errors for self-intersecting geometries', async () => {
          const response = await requestSender.validatePolygonParts(invalidGeometriesValidateRequest);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(2);
          expect(responseBody.parts).toEqual(
            expect.arrayContaining([
              {
                id: invalidGeometriesValidateRequest.partsData.features[0].properties.id,
                errors: [{ code: ValidationErrorType.GEOMETRY_VALIDITY }],
              },
              {
                id: invalidGeometriesValidateRequest.partsData.features[1].properties.id,
                errors: [{ code: ValidationErrorType.GEOMETRY_VALIDITY }],
              },
            ])
          );
          expect(responseBody.smallHolesCount).toBe(0);
          expect(response).toSatisfyApiSpec();

          expect.assertions(5);
        });

        it('should return SMALL_GEOMETRY errors for parts whose area is below the threshold', async () => {
          const response = await requestSender.validatePolygonParts(invalidSmallGeometriesValidateRequest);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(2);
          expect(responseBody.parts).toEqual(
            expect.arrayContaining([
              {
                id: invalidSmallGeometriesValidateRequest.partsData.features[0].properties.id,
                errors: [{ code: ValidationErrorType.SMALL_GEOMETRY }],
              },
              {
                id: invalidSmallGeometriesValidateRequest.partsData.features[1].properties.id,
                errors: [{ code: ValidationErrorType.SMALL_GEOMETRY }],
              },
            ])
          );
          expect(responseBody.smallHolesCount).toBe(0);
          expect(response).toSatisfyApiSpec();

          expect.assertions(5);
        });

        it('should return SMALL_HOLES errors for parts containing holes below the area threshold', async () => {
          const response = await requestSender.validatePolygonParts(invalidSmallHolesValidateRequest);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(2);
          expect(responseBody.parts).toEqual(
            expect.arrayContaining([
              {
                id: invalidSmallHolesValidateRequest.partsData.features[0].properties.id,
                errors: [{ code: ValidationErrorType.SMALL_HOLES }],
              },
              {
                id: invalidSmallHolesValidateRequest.partsData.features[1].properties.id,
                errors: [{ code: ValidationErrorType.SMALL_HOLES }],
              },
            ])
          );
          expect(responseBody.smallHolesCount).toBe(2);
          expect(response).toSatisfyApiSpec();

          expect.assertions(5);
        });

        it('should report SMALL_GEOMETRY and SMALL_HOLES independently on different parts', async () => {
          const response = await requestSender.validatePolygonParts(mockMultipleInvalidGeometries);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(4);
          expect(responseBody.parts).toEqual(
            expect.arrayContaining([
              {
                id: mockMultipleInvalidGeometries.partsData.features[0].properties.id,
                errors: [{ code: ValidationErrorType.GEOMETRY_VALIDITY }],
              },
              {
                id: mockMultipleInvalidGeometries.partsData.features[1].properties.id,
                errors: [{ code: ValidationErrorType.SMALL_GEOMETRY }],
              },
              {
                id: mockMultipleInvalidGeometries.partsData.features[2].properties.id,
                errors: [{ code: ValidationErrorType.SMALL_HOLES }],
              },
              {
                id: mockMultipleInvalidGeometries.partsData.features[3].properties.id,
                errors: expect.arrayContaining([
                  { code: ValidationErrorType.SMALL_GEOMETRY },
                  { code: ValidationErrorType.SMALL_HOLES },
                ]) as PolygonPartValidationErrorItem[],
              },
            ])
          );
          expect(responseBody.smallHolesCount).toBe(2);
          expect(response).toSatisfyApiSpec();

          expect.assertions(5);
        });

        it('should accumulate multiple error codes on a single part with mixed validity issues', async () => {
          const response = await requestSender.validatePolygonParts(mockMultipleInvalidGeometries);

          const responseBody = response.body as ValidatePolygonPartsResponseBody;
          expect(response.status).toBe(httpStatusCodes.OK);
          expect(responseBody.parts).toHaveLength(4);
          expect(responseBody.parts).toEqual(
            expect.arrayContaining([
              {
                id: mockMultipleInvalidGeometries.partsData.features[3].properties.id,
                errors: expect.arrayContaining([
                  { code: ValidationErrorType.SMALL_GEOMETRY },
                  { code: ValidationErrorType.SMALL_HOLES },
                ]) as PolygonPartValidationErrorItem[],
              },
            ])
          );
          expect(responseBody.smallHolesCount).toBe(2);
          expect(response).toSatisfyApiSpec();

          expect.assertions(5);
        });
      });
    });

    describe('Bad Path', () => {
      it('should return 400 when productId is missing from the request body', async () => {
        const response = await requestSender.validatePolygonParts({
          ...validValidationPolygonPartsPayload,
          productId: undefined,
        } as unknown as ValidatePolygonPartsRequestBody);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);

        expect.assertions(1);
      });

      it('should return 400 when productType is missing from the request body', async () => {
        const response = await requestSender.validatePolygonParts({
          ...validValidationPolygonPartsPayload,
          productType: undefined,
        } as unknown as ValidatePolygonPartsRequestBody);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);

        expect.assertions(1);
      });
    });

    describe('Sad Path', () => {
      it('should return 404 when the polygon_parts table does not exist for an Ingestion_Update request', async () => {
        // No polygon_parts table is created for mockUpdateWithTouchPart's layer.
        const response = await requestSender.validatePolygonParts(mockUpdateWithTouchPart);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);

        expect.assertions(1);
      });
    });
  });
});
