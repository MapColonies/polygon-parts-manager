import { jsLogger } from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { StatusCodes as httpStatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';
import { type DataSourceOptions } from 'typeorm';
import { getApp } from '../../../src/app';
import { ConnectionManager } from '../../../src/common/connectionManager';
import { SERVICES } from '../../../src/common/constants';
import type { DbConfig } from '../../../src/common/interfaces';
import { createConnectionOptions } from '../../../src/common/utils';
import { Transformer } from '../../../src/middlewares/transformer';
import { History } from '../../../src/polygonParts/DAL/history';
import { PolygonPart } from '../../../src/polygonParts/DAL/polygonPart';
import { namingStrategy } from '../../../src/polygonParts/DAL/utils';
import { ValidatePart } from '../../../src/polygonParts/DAL/validationPart';
import { getConfigForTests, initConfigForTests } from '../../configurations/config';
import { HelperDB } from './helpers/db';
import { PolygonPartsRequestSender } from './helpers/requestSender';
import type { GetEntitiesMetadata } from './helpers/types';
import { ingestPolygonParts } from './helpers/utils';

let testDataSourceOptions: DataSourceOptions;

describe('delete', () => {
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

  describe('DELETE /polygonParts/:polygonPartsEntityName', () => {
    describe('Bad Path', () => {
      it('should return 404 when the entity does not exist', async () => {
        const response = await requestSender.deletePolygonParts('doesnotexist_orthophoto');

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Happy Path', () => {
      it('should return 204 and drop all three tables when the entity exists', async () => {
        const { entityIdentifier } = await ingestPolygonParts({
          input: {},
          getEntitiesMetadata,
          requestSender,
        });

        const { entitiesNames } = getEntitiesMetadata({ polygonPartsEntityName: entityIdentifier });

        const response = await requestSender.deletePolygonParts(entityIdentifier);

        expect(response.status).toBe(httpStatusCodes.NO_CONTENT);
        expect(response).toSatisfyApiSpec();

        await expect(helperDB.tableExists(entitiesNames.polygonParts.entityName)).resolves.toBe(false);
        await expect(helperDB.tableExists(entitiesNames.history.entityName)).resolves.toBe(false);
        await expect(helperDB.tableExists(entitiesNames.validations.entityName)).resolves.toBe(false);
      });

      it('should return 404 on a second delete of the same entity', async () => {
        const { entityIdentifier } = await ingestPolygonParts({
          input: {},
          getEntitiesMetadata,
          requestSender,
        });

        await requestSender.deletePolygonParts(entityIdentifier);
        const response = await requestSender.deletePolygonParts(entityIdentifier);

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Route precedence with DELETE /polygonParts/validate', () => {
      // Guards against route shadowing: the static DELETE /polygonParts/validate must take
      // precedence over the parameterized DELETE /polygonParts/:polygonPartsEntityName. If the
      // parameterized route captured `validate`, the request would reach deletePolygonParts and
      // return 404 (no such table). Instead it must reach the validate-delete handler, whose
      // contract rejects the missing query params with 400 — as seen in the PR review example.
      it('should route DELETE /polygonParts/validate to the validate-delete handler (400), not entity delete (404)', async () => {
        const response = await requestSender.deletePolygonParts('validate');

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response).toSatisfyApiSpec();
      });
    });
  });
});
