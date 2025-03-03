import { faker } from '@faker-js/faker';
import jsLogger from '@map-colonies/js-logger';
import { CORE_VALIDATIONS, INGESTION_VALIDATIONS, PolygonPart as PolygonPartType } from '@map-colonies/raster-shared';
import { trace } from '@opentelemetry/api';
import { booleanEqual } from '@turf/boolean-equal';
import { randomPolygon } from '@turf/random';
import config from 'config';
import type { FeatureCollection, Polygon } from 'geojson';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { xor } from 'martinez-polygon-clipping';
import { container } from 'tsyringe';
import { EntityManager, Repository, SelectQueryBuilder, type DataSourceOptions } from 'typeorm';
import { getApp } from '../../../src/app';
import { ConnectionManager } from '../../../src/common/connectionManager';
import { SERVICES } from '../../../src/common/constants';
import type { ApplicationConfig, DbConfig } from '../../../src/common/interfaces';
import { Transformer } from '../../../src/common/middlewares/transformer';
import { Part } from '../../../src/polygonParts/DAL/part';
import { PolygonPart } from '../../../src/polygonParts/DAL/polygonPart';
import type { EntitiesMetadata, EntityIdentifierObject, PolygonPartsPayload } from '../../../src/polygonParts/models/interfaces';
import {
  createInitPayloadRequest,
  franceFootprint,
  germanyFootprint,
  intersectionWithItalyFootprint,
  intersectionWithItalyRequest,
  italyFootprint,
  italyWithoutIntersection,
  separatePolygonsRequest,
  worldFootprint,
  worldMinusSeparateCountries,
} from '../../mocks/requestsMocks';
import polygonEarth from './data/polygonEarth.json';
import polygonHole from './data/polygonHole.json';
import polygonHoleSplitter from './data/polygonHoleSplitter.json';
import { INITIAL_DB } from './helpers/constants';
import { HelperDB, createDB, generatePolygonPartsPayload } from './helpers/db';
import { PolygonPartsRequestSender } from './helpers/requestSender';
import { isValidUUIDv4, toExpectedPostgresResponse } from './helpers/utils';

const INTERNAL_DB_GEOM_PRECISION = 12; // TODO: adjust precision to the capability of underlying DB precision query response
let testDataSourceOptions: DataSourceOptions;
const applicationConfig = config.get<ApplicationConfig>('application');
const dbConfig = config.get<Required<DbConfig>>('db');
const { schema } = dbConfig;

describe('polygonParts', () => {
  let requestSender: PolygonPartsRequestSender;
  let helperDB: HelperDB;
  let getEntitiesMetadata: (
    entityIdentifierOptions: EntityIdentifierObject | Pick<PolygonPartsPayload, 'productId' | 'productType'>
  ) => EntitiesMetadata;

  beforeAll(async () => {
    testDataSourceOptions = ConnectionManager.createConnectionOptions(dbConfig);
    await createDB({ options: testDataSourceOptions, initialDatabase: INITIAL_DB });
    helperDB = new HelperDB(testDataSourceOptions);
    await helperDB.initConnection();
  });

  afterAll(async () => {
    await helperDB.destroyConnection();
    /* uncomment this when running locally, this deletes the created db after all tests,
    instead of removing it manually after each run.*/
    // await deleteDB(testDataSourceOptions);
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
  });

  describe('Happy Path', () => {
    describe('POST /polygonParts', () => {
      // TODO: check for tracing is sent side effect
      it('should return 201 status code and create the resources for a single part', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPartRecord = toExpectedPostgresResponse(polygonPartsPayload);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        // TODO: once openapi type generator is utilized consider using it's status definition
        // TODO: consider adding a custom matcher - extending jest
        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
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

        expect.assertions(15);
      });

      it('should return 201 status code and create the resources for a single part with a hole', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const partDataHole = polygonPartsPayload.partsData[0];
        polygonPartsPayload.partsData = [{ ...partDataHole, ...{ footprint: (polygonHole as FeatureCollection).features[0].geometry as Polygon } }];
        const expectedPartRecord = toExpectedPostgresResponse(polygonPartsPayload);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
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

        expect.assertions(15);
      });

      it.each([
        { min: 2, max: 10 },
        { min: 11, max: 100 },
        { min: 101, max: 200 },
      ])('should return 201 status code and create the resources for multiple parts (between $min - $max parts)', async ({ min, max }) => {
        const partsCount = faker.number.int({ min, max });
        const polygonPartsPayload = generatePolygonPartsPayload(partsCount);
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPartRecords = toExpectedPostgresResponse(polygonPartsPayload);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
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
        const polygonPartsPayload = generatePolygonPartsPayload(2);
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const partDataHole = polygonPartsPayload.partsData[0];
        const partDataSpliting = polygonPartsPayload.partsData[1];
        polygonPartsPayload.partsData = [
          { ...partDataHole, ...{ footprint: (polygonHole as FeatureCollection).features[0].geometry as Polygon } },
          { ...partDataSpliting, ...{ footprint: (polygonHoleSplitter as FeatureCollection).features[0].geometry as Polygon } },
        ];
        const [expectedPolygonHole, expectedPolygonSplitter] = toExpectedPostgresResponse(polygonPartsPayload);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedPolygonPartRecords1 = { ...expectedPolygonHole, footprint: expect.anything() };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedPolygonPartRecords2 = { ...expectedPolygonHole, footprint: expect.anything() };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);
        const [polygonPart1, polygonPart2, polygonPart3] = polygonPartRecords;

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
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

        expect.assertions(34);
      });

      it('should return 201 status code and create the resources for multiple parts, where the second covers the first', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(2);
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const partData = polygonPartsPayload.partsData[0];
        const partDataCover = polygonPartsPayload.partsData[1];
        polygonPartsPayload.partsData = [
          { ...partData, ...{ footprint: (polygonHole as FeatureCollection).features[0].geometry as Polygon } },
          { ...partDataCover, ...{ footprint: (polygonEarth as FeatureCollection).features[0].geometry as Polygon } },
        ];
        const expectedPartRecords = toExpectedPostgresResponse(polygonPartsPayload);
        const expectedPolygonCover = expectedPartRecords[1];

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
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

        expect.assertions(20);
      });

      it('should return 201 status code and create the resources for multiple parts, where the second is completely within the first (creating a hole)', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(2);
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const partData = polygonPartsPayload.partsData[0];
        const partDataHoleCreator = polygonPartsPayload.partsData[1];
        polygonPartsPayload.partsData = [
          { ...partData, ...{ footprint: (polygonEarth as FeatureCollection).features[0].geometry as Polygon } },
          { ...partDataHoleCreator, ...{ footprint: (polygonHoleSplitter as FeatureCollection).features[0].geometry as Polygon } },
        ];
        const expectedPartRecords = toExpectedPostgresResponse(polygonPartsPayload);
        const expectedPolygonPartRecords = expectedPartRecords.map(({ footprint, ...expectedPartRecord }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { footprint: expect.anything(), ...expectedPartRecord };
        });

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
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

        expect.assertions(27);
      });

      it('should return 201 status code and create the resources for multiple parts, where polygon parts are generated for a small area equal to or above threshold', async () => {
        const squareSideLength = applicationConfig.entities.polygonParts.minAreaSquareDeg ** 0.5;
        const partFootprints = [
          {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1 + squareSideLength, 0],
                [1 + squareSideLength, squareSideLength],
                [0, squareSideLength],
                [0, 0],
              ],
            ],
          },
          {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 90],
                [0, 90],
                [0, 0],
              ],
            ],
          },
        ] satisfies [Polygon, Polygon];
        const generatedPolygonPartsPayload = generatePolygonPartsPayload(2);
        const polygonPartsPayload = {
          ...generatedPolygonPartsPayload,
          partsData: generatedPolygonPartsPayload.partsData.map((partData, index) => {
            return { ...partData, footprint: partFootprints[index] };
          }),
        };
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPolygonPartFootprints = [
          {
            type: 'Polygon',
            coordinates: [
              [
                [1, 0],
                [1 + squareSideLength, 0],
                [1 + squareSideLength, squareSideLength],
                [1, squareSideLength],
                [1, 0],
              ],
            ],
          },
          {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 90],
                [0, 90],
                [0, 0],
              ],
            ],
          },
        ] satisfies [Polygon, Polygon];
        const expectedPartRecords = toExpectedPostgresResponse(polygonPartsPayload).map(({ footprint, ...expectedPartRecord }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { footprint: expect.anything(), ...expectedPartRecord };
        });
        const expectedPolygonPartRecords = expectedPartRecords;

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);
        expect(
          booleanEqual(partRecords[0].footprint, polygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(partRecords[1].footprint, polygonPartsPayload.partsData[1].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(polygonPartRecords).toMatchObject(expectedPolygonPartRecords);
        expect(booleanEqual(polygonPartRecords[0].footprint, expectedPolygonPartFootprints[0], { precision: INTERNAL_DB_GEOM_PRECISION })).toBeTrue();
        expect(booleanEqual(polygonPartRecords[1].footprint, expectedPolygonPartFootprints[1], { precision: INTERNAL_DB_GEOM_PRECISION })).toBeTrue();

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

        expect.assertions(29);
      });

      it('should return 201 status code and create the resources for multiple parts, where polygon parts are not generated for a small area below threshold', async () => {
        const squareSideLength = applicationConfig.entities.polygonParts.minAreaSquareDeg ** 0.5;
        const partFootprints = [
          {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1 + squareSideLength - Number.EPSILON, 0],
                [1 + squareSideLength - Number.EPSILON, squareSideLength],
                [0, squareSideLength],
                [0, 0],
              ],
            ],
          },
          {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 90],
                [0, 90],
                [0, 0],
              ],
            ],
          },
        ] satisfies [Polygon, Polygon];
        const generatedPolygonPartsPayload = generatePolygonPartsPayload(2);
        const polygonPartsPayload = {
          ...generatedPolygonPartsPayload,
          partsData: generatedPolygonPartsPayload.partsData.map((partData, index) => {
            return { ...partData, footprint: partFootprints[index] };
          }),
        };
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPolygonPartFootprint = {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 90],
              [0, 90],
              [0, 0],
            ],
          ],
        } satisfies Polygon;
        const expectedPartRecords = toExpectedPostgresResponse(polygonPartsPayload).map(({ footprint, ...expectedPartRecord }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { footprint: expect.anything(), ...expectedPartRecord };
        });
        const expectedPolygonPartRecords = [expectedPartRecords[1]];

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);
        expect(
          booleanEqual(partRecords[0].footprint, polygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(partRecords[1].footprint, polygonPartsPayload.partsData[1].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(polygonPartRecords).toMatchObject(expectedPolygonPartRecords);
        expect(booleanEqual(polygonPartRecords[0].footprint, expectedPolygonPartFootprint, { precision: INTERNAL_DB_GEOM_PRECISION })).toBeTrue();

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

        expect.assertions(23);
      });

      it('should return 201 status code and create the resources for multiple parts, where polygon parts are generated for a small area below threshold and not intersected by other polygon parts', async () => {
        const squareSideLength = applicationConfig.entities.polygonParts.minAreaSquareDeg ** 0.5;
        const partFootprints = [
          {
            type: 'Polygon',
            coordinates: [
              [
                [10, 0],
                [11, 0],
                [11, squareSideLength - Number.EPSILON],
                [10, squareSideLength],
                [10, 0],
              ],
            ],
          },
          {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 90],
                [0, 90],
                [0, 0],
              ],
            ],
          },
        ] satisfies [Polygon, Polygon];
        const generatedPolygonPartsPayload = generatePolygonPartsPayload(2);
        const polygonPartsPayload = {
          ...generatedPolygonPartsPayload,
          partsData: generatedPolygonPartsPayload.partsData.map((partData, index) => {
            return { ...partData, footprint: partFootprints[index] };
          }),
        };
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPolygonPartFootprints = [
          {
            type: 'Polygon',
            coordinates: [
              [
                [10, 0],
                [11, 0],
                [11, squareSideLength - Number.EPSILON],
                [10, squareSideLength],
                [10, 0],
              ],
            ],
          },
          {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 90],
                [0, 90],
                [0, 0],
              ],
            ],
          },
        ] satisfies [Polygon, Polygon];
        const expectedPartRecords = toExpectedPostgresResponse(polygonPartsPayload).map(({ footprint, ...expectedPartRecord }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { footprint: expect.anything(), ...expectedPartRecord };
        });
        const expectedPolygonPartRecords = expectedPartRecords;

        const response = await requestSender.createPolygonParts(polygonPartsPayload);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);
        expect(
          booleanEqual(partRecords[0].footprint, polygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(partRecords[1].footprint, polygonPartsPayload.partsData[1].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(polygonPartRecords).toMatchObject(expectedPolygonPartRecords);
        expect(booleanEqual(polygonPartRecords[0].footprint, expectedPolygonPartFootprints[0], { precision: INTERNAL_DB_GEOM_PRECISION })).toBeTrue();
        expect(booleanEqual(polygonPartRecords[1].footprint, expectedPolygonPartFootprints[1], { precision: INTERNAL_DB_GEOM_PRECISION })).toBeTrue();

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

        expect.assertions(29);
      });

      it('should return 201 status code if resolution degree is right on the lower border (0.000000167638063430786)', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], resolutionDegree: CORE_VALIDATIONS.resolutionDeg.min }];
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPartRecord = toExpectedPostgresResponse(polygonPartsPayload);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(partRecords).toMatchObject(expectedPartRecord);
        expect(polygonPartRecords).toMatchObject(expectedPartRecord);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect.assertions(4);
      });

      it('should return 201 status code if resolution degree is right on the upper border (0.703125)', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], resolutionDegree: CORE_VALIDATIONS.resolutionDeg.max }];
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPartRecord = toExpectedPostgresResponse(polygonPartsPayload);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(partRecords).toMatchObject(expectedPartRecord);
        expect(polygonPartRecords).toMatchObject(expectedPartRecord);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect.assertions(4);
      });

      it('should return 201 status code if resolution meter is right on the lower border (0.0185)', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], resolutionMeter: INGESTION_VALIDATIONS.resolutionMeter.min }];
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPartRecord = toExpectedPostgresResponse(polygonPartsPayload);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(partRecords).toMatchObject(expectedPartRecord);
        expect(polygonPartRecords).toMatchObject(expectedPartRecord);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect.assertions(4);
      });

      it('should return 201 status code if resolution meter is right on the upper border (78271.52)', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], resolutionMeter: INGESTION_VALIDATIONS.resolutionMeter.max }];
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPartRecord = toExpectedPostgresResponse(polygonPartsPayload);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(partRecords).toMatchObject(expectedPartRecord);
        expect(polygonPartRecords).toMatchObject(expectedPartRecord);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect.assertions(4);
      });

      it('should return 201 status code if source resolution meter is right on the lower border (0.0185)', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], sourceResolutionMeter: INGESTION_VALIDATIONS.resolutionMeter.min }];
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPartRecord = toExpectedPostgresResponse(polygonPartsPayload);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(partRecords).toMatchObject(expectedPartRecord);
        expect(polygonPartRecords).toMatchObject(expectedPartRecord);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect.assertions(4);
      });

      it('should return 201 status code if source resolution meter is right on the upper border (78271.52)', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], sourceResolutionMeter: INGESTION_VALIDATIONS.resolutionMeter.max }];
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPartRecord = toExpectedPostgresResponse(polygonPartsPayload);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(partRecords).toMatchObject(expectedPartRecord);
        expect(polygonPartRecords).toMatchObject(expectedPartRecord);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect.assertions(4);
      });

      it('should return 201 status code if horizontal accuracy ce90 is right on the lower border (0.01)', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [
          { ...polygonPartsPayload.partsData[0], horizontalAccuracyCE90: INGESTION_VALIDATIONS.horizontalAccuracyCE90.min },
        ];
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPartRecord = toExpectedPostgresResponse(polygonPartsPayload);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(partRecords).toMatchObject(expectedPartRecord);
        expect(polygonPartRecords).toMatchObject(expectedPartRecord);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect.assertions(4);
      });

      it('should return 201 status code if horizontal accuracy ce90 is right on the upper border (4000)', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [
          { ...polygonPartsPayload.partsData[0], horizontalAccuracyCE90: INGESTION_VALIDATIONS.horizontalAccuracyCE90.max },
        ];
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedPartRecord = toExpectedPostgresResponse(polygonPartsPayload);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(partRecords).toMatchObject(expectedPartRecord);
        expect(polygonPartRecords).toMatchObject(expectedPartRecord);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();

        expect.assertions(4);
      });

      it.todo('test connection re-connection');
    });

    describe('PUT /polygonParts', () => {
      it('should return 200 status code on regular update with 3 non intersecting polygons', async () => {
        const insertPolygonPartsPayload = createInitPayloadRequest;
        await requestSender.createPolygonParts(insertPolygonPartsPayload);
        const updatePayload = separatePolygonsRequest;
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);

        const response = await requestSender.updatePolygonParts(updatePayload, false);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(polygonPartRecords).toHaveLength(4);
        expect(partRecords).toHaveLength(4);
        expect(partRecords[0].footprint).toEqual(worldFootprint);
        expect(partRecords[1].footprint).toEqual(franceFootprint);
        expect(partRecords[2].footprint).toEqual(germanyFootprint);
        expect(partRecords[3].footprint).toEqual(italyFootprint);
        expect(partRecords[1].insertionOrder).toBe(2);
        expect(partRecords[2].insertionOrder).toBe(3);
        expect(partRecords[3].insertionOrder).toBe(4);
        expect(partRecords[1].isProcessedPart).toBe(true);
        expect(partRecords[2].isProcessedPart).toBe(true);
        expect(partRecords[3].isProcessedPart).toBe(true);

        expect(polygonPartRecords[0].footprint).toEqual(worldMinusSeparateCountries);
        expect(polygonPartRecords[0].insertionOrder).toBe(1);

        expect.assertions(17);
      });

      it('should return 200 status code on regular update with 2 intersecting polygons', async () => {
        const insertPolygonPartsPayload = createInitPayloadRequest;
        await requestSender.createPolygonParts(insertPolygonPartsPayload);
        const updatePayload = intersectionWithItalyRequest;
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);

        const response = await requestSender.updatePolygonParts(updatePayload, false);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(polygonPartRecords).toHaveLength(3);
        expect(partRecords).toHaveLength(3);
        expect(partRecords[0].footprint).toEqual(worldFootprint);
        expect(partRecords[1].footprint).toEqual(italyFootprint);
        expect(partRecords[2].footprint).toEqual(intersectionWithItalyFootprint);
        expect(partRecords[1].insertionOrder).toBe(2);
        expect(partRecords[2].insertionOrder).toBe(3);
        expect(partRecords[1].isProcessedPart).toBe(true);
        expect(partRecords[2].isProcessedPart).toBe(true);

        expect(polygonPartRecords[1].footprint).toEqual(italyWithoutIntersection);

        expect.assertions(13);
      });

      it('should return 200 status code on swap update with world polygon', async () => {
        const insertPolygonPartsPayload = createInitPayloadRequest;
        await requestSender.createPolygonParts(insertPolygonPartsPayload);
        await requestSender.updatePolygonParts(separatePolygonsRequest, false);
        const updatePayload = createInitPayloadRequest;
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);

        const response = await requestSender.updatePolygonParts(updatePayload, true);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(polygonPartRecords).toHaveLength(1);
        expect(partRecords).toHaveLength(1);
        expect(partRecords[0].footprint).toEqual(worldFootprint);
        expect(polygonPartRecords[0].footprint).toEqual(worldFootprint);

        expect.assertions(7);
      });

      it('should return 200 status code and update the resources for a part with a small area (equal to or above threshold) intersecting existing polygon part (below threshold)', async () => {
        const squareSideLength = applicationConfig.entities.polygonParts.minAreaSquareDeg ** 0.5;
        const insertPolygonPartsPayload = generatePolygonPartsPayload({
          partsData: [
            {
              footprint: {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [squareSideLength, 0],
                    [squareSideLength, squareSideLength - Number.EPSILON],
                    [0, squareSideLength],
                    [0, 0],
                  ],
                ],
              },
            },
          ],
        });
        await requestSender.createPolygonParts(insertPolygonPartsPayload);
        const updatePolygonPartsPayload = generatePolygonPartsPayload({
          productId: insertPolygonPartsPayload.productId,
          productType: insertPolygonPartsPayload.productType,
          partsData: [
            {
              footprint: {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [squareSideLength, 0],
                    [squareSideLength, squareSideLength],
                    [0, squareSideLength],
                    [0, 0],
                  ],
                ],
              },
            },
          ],
        });
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(insertPolygonPartsPayload);
        const expectedPartRecords = [
          ...toExpectedPostgresResponse(insertPolygonPartsPayload),
          ...toExpectedPostgresResponse(updatePolygonPartsPayload),
        ].map(({ footprint, ...expectedPartRecord }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { footprint: expect.anything(), ...expectedPartRecord };
        });
        const expectedPolygonPartRecords = [expectedPartRecords[1]];

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, false);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);
        expect(
          booleanEqual(partRecords[0].footprint, insertPolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(partRecords[1].footprint, updatePolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(polygonPartRecords).toMatchObject(expectedPolygonPartRecords);
        expect(
          booleanEqual(polygonPartRecords[0].footprint, updatePolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();

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

        expect.assertions(23);
      });

      it('should return 200 status code and update the resources for a part with a small area (equal to or above threshold) not intersecting existing polygon parts (below threshold)', async () => {
        const squareSideLength = applicationConfig.entities.polygonParts.minAreaSquareDeg ** 0.5;
        const insertPolygonPartsPayload = generatePolygonPartsPayload({
          partsData: [
            {
              footprint: {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [squareSideLength, 0],
                    [squareSideLength, squareSideLength - Number.EPSILON],
                    [0, squareSideLength],
                    [0, 0],
                  ],
                ],
              },
            },
          ],
        });
        await requestSender.createPolygonParts(insertPolygonPartsPayload);
        const updatePolygonPartsPayload = generatePolygonPartsPayload({
          productId: insertPolygonPartsPayload.productId,
          productType: insertPolygonPartsPayload.productType,
          partsData: [
            {
              footprint: {
                type: 'Polygon',
                coordinates: [
                  [
                    [10, 0],
                    [10 + squareSideLength, 0],
                    [10 + squareSideLength, squareSideLength],
                    [10, squareSideLength],
                    [10, 0],
                  ],
                ],
              },
            },
          ],
        });
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(insertPolygonPartsPayload);
        const expectedPartRecords = [
          ...toExpectedPostgresResponse(insertPolygonPartsPayload),
          ...toExpectedPostgresResponse(updatePolygonPartsPayload),
        ].map(({ footprint, ...expectedPartRecord }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { footprint: expect.anything(), ...expectedPartRecord };
        });
        const expectedPolygonPartRecords = expectedPartRecords;

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, false);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);
        expect(
          booleanEqual(partRecords[0].footprint, insertPolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(partRecords[1].footprint, updatePolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(polygonPartRecords).toMatchObject(expectedPolygonPartRecords);
        expect(
          booleanEqual(polygonPartRecords[0].footprint, insertPolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(polygonPartRecords[1].footprint, updatePolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();

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

        expect.assertions(29);
      });

      it('should return 200 status code and update the resources for a part with a small area (below threshold) intersecting existing polygon part (below threshold)', async () => {
        const squareSideLength = applicationConfig.entities.polygonParts.minAreaSquareDeg ** 0.5;
        const insertPolygonPartsPayload = generatePolygonPartsPayload({
          partsData: [
            {
              footprint: {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [squareSideLength, 0],
                    [squareSideLength, squareSideLength - Number.EPSILON],
                    [0, squareSideLength],
                    [0, 0],
                  ],
                ],
              },
            },
          ],
        });
        await requestSender.createPolygonParts(insertPolygonPartsPayload);
        const updatePolygonPartsPayload = generatePolygonPartsPayload({
          productId: insertPolygonPartsPayload.productId,
          productType: insertPolygonPartsPayload.productType,
          partsData: [
            {
              footprint: {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [squareSideLength, 0],
                    [squareSideLength - Number.EPSILON, squareSideLength],
                    [0, squareSideLength],
                    [0, 0],
                  ],
                ],
              },
            },
          ],
        });
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(insertPolygonPartsPayload);
        const expectedPartRecords = [
          ...toExpectedPostgresResponse(insertPolygonPartsPayload),
          ...toExpectedPostgresResponse(updatePolygonPartsPayload),
        ].map(({ footprint, ...expectedPartRecord }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { footprint: expect.anything(), ...expectedPartRecord };
        });
        const expectedPolygonPartRecords = [expectedPartRecords[1]];

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, false);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);
        expect(
          booleanEqual(partRecords[0].footprint, insertPolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(partRecords[1].footprint, updatePolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(polygonPartRecords).toMatchObject(expectedPolygonPartRecords);
        expect(
          booleanEqual(polygonPartRecords[0].footprint, updatePolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();

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

        expect.assertions(23);
      });

      it('should return 200 status code and update the resources for a part with a small area (below threshold) not intersecting existing polygon parts (below threshold)', async () => {
        const squareSideLength = applicationConfig.entities.polygonParts.minAreaSquareDeg ** 0.5;
        const insertPolygonPartsPayload = generatePolygonPartsPayload({
          partsData: [
            {
              footprint: {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [squareSideLength, 0],
                    [squareSideLength, squareSideLength - Number.EPSILON],
                    [0, squareSideLength],
                    [0, 0],
                  ],
                ],
              },
            },
          ],
        });
        await requestSender.createPolygonParts(insertPolygonPartsPayload);
        const updatePolygonPartsPayload = generatePolygonPartsPayload({
          productId: insertPolygonPartsPayload.productId,
          productType: insertPolygonPartsPayload.productType,
          partsData: [
            {
              footprint: {
                type: 'Polygon',
                coordinates: [
                  [
                    [10, 0],
                    [10 + squareSideLength, 0],
                    [10 + squareSideLength, squareSideLength - Number.EPSILON],
                    [10, squareSideLength],
                    [10, 0],
                  ],
                ],
              },
            },
          ],
        });
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(insertPolygonPartsPayload);
        const expectedPartRecords = [
          ...toExpectedPostgresResponse(insertPolygonPartsPayload),
          ...toExpectedPostgresResponse(updatePolygonPartsPayload),
        ].map(({ footprint, ...expectedPartRecord }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { footprint: expect.anything(), ...expectedPartRecord };
        });
        const expectedPolygonPartRecords = expectedPartRecords;

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, false);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);
        expect(
          booleanEqual(partRecords[0].footprint, insertPolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(partRecords[1].footprint, updatePolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(polygonPartRecords).toMatchObject(expectedPolygonPartRecords);
        expect(
          booleanEqual(polygonPartRecords[0].footprint, insertPolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(polygonPartRecords[1].footprint, updatePolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();

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

        expect.assertions(29);
      });

      it('should return 200 status code and update the resources for a part with a small area (below threshold) intersecting existing polygon part (above threshold)', async () => {
        const squareSideLength = applicationConfig.entities.polygonParts.minAreaSquareDeg ** 0.5;
        const insertPolygonPartsPayload = generatePolygonPartsPayload({
          partsData: [
            {
              footprint: {
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
              },
            },
          ],
        });
        await requestSender.createPolygonParts(insertPolygonPartsPayload);
        const updatePolygonPartsPayload = generatePolygonPartsPayload({
          productId: insertPolygonPartsPayload.productId,
          productType: insertPolygonPartsPayload.productType,
          partsData: [
            {
              footprint: {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [squareSideLength, 0],
                    [squareSideLength - Number.EPSILON, squareSideLength],
                    [0, squareSideLength],
                    [0, 0],
                  ],
                ],
              },
            },
          ],
        });
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(insertPolygonPartsPayload);
        const expectedPolygonPartFootprints = [
          {
            type: 'Polygon',
            coordinates: [
              [
                [squareSideLength, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, squareSideLength],
                [squareSideLength - Number.EPSILON, squareSideLength],
                [squareSideLength, 0],
              ],
            ],
          },
          {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [squareSideLength, 0],
                [squareSideLength - Number.EPSILON, squareSideLength],
                [0, squareSideLength],
                [0, 0],
              ],
            ],
          },
        ] satisfies [Polygon, Polygon];
        const expectedPartRecords = [
          ...toExpectedPostgresResponse(insertPolygonPartsPayload),
          ...toExpectedPostgresResponse(updatePolygonPartsPayload),
        ].map(({ footprint, ...expectedPartRecord }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { footprint: expect.anything(), ...expectedPartRecord };
        });
        const expectedPolygonPartRecords = expectedPartRecords;

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, false);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);
        expect(
          booleanEqual(partRecords[0].footprint, insertPolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(partRecords[1].footprint, updatePolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(polygonPartRecords).toMatchObject(expectedPolygonPartRecords);
        expect(booleanEqual(polygonPartRecords[0].footprint, expectedPolygonPartFootprints[0], { precision: INTERNAL_DB_GEOM_PRECISION })).toBeTrue();
        expect(booleanEqual(polygonPartRecords[1].footprint, expectedPolygonPartFootprints[1], { precision: INTERNAL_DB_GEOM_PRECISION })).toBeTrue();

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

        expect.assertions(29);
      });

      it('should return 200 status code and update the resources for a part with a small area (below threshold) not intersecting existing polygon part (above threshold)', async () => {
        const squareSideLength = applicationConfig.entities.polygonParts.minAreaSquareDeg ** 0.5;
        const insertPolygonPartsPayload = generatePolygonPartsPayload({
          partsData: [
            {
              footprint: {
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
              },
            },
          ],
        });
        await requestSender.createPolygonParts(insertPolygonPartsPayload);
        const updatePolygonPartsPayload = generatePolygonPartsPayload({
          productId: insertPolygonPartsPayload.productId,
          productType: insertPolygonPartsPayload.productType,
          partsData: [
            {
              footprint: {
                type: 'Polygon',
                coordinates: [
                  [
                    [10, 0],
                    [10 + squareSideLength, 0],
                    [10 + squareSideLength - Number.EPSILON, squareSideLength],
                    [10, squareSideLength],
                    [10, 0],
                  ],
                ],
              },
            },
          ],
        });
        const {
          entityIdentifier,
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(insertPolygonPartsPayload);
        const expectedPartRecords = [
          ...toExpectedPostgresResponse(insertPolygonPartsPayload),
          ...toExpectedPostgresResponse(updatePolygonPartsPayload),
        ].map(({ footprint, ...expectedPartRecord }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          return { footprint: expect.anything(), ...expectedPartRecord };
        });
        const expectedPolygonPartRecords = expectedPartRecords;

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, false);
        const partRecords = await helperDB.find(parts.databaseObjectQualifiedName, Part);
        const polygonPartRecords = await helperDB.find(polygonParts.databaseObjectQualifiedName, PolygonPart);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toStrictEqual<EntityIdentifierObject>({ polygonPartsEntityName: entityIdentifier });
        expect(response).toSatisfyApiSpec();

        expect(partRecords.sort((a, b) => a.insertionOrder - b.insertionOrder)).toMatchObject(expectedPartRecords);
        expect(
          booleanEqual(partRecords[0].footprint, insertPolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(partRecords[1].footprint, updatePolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(polygonPartRecords).toMatchObject(expectedPolygonPartRecords);
        expect(
          booleanEqual(polygonPartRecords[0].footprint, insertPolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();
        expect(
          booleanEqual(polygonPartRecords[1].footprint, updatePolygonPartsPayload.partsData[0].footprint, { precision: INTERNAL_DB_GEOM_PRECISION })
        ).toBeTrue();

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

        expect.assertions(29);
      });
    });
  });

  describe('Bad Path', () => {
    describe('POST /polygonParts', () => {
      it('should return 400 status code if product type is an invalid value', async () => {
        const polygonPartsPayload = { ...generatePolygonPartsPayload(1), productType: 'bad value' };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload as PolygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if catalog id is an invalid value', async () => {
        const polygonPartsPayload = { ...generatePolygonPartsPayload(1), catalogId: 'bad value' };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if product id is an invalid value', async () => {
        const polygonPartsPayload = { ...generatePolygonPartsPayload(1), productId: 'bad value' };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };
        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if product id has more than 38 characters', async () => {
        const polygonPartsPayload = { ...generatePolygonPartsPayload(1), productId: 'a123456789b123456789c123456789d12345678' };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };
        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if product version is an invalid value', async () => {
        const polygonPartsPayload = { ...generatePolygonPartsPayload(1), productVersion: 'bad value' };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if countries is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], countries: [123] } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if cities is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], cities: [123] } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if sensors is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], sensors: 123 } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if source name is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], sourceName: 123 } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if resolution degree is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], resolutionDegree: 0 }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if resolution meter is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], resolutionMeter: 0 }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if source resolution meter is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], sourceResolutionMeter: 0 }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if horizontal accuracy ce90 is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], horizontalAccuracyCE90: 0 }];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if imaging time begin utc is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], imagingTimeBeginUTC: 'bad value' } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if imaging time end utc is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], imagingTimeEndUTC: 'bad value' } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it.todo('should return 400 status code if imaging time begin utc is later than current datetime');
      it.todo('should return 400 status code if imaging time end utc is later than current datetime');
      it.todo('should return 400 status code if imaging time begin utc is later than imaging time end utc');
      it.todo('should return 400 status code if footprint is an invalid value - first and last vertices are not equal');

      it('should return 400 status code if footprint is an invalid value - polygon must have coordinates property', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
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

      it('should return 400 status code if footprint is an invalid value - polygon must have at least 3 vertices', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
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

      it('should return 400 status code if footprint is an invalid value - polygon must have coordinates values in (-180,180) range', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
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

      it('should return 400 status code if footprint is an invalid value - polygon must have type property', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
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

      it('should return 400 status code if footprint is an invalid value - polygon must have type property set to Polygon', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
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

      it('should return 400 status code if source id is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], sourceId: 123 } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if description is an invalid value', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [{ ...polygonPartsPayload.partsData[0], description: 123 } as unknown as PolygonPartType];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const expectedErrorMessage = { message: expect.any(String) };

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if partsData has no items', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        polygonPartsPayload.partsData = [];

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expect(response.body).toMatchObject({ message: expect.any(String) });
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });
    });

    describe('PUT /polygonParts', () => {
      beforeEach(async () => {
        const insertPolygonPartsPayload = createInitPayloadRequest;
        await requestSender.createPolygonParts(insertPolygonPartsPayload);
      });

      it('should return 400 status code if product type is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest, productType: 'bad value' };
        const expectedErrorMessage = {
          message: `request/body/productType must be equal to one of the allowed values: Orthophoto, OrthophotoHistory, OrthophotoBest, RasterMap, RasterMapBest, RasterAid, RasterAidBest, RasterVector, RasterVectorBest`,
        };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload as unknown as PolygonPartsPayload, false);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if catalog id is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest, catalogId: 'bad value' };
        const expectedErrorMessage = { message: `request/body/catalogId must match format "uuid"` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, false);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if product id is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest, productId: 'bad value' };
        const expectedErrorMessage = { message: `request/body/productId must match pattern "^[A-Za-z]{1}[A-Za-z0-9_]{0,37}$"` };
        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if product version is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest, productVersion: 'bad value' };
        const expectedErrorMessage = { message: `request/body/productVersion must match pattern "^[1-9]\\d*(\\.(0|[1-9]\\d?))?$"` };
        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if countries is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], countries: [123] } as unknown as PolygonPartType];
        const expectedErrorMessage = { message: `request/body/partsData/0/countries/0 must be string` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if cities is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], cities: [123] } as unknown as PolygonPartType];
        const expectedErrorMessage = { message: `request/body/partsData/0/cities/0 must be string` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if sensors is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], sensors: 123 } as unknown as PolygonPartType];
        const expectedErrorMessage = { message: `request/body/partsData/0/sensors must be array` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if source name is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], sourceName: 123 } as unknown as PolygonPartType];
        const expectedErrorMessage = { message: `request/body/partsData/0/sourceName must be string` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if resolution degree is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], resolutionDegree: 123 } as unknown as PolygonPartType];
        const expectedErrorMessage = { message: `request/body/partsData/0/resolutionDegree must be <= 0.703125` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if resolution meter is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], resolutionMeter: 0 } as unknown as PolygonPartType];
        const expectedErrorMessage = { message: `request/body/partsData/0/resolutionMeter must be >= 0.0185` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if source resolution meter is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], sourceResolutionMeter: 0 } as unknown as PolygonPartType];
        const expectedErrorMessage = { message: `request/body/partsData/0/sourceResolutionMeter must be >= 0.0185` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if horizontal accuracy ce90 is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [
          { ...updatePolygonPartsPayload.partsData[0], horizontalAccuracyCE90: 5000 } as unknown as PolygonPartType,
        ];
        const expectedErrorMessage = { message: `request/body/partsData/0/horizontalAccuracyCE90 must be <= 4000` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if imaging time begin utc is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [
          { ...updatePolygonPartsPayload.partsData[0], imagingTimeBeginUTC: 'bad value' } as unknown as PolygonPartType,
        ];
        const expectedErrorMessage = { message: `request/body/partsData/0/imagingTimeBeginUTC must match format "date-time"` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if imaging time end utc is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [
          { ...updatePolygonPartsPayload.partsData[0], imagingTimeEndUTC: 'bad value' } as unknown as PolygonPartType,
        ];
        const expectedErrorMessage = { message: `request/body/partsData/0/imagingTimeEndUTC must match format "date-time"` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if footprint is an invalid value - polygon must have coordinates property', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { coordinates, ...badFootprint } = randomPolygon(1, { num_vertices: 3 }).features[0].geometry;
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], footprint: badFootprint as unknown as Polygon }];
        const expectedErrorMessage = { message: `request/body/partsData/0/footprint must have required property 'coordinates'` };

        const response = await requestSender.createPolygonParts(updatePolygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if footprint is an invalid value - polygon must have at least 3 vertices', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const badFootprint = randomPolygon(1, { num_vertices: 3 }).features[0].geometry;
        badFootprint.coordinates[0] = badFootprint.coordinates[0].filter((_, index) => (index === 1 ? false : true));
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], footprint: badFootprint }];
        const expectedErrorMessage = { message: `request/body/partsData/0/footprint/coordinates/0 must NOT have fewer than 4 items` };

        const response = await requestSender.createPolygonParts(updatePolygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if footprint is an invalid value - polygon must have coordinates values in (-180,180) range', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const badFootprint = randomPolygon(1, { num_vertices: 3 }).features[0].geometry;
        badFootprint.coordinates[0][0][1] = 181;
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], footprint: badFootprint }];
        const expectedErrorMessage = { message: `request/body/partsData/0/footprint/coordinates/0/0/1 must be <= 180` };

        const response = await requestSender.createPolygonParts(updatePolygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if footprint is an invalid value - polygon must have type property', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { type, ...badFootprint } = randomPolygon(1, { num_vertices: 3 }).features[0].geometry;
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], footprint: badFootprint as unknown as Polygon }];
        const expectedErrorMessage = { message: `request/body/partsData/0/footprint must have required property 'type'` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, false);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if footprint is an invalid value - polygon must have type property set to Polygon', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const badFootprint = { ...randomPolygon(1, { num_vertices: 3 }).features[0].geometry, type: 'Point' };
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], footprint: badFootprint as unknown as Polygon }];
        const expectedErrorMessage = { message: `request/body/partsData/0/footprint/type must be equal to one of the allowed values: Polygon` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if source id is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], sourceId: 123 } as unknown as PolygonPartType];
        const expectedErrorMessage = { message: `request/body/partsData/0/sourceId must be string` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if description is an invalid value', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [{ ...updatePolygonPartsPayload.partsData[0], description: 123 } as unknown as PolygonPartType];
        const expectedErrorMessage = { message: `request/body/partsData/0/description must be string` };

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject(expectedErrorMessage);
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 400 status code if partsData has no items', async () => {
        const updatePolygonPartsPayload = { ...intersectionWithItalyRequest };
        updatePolygonPartsPayload.partsData = [];

        const response = await requestSender.updatePolygonParts(updatePolygonPartsPayload, true);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toMatchObject({ message: `request/body/partsData must NOT have fewer than 1 items` });
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });
    });
  });

  describe('Sad Path', () => {
    describe('POST /polygonParts', () => {
      it('should return 409 status code if a part resource already exists', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        const {
          entitiesNames: { parts },
        } = getEntitiesMetadata(polygonPartsPayload);
        await helperDB.createTable(parts.entityName, schema);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toMatchObject({ message: `Table with the name '${parts.databaseObjectQualifiedName}' already exists` });
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 409 status code if a polygon part resource already exists', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        const {
          entitiesNames: { polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        await helperDB.createTable(polygonParts.entityName, schema);

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toMatchObject({ message: `Table with the name '${polygonParts.databaseObjectQualifiedName}' already exists` });
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 500 status code for a database error - set search_path error', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedErrorMessage = 'search_path error';
        const spyQuery = jest.spyOn(EntityManager.prototype, 'query').mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
        expect(response).toSatisfyApiSpec();
        expect(spyQuery).toHaveBeenCalledTimes(1);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeFalse();
        expect(existsPolygonParts).toBeFalse();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - verify available tables (first table) error', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedErrorMessage = 'exists error';
        const spyGetExists = jest.spyOn(SelectQueryBuilder.prototype, 'getExists').mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
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
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedErrorMessage = 'exists error';
        const spyGetExists = jest
          .spyOn(SelectQueryBuilder.prototype, 'getExists')
          .mockResolvedValueOnce(false)
          .mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
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
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalQuery = EntityManager.prototype.query;
        const expectedErrorMessage = 'query error';
        const spyQuery = jest
          .spyOn(EntityManager.prototype, 'query')
          .mockImplementationOnce(originalQuery)
          .mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
        expect(response).toSatisfyApiSpec();
        expect(spyQuery).toHaveBeenCalledTimes(2);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeFalse();
        expect(existsPolygonParts).toBeFalse();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - save error', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        const expectedErrorMessage = 'save error';
        const spySave = jest.spyOn(Repository.prototype, 'save').mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
        expect(response).toSatisfyApiSpec();
        expect(spySave).toHaveBeenCalledTimes(1);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeFalse();
        expect(existsPolygonParts).toBeFalse();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - calculate polygon parts error', async () => {
        const polygonPartsPayload = generatePolygonPartsPayload(1);
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(polygonPartsPayload);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalQuery = EntityManager.prototype.query;
        const expectedErrorMessage = 'query error';
        const spyQuery = jest
          .spyOn(EntityManager.prototype, 'query')
          .mockImplementationOnce(originalQuery)
          .mockImplementationOnce(originalQuery)
          .mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.createPolygonParts(polygonPartsPayload);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
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

    describe('PUT /polygonParts', () => {
      afterEach(() => {
        jest.restoreAllMocks(); // Restore original implementations
      });
      it("should return 404 status code if a part resource doesn't exist", async () => {
        const updatePayload = separatePolygonsRequest;
        const {
          entitiesNames: { parts },
        } = getEntitiesMetadata(updatePayload);

        const response = await requestSender.updatePolygonParts(updatePayload, false);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toMatchObject({ message: `Table with the name '${parts.databaseObjectQualifiedName}' doesn't exists` });
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it("should return 404 status code if a polygon part resource doesn't exist", async () => {
        const updatePayload = separatePolygonsRequest;
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);
        await helperDB.createTable(parts.entityName, schema);

        const response = await requestSender.updatePolygonParts(updatePayload, false);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toMatchObject({ message: `Table with the name '${polygonParts.databaseObjectQualifiedName}' doesn't exists` });
        expect(response).toSatisfyApiSpec();

        expect.assertions(3);
      });

      it('should return 500 status code for a database error - set search_path error', async () => {
        await requestSender.createPolygonParts(createInitPayloadRequest);
        const updatePayload = separatePolygonsRequest;
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);
        const spyQuery = jest.spyOn(EntityManager.prototype, 'query').mockRejectedValueOnce(new Error('Transaction failed'));

        const response = await requestSender.updatePolygonParts(updatePayload, true);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: 'Transaction failed' });
        expect(spyQuery).toHaveBeenCalledTimes(1);
        expect(response).toSatisfyApiSpec();

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeTrue();
        expect(existsPolygonParts).toBeTrue();

        expect.assertions(6);
      });

      it('should return 500 status code if when truncate parts fails', async () => {
        await requestSender.createPolygonParts(createInitPayloadRequest);
        const updatePayload = separatePolygonsRequest;
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalQuery = EntityManager.prototype.query;
        const spyQuery = jest
          .spyOn(EntityManager.prototype, 'query')
          .mockImplementationOnce(originalQuery)
          .mockRejectedValueOnce(new Error('Failed to truncate table'))
          .mockImplementationOnce(originalQuery);

        const response = await requestSender.updatePolygonParts(updatePayload, true);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: 'Failed to truncate table' });
        expect(spyQuery).toHaveBeenCalledTimes(3);
        expect(response).toSatisfyApiSpec();

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeTrue();
        expect(existsPolygonParts).toBeTrue();

        expect.assertions(6);
      });

      it('should return 500 status code if when truncate polygon parts fails', async () => {
        await requestSender.createPolygonParts(createInitPayloadRequest);
        const updatePayload = separatePolygonsRequest;
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalQuery = EntityManager.prototype.query;
        const spyQuery = jest
          .spyOn(EntityManager.prototype, 'query')
          .mockImplementationOnce(originalQuery)
          .mockImplementationOnce(originalQuery)
          .mockRejectedValueOnce(new Error('Failed to truncate table'));

        const response = await requestSender.updatePolygonParts(updatePayload, true);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: 'Failed to truncate table' });
        expect(spyQuery).toHaveBeenCalledTimes(3);
        expect(response).toSatisfyApiSpec();

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeTrue();
        expect(existsPolygonParts).toBeTrue();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - verify tables exists (first table) error', async () => {
        await requestSender.createPolygonParts(createInitPayloadRequest);
        const updatePayload = separatePolygonsRequest;
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);
        const spyGetExists = jest.spyOn(SelectQueryBuilder.prototype, 'getExists').mockRejectedValueOnce(new Error('Failed to execute query'));

        const response = await requestSender.updatePolygonParts(updatePayload, true);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: 'Failed to execute query' });
        expect(response).toSatisfyApiSpec();
        expect(spyGetExists).toHaveBeenCalledTimes(2);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeTrue();
        expect(existsPolygonParts).toBeTrue();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - verify tables exists(second table) error', async () => {
        await requestSender.createPolygonParts(createInitPayloadRequest);
        const updatePayload = separatePolygonsRequest;
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);
        const spyGetExists = jest
          .spyOn(SelectQueryBuilder.prototype, 'getExists')
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error('Failed to execute query'));

        const response = await requestSender.updatePolygonParts(updatePayload, true);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: 'Failed to execute query' });
        expect(response).toSatisfyApiSpec();
        expect(spyGetExists).toHaveBeenCalledTimes(2);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeTrue();
        expect(existsPolygonParts).toBeTrue();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - save error', async () => {
        await requestSender.createPolygonParts(createInitPayloadRequest);
        const updatePayload = separatePolygonsRequest;
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);
        const expectedErrorMessage = `Failed to save to ${parts.entityName}`;
        const spySave = jest.spyOn(Repository.prototype, 'save').mockRejectedValueOnce(new Error(expectedErrorMessage));

        const response = await requestSender.updatePolygonParts(updatePayload, true);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: expectedErrorMessage });
        expect(response).toSatisfyApiSpec();
        expect(spySave).toHaveBeenCalledTimes(1);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeTrue();
        expect(existsPolygonParts).toBeTrue();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - calculate polygon parts error on regular update', async () => {
        await requestSender.createPolygonParts(createInitPayloadRequest);
        const updatePayload = separatePolygonsRequest;
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalQuery = EntityManager.prototype.query;
        const spyQuery = jest
          .spyOn(EntityManager.prototype, 'query')
          .mockImplementationOnce(originalQuery)
          .mockRejectedValueOnce(new Error(`Failed to calculate polygon parts on  ${polygonParts.entityName}`));

        const response = await requestSender.updatePolygonParts(updatePayload, false);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: `Failed to calculate polygon parts on  ${polygonParts.entityName}` });
        expect(response).toSatisfyApiSpec();
        expect(spyQuery).toHaveBeenCalledTimes(2);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeTrue();
        expect(existsPolygonParts).toBeTrue();

        expect.assertions(6);
      });

      it('should return 500 status code for a database error - calculate polygon parts error on swap update', async () => {
        await requestSender.createPolygonParts(createInitPayloadRequest);
        const updatePayload = separatePolygonsRequest;
        const {
          entitiesNames: { parts, polygonParts },
        } = getEntitiesMetadata(updatePayload);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalQuery = EntityManager.prototype.query;
        const spyQuery = jest
          .spyOn(EntityManager.prototype, 'query')
          .mockImplementationOnce(originalQuery)
          .mockImplementationOnce(originalQuery)
          .mockImplementationOnce(originalQuery)
          .mockRejectedValueOnce(new Error(`Failed to calculate polygon parts on  ${polygonParts.entityName}`));

        const response = await requestSender.updatePolygonParts(updatePayload, true);

        expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toMatchObject({ message: `Failed to calculate polygon parts on  ${polygonParts.entityName}` });
        expect(response).toSatisfyApiSpec();
        expect(spyQuery).toHaveBeenCalledTimes(4);

        const existsParts = await helperDB.tableExists(parts.entityName, schema);
        const existsPolygonParts = await helperDB.tableExists(polygonParts.entityName, schema);
        expect(existsParts).toBeTrue();
        expect(existsPolygonParts).toBeTrue();

        expect.assertions(6);
      });
    });
  });
});
