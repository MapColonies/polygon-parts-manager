import { ConflictError, NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { EntityManager } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { DEFAULT_SCHEMA, SERVICES } from '../../common/constants';
import type { ApplicationConfig, IConfig } from '../../common/interfaces';
import { Part } from '../DAL/part';
import { payloadToInsertPartsData } from '../DAL/utils';
import type { DBSchema, EntityName, EntityNames, PolygonPartsPayload, PolygonPartsResponse } from './interfaces';

@injectable()
export class PolygonPartsManager {
  private readonly applicationConfig: ApplicationConfig;
  private readonly schema: NonNullable<DBSchema>;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.CONNECTION_MANAGER) private readonly connectionManager: ConnectionManager
  ) {
    this.applicationConfig = this.config.get<ApplicationConfig>('application');
    this.schema = config.get<DBSchema>('db.schema') ?? DEFAULT_SCHEMA;
  }

  public async createPolygonParts(polygonPartsPayload: PolygonPartsPayload, entityNames: EntityNames): Promise<PolygonPartsResponse> {
    const { catalogId } = polygonPartsPayload;

    const logger = this.logger.child({ catalogId });
    logger.info({ msg: 'Creating polygon parts' });

    try {
      const polygonPartsEntityName = await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const baseIngestionContext = {
          entityManager,
          logger,
          entityNames,
        };

        await entityManager.query(`SET search_path TO ${this.schema},public`);
        await this.verifyAvailableTableNames(baseIngestionContext);
        const ingestionContext = { ...baseIngestionContext, polygonPartsPayload };
        await this.createTables(ingestionContext);
        await this.insertParts(ingestionContext);
        await this.calculatePolygonParts(ingestionContext);

        return entityNames.polygonParts.entityName;
      });

      return { polygonPartsEntityName };
    } catch (error) {
      const errorMessage = 'Create polygon parts transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  public async updatePolygonParts(
    isSwap: boolean,
    polygonPartsPayload: PolygonPartsPayload,
    entityNames: EntityNames
  ): Promise<PolygonPartsResponse> {
    const { catalogId } = polygonPartsPayload;

    const logger = this.logger.child({ catalogId });
    logger.info({ msg: `Updating polygon parts` });

    try {
      const polygonPartsEntityName = await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const baseUpdateContext = {
          entityManager,
          logger,
          entityNames,
        };

        await entityManager.query(`SET search_path TO ${this.schema},public`);
        await this.getEntitiesNamesIfExists(baseUpdateContext);
        const updateContext = { ...baseUpdateContext, polygonPartsPayload };
        if (isSwap) {
          await this.truncateEntities(updateContext);
        }
        await this.insertParts(updateContext);
        await this.calculatePolygonParts(updateContext);

        return entityNames.polygonParts.entityName;
      });

      return { polygonPartsEntityName };
    } catch (error) {
      const errorMessage = 'Update polygon parts transaction failed';
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async verifyAvailableTableNames(context: { entityManager: EntityManager; logger: Logger; entityNames: EntityNames }): Promise<void> {
    const { entityManager, logger, entityNames } = context;
    logger.debug({ msg: 'Verifying polygon parts table names are available' });

    await Promise.all(
      Object.values<EntityName>({ ...entityNames }).map(async ({ databaseObjectQualifiedName, entityName }) => {
        try {
          const exists = await this.connectionManager.entityExists(entityManager, entityName);
          if (exists) {
            throw new ConflictError(`Table with the name '${databaseObjectQualifiedName}' already exists`);
          }
        } catch (error) {
          const errorMessage = `Could not verify polygon parts table name '${databaseObjectQualifiedName}' is available`;
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      })
    );
  }

  private async createTables(context: { entityNames: EntityNames; entityManager: EntityManager; logger: Logger }): Promise<void> {
    const {
      entityManager,
      logger,
      entityNames: {
        parts: { databaseObjectQualifiedName: partsEntityQualifiedName },
        polygonParts: { databaseObjectQualifiedName: polygonPartsEntityQualifiedName },
      },
    } = context;

    logger.debug({ msg: 'Creating polygon parts tables' });

    try {
      const createPolygonPartsProcedure = this.applicationConfig.createPolygonPartsTablesStoredProcedure;
      await entityManager.query(`CALL ${createPolygonPartsProcedure}('${partsEntityQualifiedName}', '${polygonPartsEntityQualifiedName}');`);
    } catch (error) {
      const errorMessage = `Could not create polygon parts tables: '${partsEntityQualifiedName}', '${polygonPartsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async insertParts(context: {
    entityNames: EntityNames;
    entityManager: EntityManager;
    logger: Logger;
    polygonPartsPayload: PolygonPartsPayload;
  }): Promise<void> {
    const {
      entityManager,
      entityNames: {
        parts: { databaseObjectQualifiedName: partsEntityQualifiedName },
      },
      logger,
      polygonPartsPayload,
    } = context;

    logger.debug({ msg: 'Inserting polygon parts data' });

    const insertPartsData = payloadToInsertPartsData(polygonPartsPayload);

    try {
      const part = entityManager.getRepository(Part);
      part.metadata.tablePath = partsEntityQualifiedName; // this approach may be unstable for other versions of typeorm - https://github.com/typeorm/typeorm/issues/4245#issuecomment-2134156283
      await part.insert(insertPartsData);
    } catch (error) {
      const errorMessage = `Could not insert polygon parts data to table '${partsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async calculatePolygonParts(context: { entityNames: EntityNames; entityManager: EntityManager; logger: Logger }): Promise<void> {
    const { entityManager, logger, entityNames } = context;
    const partsEntityQualifiedName = entityNames.parts.databaseObjectQualifiedName;
    const polygonPartsEntityQualifiedName = entityNames.polygonParts.databaseObjectQualifiedName;

    logger.debug({ msg: 'Updating polygon parts data' });

    const updatePolygonPartsProcedure = this.applicationConfig.updatePolygonPartsTablesStoredProcedure;

    try {
      await entityManager.query(
        `CALL ${updatePolygonPartsProcedure}('${partsEntityQualifiedName}'::regclass, '${polygonPartsEntityQualifiedName}'::regclass);`
      );
    } catch (error) {
      const errorMessage = `Could not update polygon parts data in tables: '${partsEntityQualifiedName}', '${polygonPartsEntityQualifiedName}'`;
      logger.error({ msg: errorMessage, error });
      throw error;
    }
  }

  private async getEntitiesNamesIfExists(context: { entityManager: EntityManager; logger: Logger; entityNames: EntityNames }): Promise<void> {
    const { entityManager, logger, entityNames } = context;
    logger.debug({ msg: `Verifying entities exists` });

    await Promise.all(
      Object.values<EntityName>({ ...entityNames }).map(async ({ databaseObjectQualifiedName, entityName }) => {
        try {
          const exists = await this.connectionManager.entityExists(entityManager, entityName);
          if (!exists) {
            throw new NotFoundError(`Table with the name '${databaseObjectQualifiedName}' doesn't exists`);
          }
        } catch (error) {
          const errorMessage = `Could not verify polygon parts table name '${databaseObjectQualifiedName}' is available`;
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      })
    );
  }

  private async truncateEntities(updateContext: { entityManager: EntityManager; logger: Logger; entityNames: EntityNames }): Promise<void> {
    const { entityManager, logger, entityNames } = updateContext;
    logger.debug({ msg: `Truncating entities` });

    await Promise.all(
      Object.values<EntityName>({ ...entityNames }).map(async ({ databaseObjectQualifiedName, entityName }) => {
        try {
          await this.truncateEntity(entityManager, entityName);
        } catch (error) {
          const errorMessage = `Could not truncate table '${databaseObjectQualifiedName}' `;
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      })
    );
  }

  private async truncateEntity(entityManager: EntityManager, entityName: string): Promise<void> {
    await entityManager.query(`TRUNCATE ${entityName} RESTART IDENTITY CASCADE;`);
  }
}
