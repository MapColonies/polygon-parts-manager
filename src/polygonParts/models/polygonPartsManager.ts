import { ConflictError, HttpError, InternalServerError, NotFoundError } from '@map-colonies/error-types';
import type { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { EntityManager } from 'typeorm';
import { ConnectionManager } from '../../common/connectionManager';
import { DEFAULT_SCHEMA, SERVICES } from '../../common/constants';
import type { ApplicationConfig, IConfig } from '../../common/interfaces';
import { Part } from '../DAL/part';
import { payloadToInsertPartsData } from '../DAL/utils';
import type { DBSchema, EntityName, EntityNames, PolygonPartsPayload } from './interfaces';

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

  public async createPolygonParts(polygonPartsPayload: PolygonPartsPayload): Promise<void> {
    const { catalogId } = polygonPartsPayload;

    const logger = this.logger.child({ catalogId });
    logger.info({ msg: 'creating polygon parts' });

    try {
      await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const baseIngestionContext = {
          entityManager,
          logger,
          polygonPartsPayload,
        };

        await entityManager.query(`SET search_path TO ${this.schema},public`);
        const entityNames = await this.verifyAvailableTableNames(baseIngestionContext);
        const ingestionContext = { ...baseIngestionContext, entityNames };
        await this.createTables(ingestionContext);
        await this.insertParts(ingestionContext);
        await this.calculatePolygonParts(ingestionContext);
      });
    } catch (error) {
      const errorMessage = 'Transaction failed';
      logger.error({ msg: errorMessage, error });
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('Unknown Error');
    }
  }

  public async updatePolygonParts(isSwap: boolean, polygonPartsPayload: PolygonPartsPayload): Promise<void> {
    const { catalogId } = polygonPartsPayload;

    const logger = this.logger.child({ catalogId });
    logger.info({ msg: `updating polygon parts` });

    try {
      await this.connectionManager.getDataSource().transaction(async (entityManager) => {
        const baseUpdateContext = {
          entityManager,
          logger,
          polygonPartsPayload,
        };

        await entityManager.query(`SET search_path TO ${this.schema},public`);
        const entityNames = await this.verifyTablesExists(baseUpdateContext);
        const updateContext = { ...baseUpdateContext, entityNames };
        if (isSwap) {
          await this.truncateEntities(updateContext);
        }
        await this.insertParts(updateContext);
        await this.calculatePolygonParts(updateContext);
      });
    } catch (error) {
      const errorMessage = 'Transaction failed';
      logger.error({ msg: errorMessage, error });
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('Unknown Error');
    }
  }

  private async verifyAvailableTableNames(context: {
    entityManager: EntityManager;
    logger: Logger;
    polygonPartsPayload: PolygonPartsPayload;
  }): Promise<EntityNames> {
    const { entityManager, logger, polygonPartsPayload } = context;
    const entityNames = this.getEntitiesNames(polygonPartsPayload);

    logger.debug({ msg: 'verifying polygon parts table names are available' });

    await Promise.all(
      Object.values<EntityName>({ ...entityNames }).map(async ({ databaseObjectQualifiedName, entityName }) => {
        try {
          const exists = await this.entityExists(entityManager, entityName);
          if (exists) {
            throw new ConflictError(`table with the name '${databaseObjectQualifiedName}' already exists`);
          }
        } catch (error) {
          const errorMessage = `Could not verify polygon parts table name '${databaseObjectQualifiedName}' is available`;
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      })
    );
    return entityNames;
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

    logger.debug({ msg: 'creating polygon parts tables' });

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

    logger.debug({ msg: 'inserting polygon parts data' });

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

    logger.debug({ msg: 'updating polygon parts data' });

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

  private getDatabaseObjectQualifiedName(value: string): string {
    return `${this.schema}.${value}`;
  }

  private getEntitiesNames(polygonPartsPayload: PolygonPartsPayload): EntityNames {
    const { productId, productType } = polygonPartsPayload;
    const baseName = [productId, productType].join('_').toLowerCase();
    const partsEntityName = `${this.applicationConfig.entities.parts.namePrefix}${baseName}${this.applicationConfig.entities.parts.nameSuffix}`;
    const polygonPartsEntityName = `${this.applicationConfig.entities.polygonParts.namePrefix}${baseName}${this.applicationConfig.entities.polygonParts.nameSuffix}`;

    return {
      parts: { entityName: partsEntityName, databaseObjectQualifiedName: this.getDatabaseObjectQualifiedName(partsEntityName) },
      polygonParts: { entityName: polygonPartsEntityName, databaseObjectQualifiedName: this.getDatabaseObjectQualifiedName(polygonPartsEntityName) },
    };
  }

  private async entityExists(entityManager: EntityManager, entityName: string): Promise<boolean> {
    const exists = await entityManager
      .createQueryBuilder()
      .select()
      .from('information_schema.tables', 'information_schema.tables')
      .where(`table_schema = '${this.schema}'`)
      .andWhere(`table_name = '${entityName}'`)
      .getExists();
    return exists;
  }

  private async verifyTablesExists(context: {
    entityManager: EntityManager;
    logger: Logger;
    polygonPartsPayload: PolygonPartsPayload;
  }): Promise<EntityNames> {
    const { entityManager, logger, polygonPartsPayload } = context;
    const entityNames = this.getEntitiesNames(polygonPartsPayload);

    logger.debug({ msg: `verifying polygon parts table names are not available` });

    await Promise.all(
      Object.values<EntityName>({ ...entityNames }).map(async ({ databaseObjectQualifiedName, entityName }) => {
        try {
          const exists = await this.entityExists(entityManager, entityName);
          if (!exists) {
            throw new NotFoundError(`table with the name '${databaseObjectQualifiedName}' doesnt exists`);
          }
        } catch (error) {
          const errorMessage = `Could not verify polygon parts table name '${databaseObjectQualifiedName}' is available`;
          logger.error({ msg: errorMessage, error });
          throw error;
        }
      })
    );
    return entityNames;
  }

  private async truncateEntities(updateContext: {
    entityManager: EntityManager;
    logger: Logger;
    polygonPartsPayload: PolygonPartsPayload;
  }): Promise<EntityNames> {
    const { entityManager, logger, polygonPartsPayload } = updateContext;
    const entityNames = this.getEntitiesNames(polygonPartsPayload);

    logger.debug({ msg: `verifying polygon parts table names are not available` });

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
    return entityNames;
  }

  private async truncateEntity(entityManager: EntityManager, entityName: string): Promise<void> {
    await entityManager.query(`TRUNCATE ${entityName} RESTART IDENTITY CASCADE;`);
  }
}
