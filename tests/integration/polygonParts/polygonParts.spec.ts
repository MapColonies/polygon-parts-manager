import { faker } from '@faker-js/faker';
import jsLogger from '@map-colonies/js-logger';
import type { PolygonPart as PolygonPartType } from '@map-colonies/mc-model-types';
import { trace } from '@opentelemetry/api';
import { randomPolygon } from '@turf/random';
import config from 'config';
import type { FeatureCollection, Polygon } from 'geojson';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { xor } from 'martinez-polygon-clipping';
import { types } from 'pg';
import { container } from 'tsyringe';
import { type DataSourceOptions, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { getApp } from '../../../src/app';
import { ConnectionManager } from '../../../src/common/connectionManager';
import { SERVICES } from '../../../src/common/constants';
import type { DbConfig } from '../../../src/common/interfaces';
import { Part } from '../../../src/polygonParts/DAL/part';
import { PolygonPart } from '../../../src/polygonParts/DAL/polygonPart';
import { payloadToInsertPartsData } from '../../../src/polygonParts/DAL/utils';
import type { PolygonPartsPayload } from '../../../src/polygonParts/models/interfaces';
import polygonEarth from './data/polygonEarth.json';
import polygonHole from './data/polygonHole.json';
import polygonHoleSplitter from './data/polygonHoleSplitter.json';
import { INITIAL_DB } from './helpers/constants';
import { HelperDB, createDB, createPolygonPartsPayload } from './helpers/db';
import { PolygonPartsRequestSender } from './helpers/requestSender';
import { getEntitiesNames, isValidUUIDv4, toPostgresResponse } from './helpers/utils';

// postgresql - parse NUMERIC and BIGINT as numbers instead of strings
types.setTypeParser(types.builtins.NUMERIC, (value) => parseFloat(value));
types.setTypeParser(types.builtins.INT8, (value) => parseInt(value, 10));
types.setTypeParser(types.builtins.FLOAT4, (value) => parseFloat(value));

let testDataSourceOptions: DataSourceOptions;
const dbConfig = config.get<Required<DbConfig>>('db');
const { schema } = dbConfig;

describe('polygonParts', () => {
  let requestSender: PolygonPartsRequestSender;
  let helperDB: HelperDB;

  beforeAll(async () => {
    testDataSourceOptions = ConnectionManager.createConnectionOptions(dbConfig);
    await createDB({ options: testDataSourceOptions, initialDatabase: INITIAL_DB });
    helperDB = new HelperDB(testDataSourceOptions);
    await helperDB.initConnection();
  });

  afterAll(async () => {
    await helperDB.destroyConnection();
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
    requestSender = new PolygonPartsRequestSender(app);
  });

  afterEach(async () => {
    const connectionManager = container.resolve<ConnectionManager>(ConnectionManager);
    await connectionManager.destroy();
    await helperDB.dropSchema(schema);
  });

  describe('Happy Path', () => {
    describe('POST /polygonParts', () => {
      // TODO: check for tracing is sent side effect
      it('should return 201 status code and create the resources for a single part', async () => {
        const polygonPartsPayload = createPolygonPartsPayload();
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        const expectedPartRecord = toPostgresResponse(payloadToInsertPartsData(polygonPartsPayload)).map((expectedPartRecord) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { ...expectedPartRecord, horizontalAccuracyCE90: expect.closeTo(expectedPartRecord.horizontalAccuracyCE90, 2) };
        });

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        // TODO: once openapi type generator is utilized consider using it's status definition
        // TODO: consider adding a custom matcher - extending jest
        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect(partRecords).toMatchObject(expectedPartRecord);
        expect(partRecords[0].ingestionDateUTC).toBeBeforeOrEqualTo(new Date());
        expect(partRecords[0].footprint).toBePolygonGeometry();
        expect(partRecords[0].isProcessedPart).toBeTrue();
        expect(partRecords[0].insertionOrder).toBe(1);
        expect(isValidUUIDv4(partRecords[0].id)).toBeTrue();

        expect(polygonPartRecords).toMatchObject(expectedPartRecord);
        expect(polygonPartRecords[0].ingestionDateUTC).toStrictEqual(partRecords[0].ingestionDateUTC);
        expect(polygonPartRecords[0].footprint).toStrictEqual(partRecords[0].footprint);
        expect(polygonPartRecords[0].partId).toStrictEqual(partRecords[0].id);
        expect(polygonPartRecords[0].insertionOrder).toStrictEqual(partRecords[0].insertionOrder);
        expect(isValidUUIDv4(polygonPartRecords[0].id)).toBeTrue();

        expect.assertions(14);
      });

      it('should return 201 status code and create the resources for a single part with a hole', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        const partDataHole = polygonPartsPayload.partsData[0];
        polygonPartsPayload.partsData = [{ ...partDataHole, ...{ footprint: (polygonHole as FeatureCollection).features[0].geometry as Polygon } }];
        const expectedPartRecord = toPostgresResponse(payloadToInsertPartsData(polygonPartsPayload)).map((expectedPartRecord) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { ...expectedPartRecord, horizontalAccuracyCE90: expect.closeTo(expectedPartRecord.horizontalAccuracyCE90, 2) };
        });

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect(partRecords).toMatchObject(expectedPartRecord);
        expect(partRecords[0].ingestionDateUTC).toBeBeforeOrEqualTo(new Date());
        expect(partRecords[0].footprint).toBePolygonGeometry();
        expect(partRecords[0].isProcessedPart).toBeTrue();
        expect(partRecords[0].insertionOrder).toBe(1);
        expect(isValidUUIDv4(partRecords[0].id)).toBeTrue();

        expect(polygonPartRecords).toMatchObject(expectedPartRecord);
        expect(polygonPartRecords[0].ingestionDateUTC).toStrictEqual(partRecords[0].ingestionDateUTC);
        expect(polygonPartRecords[0].footprint).toStrictEqual(partRecords[0].footprint);
        expect(polygonPartRecords[0].partId).toStrictEqual(partRecords[0].id);
        expect(polygonPartRecords[0].insertionOrder).toStrictEqual(partRecords[0].insertionOrder);
        expect(isValidUUIDv4(polygonPartRecords[0].id)).toBeTrue();

        expect.assertions(14);
      });

      it.each([
        { min: 2, max: 10 },
        { min: 11, max: 100 },
        { min: 101, max: 200 },
      ])('should return 201 status code and create the resources for multiple parts (between $min - $max parts)', async ({ min, max }) => {
        const partsCount = faker.number.int({ min, max });
        const polygonPartsPayload = createPolygonPartsPayload(partsCount);
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        const expectedPartRecords = toPostgresResponse(payloadToInsertPartsData(polygonPartsPayload)).map((expectedPartRecord) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { ...expectedPartRecord, horizontalAccuracyCE90: expect.closeTo(expectedPartRecord.horizontalAccuracyCE90, 2) };
        });

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);

        partRecords.forEach((partRecord, index) => {
          expect(partRecord.ingestionDateUTC).toBeBeforeOrEqualTo(new Date());
          expect(partRecord.footprint).toBePolygonGeometry();
          expect(partRecord.isProcessedPart).toBeTrue();
          expect(partRecord.insertionOrder).toBe(index + 1);
          expect(isValidUUIDv4(partRecord.id)).toBeTrue();

          const relatedPolygonPartRecords = polygonPartRecords.filter((polygonPartRecord) => polygonPartRecord.partId === partRecord.id);

          for (const relatedPolygonPartRecord of relatedPolygonPartRecords) {
            const { footprint, id, ingestionDateUTC, insertionOrder, partId, ...relatedPolygonPartRecordProperties } = relatedPolygonPartRecord;
            const { footprint: expectedFootprint, ...expectedPartRecordsProperties } = expectedPartRecords[index];
            expect(relatedPolygonPartRecordProperties).toMatchObject(expectedPartRecordsProperties);
            expect(relatedPolygonPartRecord.ingestionDateUTC).toStrictEqual(partRecord.ingestionDateUTC);
            expect(relatedPolygonPartRecord.footprint).toBePolygonGeometry();
            expect(relatedPolygonPartRecord.insertionOrder).toStrictEqual(partRecord.insertionOrder);
            expect(relatedPolygonPartRecord.partId).toStrictEqual(partRecord.id);
            expect(isValidUUIDv4(relatedPolygonPartRecord.id)).toBeTrue();
          }
        });
      });

      it('should return 201 status code and create the resources for multiple parts, where one with hole and a second that splitting it', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(2);
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        const partDataHole = polygonPartsPayload.partsData[0];
        const partDataSpliting = polygonPartsPayload.partsData[1];
        polygonPartsPayload.partsData = [
          { ...partDataHole, ...{ footprint: (polygonHole as FeatureCollection).features[0].geometry as Polygon } },
          { ...partDataSpliting, ...{ footprint: (polygonHoleSplitter as FeatureCollection).features[0].geometry as Polygon } },
        ];
        const expectedPartRecords = toPostgresResponse(payloadToInsertPartsData(polygonPartsPayload));
        const [expectedPolygonHole, expectedPolygonSplitter] = expectedPartRecords.map((expectedPartRecord) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { ...expectedPartRecord, horizontalAccuracyCE90: expect.closeTo(expectedPartRecord.horizontalAccuracyCE90, 2) };
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedPolygonPartRecords1 = { ...expectedPolygonHole, footprint: expect.anything() };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedPolygonPartRecords2 = { ...expectedPolygonHole, footprint: expect.anything() };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);
        const [polygonPart1, polygonPart2, polygonPart3] = polygonPartRecords;

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect(partRecords).toMatchObject([expectedPolygonHole, expectedPolygonSplitter]);
        expect(polygonPart1).toMatchObject(expectedPolygonPartRecords1);
        expect(
          xor(polygonPart1.footprint.coordinates, [
            [
              [-40, -40],
              [-20, -40],
              [-20, 40],
              [-40, 40],
              [-40, -40],
            ],
          ])
        ).toHaveLength(0);
        expect(polygonPart2).toMatchObject(expectedPolygonPartRecords2);
        expect(
          xor(polygonPart2.footprint.coordinates, [
            [
              [20, -40],
              [40, -40],
              [40, 40],
              [20, 40],
              [20, -40],
            ],
          ])
        ).toHaveLength(0);
        expect(polygonPart3).toMatchObject(expectedPolygonSplitter);

        partRecords.forEach((partRecord, index) => {
          expect(partRecord.ingestionDateUTC).toBeBeforeOrEqualTo(new Date());
          expect(partRecord.footprint).toBePolygonGeometry();
          expect(partRecord.isProcessedPart).toBeTrue();
          expect(partRecord.insertionOrder).toBe(index + 1);
          expect(isValidUUIDv4(partRecord.id)).toBeTrue();

          const relatedPolygonPartRecords = polygonPartRecords.filter((polygonPartRecord) => polygonPartRecord.partId === partRecord.id);

          for (const relatedPolygonPartRecord of relatedPolygonPartRecords) {
            expect(relatedPolygonPartRecord.ingestionDateUTC).toStrictEqual(partRecord.ingestionDateUTC);
            expect(relatedPolygonPartRecord.footprint).toBePolygonGeometry();
            expect(relatedPolygonPartRecord.insertionOrder).toStrictEqual(partRecord.insertionOrder);
            expect(relatedPolygonPartRecord.partId).toStrictEqual(partRecord.id);
            expect(isValidUUIDv4(relatedPolygonPartRecord.id)).toBeTrue();
          }
        });

        expect.assertions(33);
      });

      it('should return 201 status code and create the resources for multiple parts, where the second covers the first', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(2);
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        const partData = polygonPartsPayload.partsData[0];
        const partDataCover = polygonPartsPayload.partsData[1];
        polygonPartsPayload.partsData = [
          { ...partData, ...{ footprint: (polygonHole as FeatureCollection).features[0].geometry as Polygon } },
          { ...partDataCover, ...{ footprint: (polygonEarth as FeatureCollection).features[0].geometry as Polygon } },
        ];
        const expectedPartRecords = toPostgresResponse(payloadToInsertPartsData(polygonPartsPayload)).map((expectedPartRecord) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { ...expectedPartRecord, horizontalAccuracyCE90: expect.closeTo(expectedPartRecord.horizontalAccuracyCE90, 2) };
        });
        const expectedPolygonCover = expectedPartRecords[1];

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);
        expect(polygonPartRecords).toMatchObject([expectedPolygonCover]);

        partRecords.forEach((partRecord, index) => {
          expect(partRecord.ingestionDateUTC).toBeBeforeOrEqualTo(new Date());
          expect(partRecord.footprint).toBePolygonGeometry();
          expect(partRecord.isProcessedPart).toBeTrue();
          expect(partRecord.insertionOrder).toBe(index + 1);
          expect(isValidUUIDv4(partRecord.id)).toBeTrue();

          const relatedPolygonPartRecords = polygonPartRecords.filter((polygonPartRecord) => polygonPartRecord.partId === partRecord.id);

          for (const relatedPolygonPartRecord of relatedPolygonPartRecords) {
            expect(relatedPolygonPartRecord.ingestionDateUTC).toStrictEqual(partRecord.ingestionDateUTC);
            expect(relatedPolygonPartRecord.footprint).toBePolygonGeometry();
            expect(relatedPolygonPartRecord.insertionOrder).toStrictEqual(partRecord.insertionOrder);
            expect(relatedPolygonPartRecord.partId).toStrictEqual(partRecord.id);
            expect(isValidUUIDv4(relatedPolygonPartRecord.id)).toBeTrue();
          }
        });

        expect.assertions(19);
      });

      it('should return 201 status code and create the resources for multiple parts, where the second is completely within the first (creating a hole)', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(2);
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        const partData = polygonPartsPayload.partsData[0];
        const partDataHoleCreator = polygonPartsPayload.partsData[1];
        polygonPartsPayload.partsData = [
          { ...partData, ...{ footprint: (polygonEarth as FeatureCollection).features[0].geometry as Polygon } },
          { ...partDataHoleCreator, ...{ footprint: (polygonHoleSplitter as FeatureCollection).features[0].geometry as Polygon } },
        ];
        const expectedPartRecords = toPostgresResponse(payloadToInsertPartsData(polygonPartsPayload)).map((expectedPartRecord) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { ...expectedPartRecord, horizontalAccuracyCE90: expect.closeTo(expectedPartRecord.horizontalAccuracyCE90, 2) };
        });
        const expectedPolygonPartRecords = expectedPartRecords.map(({ footprint, ...expectedPartRecord }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { footprint: expect.anything(), ...expectedPartRecord };
        });

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);
        expect(polygonPartRecords).toMatchObject(expectedPolygonPartRecords);
        expect(
          xor(polygonPartRecords[0].footprint.coordinates, [
            [
              [-180, -90],
              [180, -90],
              [180, 90],
              [-180, 90],
              [-180, -90],
            ],
            [
              [-20, -40],
              [20, -40],
              [20, 40],
              [-20, 40],
              [-20, -40],
            ],
          ])
        ).toHaveLength(0);
        expect(polygonPartRecords[1].footprint).toMatchObject(expectedPartRecords[1].footprint);

        partRecords.forEach((partRecord, index) => {
          expect(partRecord.ingestionDateUTC).toBeBeforeOrEqualTo(new Date());
          expect(partRecord.footprint).toBePolygonGeometry();
          expect(partRecord.isProcessedPart).toBeTrue();
          expect(partRecord.insertionOrder).toBe(index + 1);
          expect(isValidUUIDv4(partRecord.id)).toBeTrue();

          const relatedPolygonPartRecords = polygonPartRecords.filter((polygonPartRecord) => polygonPartRecord.partId === partRecord.id);

          for (const relatedPolygonPartRecord of relatedPolygonPartRecords) {
            expect(relatedPolygonPartRecord.ingestionDateUTC).toStrictEqual(partRecord.ingestionDateUTC);
            expect(relatedPolygonPartRecord.footprint).toBePolygonGeometry();
            expect(relatedPolygonPartRecord.insertionOrder).toStrictEqual(partRecord.insertionOrder);
            expect(relatedPolygonPartRecord.partId).toStrictEqual(partRecord.id);
            expect(isValidUUIDv4(relatedPolygonPartRecord.id)).toBeTrue();
          }
        });

        expect.assertions(26);
      });

      it.todo('test connection re-connection');
    });
  });

  describe('Bad Path', () => {
    describe('POST /polygonParts', () => {
      it('should return 400 status code if a product type is invalid value', async () => {
        const polygonPartsPayload = { ...createPolygonPartsPayload(1), productType: 'bad value' };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload as PolygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a catalog id is invalid value', async () => {
        const polygonPartsPayload = { ...createPolygonPartsPayload(1), catalogId: 'bad value' };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a product id is invalid value', async () => {
        const polygonPartsPayload = { ...createPolygonPartsPayload(1), productId: 'bad value' };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };
        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a product id has more than 38 characters', async () => {
        const polygonPartsPayload = { ...createPolygonPartsPayload(1), productId: 'a123456789b123456789c123456789d12345678' };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };
        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a product version is invalid value', async () => {
        const polygonPartsPayload = { ...createPolygonPartsPayload(1), productVersion: 'bad value' };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a countries is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], countries: [123] } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a cities is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], cities: [123] } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a sensors is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], sensors: 123 } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a source name is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], sourceName: 123 } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a resolution degree is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], resolutionDegree: 0 }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a resolution meter is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], resolutionMeter: 0 }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a source resolution meter is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], sourceResolutionMeter: 0 }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a horizontal accuracy ce90 is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], horizontalAccuracyCE90: 0 }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a imaging time begin utc is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], imagingTimeBeginUTC: 'bad value' } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a imaging time end utc is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], imagingTimeEndUTC: 'bad value' } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it.todo('should return 400 status code if a imaging time begin utc is later than current datetime');
      it.todo('should return 400 status code if a imaging time end utc is later than current datetime');
      it.todo('should return 400 status code if a imaging time begin utc is later than imaging time end utc');
      it.todo('should return 400 status code if a footprint is invalid value - first and last vertices are not equal');

      it('should return 400 status code if a footprint is invalid value - polygon must have coordinates property', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { coordinates, ...badFootprint } = randomPolygon(1, { num_vertices: 3 }).features[0].geometry;
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], footprint: badFootprint as unknown as Polygon }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a footprint is invalid value - polygon must have at least 3 vertices', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const badFootprint = randomPolygon(1, { num_vertices: 3 }).features[0].geometry;
        badFootprint.coordinates[0] = badFootprint.coordinates[0].filter((_, index) => (index === 1 ? false : true));
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], footprint: badFootprint }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a footprint is invalid value - polygon must have coordinates values in (-180,180) range', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const badFootprint = randomPolygon(1, { num_vertices: 3 }).features[0].geometry;
        badFootprint.coordinates[0][0][1] = 181;
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], footprint: badFootprint }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a footprint is invalid value - polygon must have type property', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { type, ...badFootprint } = randomPolygon(1, { num_vertices: 3 }).features[0].geometry;
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], footprint: badFootprint as unknown as Polygon }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a footprint is invalid value - polygon must have type property set to Polygon', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const badFootprint = { ...randomPolygon(1, { num_vertices: 3 }).features[0].geometry, type: 'Point' };
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], footprint: badFootprint as unknown as Polygon }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a source id is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], sourceId: 123 } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a description is invalid value', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], description: 123 } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if a partsData has no items', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        polygonPartsPayload.partsData = [];

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expect(response.body).toMatchObject({ message: expect.any(String) });
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });
    });
  });

  describe('Sad Path', () => {
    describe('POST /polygonParts', () => {
      it('should return 409 status code if a part resource already exists', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        const { parts } = getEntitiesNames(polygonPartsPayload);
        await helperDB.createTable(parts.entityName, schema);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toMatchObject({ message: `table with the name '${parts.databaseObjectQualifiedName}' already exists` });
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 409 status code if a polygon part resource already exists', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        const { polygonParts } = getEntitiesNames(polygonPartsPayload);
        await helperDB.createTable(polygonParts.entityName, schema);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toMatchObject({ message: `table with the name '${polygonParts.databaseObjectQualifiedName}' already exists` });
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 500 status code for a database error - set search_path error', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        const spyQuery = jest.spyOn(EntityManager.prototype, 'query').mockRejectedValueOnce(new Error());

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: 'Unknown Error' });
        expect(response).toSatisfyApiSpec();
        expect(spyQuery).toHaveBeenCalledTimes(1);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeFalse();
        expect(existsPolygonParts).toBeFalse();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - verify available tables (first table) error', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        const spyGetExists = jest.spyOn(SelectQueryBuilder.prototype, 'getExists').mockRejectedValueOnce(new Error());

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: 'Unknown Error' });
        expect(response).toSatisfyApiSpec();
        expect(spyGetExists).toHaveBeenCalledTimes(2);

        spyGetExists.mockRestore();

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeFalse();
        expect(existsPolygonParts).toBeFalse();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - verify available tables (second table) error', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        const spyGetExists = jest.spyOn(SelectQueryBuilder.prototype, 'getExists').mockResolvedValueOnce(false).mockRejectedValueOnce(new Error());

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: 'Unknown Error' });
        expect(response).toSatisfyApiSpec();
        expect(spyGetExists).toHaveBeenCalledTimes(2);

        spyGetExists.mockRestore();

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeFalse();
        expect(existsPolygonParts).toBeFalse();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - create tables error', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalQuery = EntityManager.prototype.query;
        const spyQuery = jest.spyOn(EntityManager.prototype, 'query').mockImplementationOnce(originalQuery).mockRejectedValueOnce(new Error());

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: 'Unknown Error' });
        expect(response).toSatisfyApiSpec();
        expect(spyQuery).toHaveBeenCalledTimes(2);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeFalse();
        expect(existsPolygonParts).toBeFalse();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - insert error', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        const spyInsert = jest.spyOn(Repository.prototype, 'insert').mockRejectedValueOnce(new Error());

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: 'Unknown Error' });
        expect(response).toSatisfyApiSpec();
        expect(spyInsert).toHaveBeenCalledTimes(1);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeFalse();
        expect(existsPolygonParts).toBeFalse();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - calculate polygon parts error', async () => {
        const polygonPartsPayload = createPolygonPartsPayload(1);
        const { parts, polygonParts } = getEntitiesNames(polygonPartsPayload);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalQuery = EntityManager.prototype.query;
        const spyQuery = jest
          .spyOn(EntityManager.prototype, 'query')
          .mockImplementationOnce(originalQuery)
          .mockImplementationOnce(originalQuery)
          .mockRejectedValueOnce(new Error());

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: 'Unknown Error' });
        expect(response).toSatisfyApiSpec();
        expect(spyQuery).toHaveBeenCalledTimes(3);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeFalse();
        expect(existsPolygonParts).toBeFalse();

        expect.assertions(6);
      });

      it.todo('should return 500 status code for a database error - no connection');
      it.todo('should return 500 status code for a database error - timeout');
    });
  });
});
